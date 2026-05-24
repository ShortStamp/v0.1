import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/stripe", tags=["stripe"])
settings = get_settings()


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    event_type = event["type"]

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        await _handle_checkout_completed(session, db)

    elif event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
        subscription = event["data"]["object"]
        await _handle_subscription_change(subscription, db)

    elif event_type == "invoice.payment_failed":
        invoice = event["data"]["object"]
        await _handle_payment_failed(invoice, db)

    return {"status": "ok"}


async def _handle_checkout_completed(session: dict, db: AsyncSession) -> None:
    """Activate subscription after successful checkout."""
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    customer_email = session.get("customer_email") or (
        session.get("metadata") or {}
    ).get("email")

    if not customer_email:
        return

    result = await db.execute(select(User).where(User.email == customer_email))
    user = result.scalar_one_or_none()

    if user:
        user.stripe_customer_id = customer_id
        user.stripe_subscription_id = subscription_id
        user.subscription_status = "active"
        await db.flush()


async def _handle_subscription_change(subscription: dict, db: AsyncSession) -> None:
    """Update subscription status from subscription events."""
    subscription_id = subscription.get("id")
    stripe_status = subscription.get("status", "inactive")

    # Map Stripe statuses to our internal status
    status_map = {
        "active": "active",
        "trialing": "active",
        "past_due": "past_due",
        "canceled": "inactive",
        "unpaid": "inactive",
        "incomplete": "inactive",
        "incomplete_expired": "inactive",
    }
    internal_status = status_map.get(stripe_status, "inactive")

    result = await db.execute(
        select(User).where(User.stripe_subscription_id == subscription_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.subscription_status = internal_status
        await db.flush()


async def _handle_payment_failed(invoice: dict, db: AsyncSession) -> None:
    """Mark subscription as past_due on payment failure."""
    customer_id = invoice.get("customer")

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.subscription_status = "past_due"
        await db.flush()
