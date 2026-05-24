import base64
import re
from typing import Literal

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.config import get_settings
from app.middleware.auth_middleware import get_subscribed_user
from app.models.user import User

router = APIRouter(prefix="/analyze", tags=["analyze"])
settings = get_settings()

Verdict = Literal["REAL", "FAKE", "SCAM", "AI_GENERATED", "UNCERTAIN"]
Category = Literal["fact", "link", "media", "general"]

SYSTEM_PROMPT = """You are ShortStamp, an AI legitimacy checker. You analyze screenshots and content to determine whether they are real, fake, scam, AI-generated, or uncertain.

You MUST respond with a valid JSON object in this exact format:
{
  "verdict": "REAL" | "FAKE" | "SCAM" | "AI_GENERATED" | "UNCERTAIN",
  "confidence": <integer 0-100>,
  "explanation": "<1-3 clear sentences explaining your verdict>",
  "category": "fact" | "link" | "media" | "general"
}

Verdict definitions:
- REAL: The content is legitimate, factual, and trustworthy
- FAKE: The content is fabricated, false, or misleading
- SCAM: The content is a scam attempt (phishing, fraud, deceptive marketing)
- AI_GENERATED: The content appears to be AI-generated (images, text, deepfakes)
- UNCERTAIN: Not enough signal to make a determination

Category definitions:
- fact: A claim, statistic, news headline, or factual assertion
- link: A URL, domain, or web link being evaluated
- media: An image, video frame, or visual content
- general: General content or mixed content that doesn't fit the above

Be direct and concise. Your explanation should be 1-3 sentences maximum. Do not hedge excessively — give a clear verdict when the evidence supports it."""


class AnalyzeRequest(BaseModel):
    image_base64: str
    hint: str | None = None

    @field_validator("image_base64")
    @classmethod
    def validate_base64(cls, v: str) -> str:
        # Strip data URI prefix if present
        if v.startswith("data:"):
            v = re.sub(r"^data:[^;]+;base64,", "", v)
        try:
            base64.b64decode(v, validate=True)
        except Exception:
            raise ValueError("Invalid base64 image data")
        return v


class AnalyzeResponse(BaseModel):
    verdict: Verdict
    confidence: int
    explanation: str
    category: Category


@router.post("", response_model=AnalyzeResponse)
async def analyze(
    body: AnalyzeRequest,
    current_user: User = Depends(get_subscribed_user),
):
    """Analyze a screenshot for legitimacy."""
    # Demo mode — return a mock result without calling the AI
    if settings.anthropic_api_key in (None, "", "demo"):
        import random
        verdicts: list[Verdict] = ["REAL", "FAKE", "SCAM", "AI_GENERATED", "UNCERTAIN"]
        categories: list[Category] = ["fact", "link", "media", "general"]
        verdict = random.choice(verdicts)
        explanations = {
            "REAL": "This content appears legitimate. The sources and claims are consistent with verified information.",
            "FAKE": "This content shows signs of being fabricated. Key details do not match known verified sources.",
            "SCAM": "This appears to be a scam attempt. The domain or content displays classic phishing patterns.",
            "AI_GENERATED": "This content shows strong indicators of AI generation. Texture and patterns are consistent with generative models.",
            "UNCERTAIN": "Not enough signal to make a clear determination. Treat with caution.",
        }
        return AnalyzeResponse(
            verdict=verdict,
            confidence=random.randint(65, 95),
            explanation=explanations[verdict],
            category=random.choice(categories),
        )

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service not configured",
        )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # Build user message
    user_content: list = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": body.image_base64,
            },
        },
        {
            "type": "text",
            "text": (
                f"User hint: {body.hint}\n\nAnalyze the screenshot above for legitimacy. Respond with JSON only."
                if body.hint
                else "Analyze the screenshot above for legitimacy. Respond with JSON only."
            ),
        },
    ]

    try:
        message = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )

        response_text = message.content[0].text.strip()

        # Extract JSON from response
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON in response")

        import json

        data = json.loads(json_match.group())

        # Validate and clamp confidence
        confidence = max(0, min(100, int(data.get("confidence", 50))))
        verdict = data.get("verdict", "UNCERTAIN")
        if verdict not in ("REAL", "FAKE", "SCAM", "AI_GENERATED", "UNCERTAIN"):
            verdict = "UNCERTAIN"

        category = data.get("category", "general")
        if category not in ("fact", "link", "media", "general"):
            category = "general"

        return AnalyzeResponse(
            verdict=verdict,
            confidence=confidence,
            explanation=data.get("explanation", "Unable to determine legitimacy."),
            category=category,
        )

    except anthropic.APIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {e}",
        )
    except (ValueError, KeyError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse AI response: {e}",
        )
