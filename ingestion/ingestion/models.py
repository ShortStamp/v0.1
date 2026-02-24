"""Re-export SQLAlchemy models from the backend package.

The backend directory is mounted at /backend (docker) or available on PYTHONPATH.
Both services share the same PostgreSQL database, so we re-use the exact same
model definitions rather than duplicating them.
"""

# Import all models so SQLAlchemy can resolve all ForeignKey references.
import app.models.category  # noqa: F401
import app.models.product   # noqa: F401
import app.models.user      # noqa: F401
import app.models.build     # noqa: F401
import app.models.trend     # noqa: F401
import app.models.ingestion # noqa: F401

from app.models.product import (  # noqa: F401
    Brand,
    Product,
    ProductFilterValue,
    ProductPrice,
    ProductVariant,
    Retailer,
)
from app.models.ingestion import IngestionLock, IngestionRun  # noqa: F401
