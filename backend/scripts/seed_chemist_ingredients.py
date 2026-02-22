"""
Seed the chemist_known_ingredients table with INCI ingredient names
grouped by conflict category.

Sources: INCIDecoder, EU CosIng, CosDNA (fetched 2026-02-22).

Run from the backend/ directory:
    python3 scripts/seed_chemist_ingredients.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings

# ---------------------------------------------------------------------------
# Ingredient data
# ---------------------------------------------------------------------------

INGREDIENTS: list[tuple[str, str, str | None]] = [
    # (inci_name, conflict_category, notes)

    # ── SILICONES ─────────────────────────────────────────────────────────
    # Linear / non-volatile silicone oils
    ("Dimethicone", "silicone", "Most common; causes pilling over water-based formulas"),
    ("Dimethiconol", "silicone", "Silicone diol variant"),
    ("Methicone", "silicone", None),
    ("Amodimethicone", "silicone", "Amino-functional conditioning silicone"),
    ("Bis-Aminopropyl Dimethicone", "silicone", None),
    ("Bis-Hydroxy/Methoxy Amodimethicone", "silicone", None),
    ("Phenyl Trimethicone", "silicone", "High-shine phenyl variant"),
    ("Phenyl Dimethicone", "silicone", None),
    ("Trimethylsiloxyphenyl Dimethicone", "silicone", None),
    ("Diphenyl Dimethicone", "silicone", None),
    ("Diphenylsiloxy Phenyl Trimethicone", "silicone", None),
    ("Stearyl Dimethicone", "silicone", "Alkyl-modified wax"),
    ("Stearoxy Dimethicone", "silicone", None),
    ("Behenoxy Dimethicone", "silicone", None),
    ("Cetyl Dimethicone", "silicone", None),
    ("Lauryl Dimethicone", "silicone", None),
    ("Caprylyl Methicone", "silicone", "Volatile emollient silicone"),
    # Cyclic / volatile silicones
    ("Cyclomethicone", "silicone", "Legacy blend designation for cyclic silicones"),
    ("Cyclopentasiloxane", "silicone", "D5; EU max 0.1% in rinse-off (vPvB)"),
    ("Cyclohexasiloxane", "silicone", "D6; EU banned in rinse-off since 2020"),
    ("Cyclotetrasiloxane", "silicone", "D4; EU banned in rinse-off since 2022"),
    ("Octamethylcyclotetrasiloxane", "silicone", "D4 alternate INCI; same restriction"),
    ("Decamethylcyclopentasiloxane", "silicone", "D5 alternate INCI"),
    ("Dodecamethylcyclohexasiloxane", "silicone", "D6 alternate INCI"),
    ("Trisiloxane", "silicone", "D3 volatile carrier"),
    # Resins / film formers
    ("Trimethylsiloxysilicate", "silicone", "Film-former; top culprit in makeup pilling"),
    ("Polymethylsilsesquioxane", "silicone", "Silicone resin powder"),
    ("Polypropylsilsesquioxane", "silicone", None),
    ("Phenylsilsesquioxane", "silicone", None),
    ("Trimethylsiloxysilylcarbamoyl Pullulan", "silicone", "Film former"),
    # Elastomers / crosspolymers
    ("Dimethicone Crosspolymer", "silicone", "Silicone elastomer"),
    ("Dimethicone/Vinyl Dimethicone Crosspolymer", "silicone", None),
    ("Dimethicone (and) Dimethicone/Vinyl Dimethicone Crosspolymer", "silicone", None),
    ("Vinyl Dimethicone/Methicone Silsesquioxane Crosspolymer", "silicone", None),
    ("Vinyl Dimethicone Crosspolymer", "silicone", None),
    ("Dimethicone/PEG-10/15 Crosspolymer", "silicone", None),
    ("PEG-10 Dimethicone/Vinyl Dimethicone Crosspolymer", "silicone", None),
    ("Dimethicone/Silica Crosspolymer", "silicone", None),
    ("Trimethylsiloxysilicate/Dimethiconol Crosspolymer", "silicone", None),
    ("Cyclopentasiloxane (and) Dimethicone Crosspolymer", "silicone", None),
    # Alkyl-modified silicone waxes
    ("C20-24 Alkyl Dimethicone", "silicone", None),
    ("C30-45 Alkyl Dimethicone", "silicone", None),
    ("C30-45 Alkyl Methicone", "silicone", None),
    ("C32 Alkyl Dimethicone", "silicone", None),
    ("Behenyl Dimethicone", "silicone", None),
    ("Cerotyl Dimethicone", "silicone", None),
    ("Capryl Dimethicone", "silicone", None),
    ("Cetearyl Methicone", "silicone", None),
    ("Hexyl Methicone", "silicone", None),
    ("Lauryl Methicone", "silicone", None),
    ("Stearyl Methicone", "silicone", None),
    ("Behenyl Methicone", "silicone", None),
    # Silicone quaterniums
    ("Silicone Quaternium-1", "silicone", "Cationic conditioning silicone"),
    ("Silicone Quaternium-8", "silicone", None),
    ("Silicone Quaternium-12", "silicone", None),
    ("Silicone Quaternium-16", "silicone", None),
    ("Silicone Quaternium-17", "silicone", None),
    ("Silicone Quaternium-18", "silicone", None),
    ("Silicone Quaternium-20", "silicone", None),
    ("Silicone Quaternium-22", "silicone", None),
    ("Silicone Quaternium-24", "silicone", None),
    # Other silicones
    ("Drometrizole Trisiloxane", "silicone", "UV filter silicone"),
    ("Polysilicone-2", "silicone", None),
    ("Polysilicone-13", "silicone", None),

    # ── AHAs ──────────────────────────────────────────────────────────────
    ("Glycolic Acid", "aha", "Smallest AHA; strongest penetration"),
    ("Lactic Acid", "aha", None),
    ("Mandelic Acid", "aha", "Larger molecule; gentler"),
    ("Malic Acid", "aha", None),
    ("Tartaric Acid", "aha", None),
    ("Citric Acid", "aha", "Also a pH adjuster at low concentrations"),
    ("Hydroxycaprylic Acid", "aha", "Alpha-hydroxyoctanoic acid"),
    ("Hydroxycapric Acid", "aha", "Alpha-hydroxydecanoic acid"),
    ("Alpha-Hydroxy Acids", "aha", "Generic blend INCI"),
    ("Gluconolactone", "aha", "PHA; gentler AHA-adjacent exfoliant"),
    ("Lactobionic Acid", "aha", "PHA; aldobionic acid"),
    ("Phytic Acid", "aha", "Mild exfoliant and antioxidant"),

    # ── BHAs ──────────────────────────────────────────────────────────────
    ("Salicylic Acid", "bha", "Primary BHA; EU max 2%"),
    ("Sodium Salicylate", "bha", "Salt form; gentler, water-soluble"),
    ("Betaine Salicylate", "bha", "Ester form; ~half potency of salicylic acid"),
    ("Capryloyl Salicylic Acid", "bha", "LHA; slow-release lipophilic derivative"),
    ("Salix Alba (Willow) Bark Extract", "bha", "Natural salicylate source"),
    ("Salix Nigra (Willow) Bark Extract", "bha", "Black willow variant"),
    ("Beta Hydroxybutanoic Acid", "bha", None),
    ("Trethocanic Acid", "bha", "Listed in EU CosIng"),
    ("Tropic Acid", "bha", "BHA variant listed in CosIng/FDA"),

    # ── RETINOIDS ─────────────────────────────────────────────────────────
    ("Retinol", "retinoid", "EU max 0.3% leave-on; oxidizes with BPO"),
    ("Retinal", "retinoid", "Retinaldehyde; one step from retinoic acid"),
    ("Retinaldehyde", "retinoid", "Alternate INCI for retinal"),
    ("Retinyl Palmitate", "retinoid", "Weakest ester; EU max 0.3% leave-on"),
    ("Retinyl Acetate", "retinoid", "EU max 0.3% leave-on"),
    ("Retinyl Propionate", "retinoid", None),
    ("Retinyl Linoleate", "retinoid", None),
    ("Retinyl Sunflowerate", "retinoid", None),
    ("Retinyl Glucoside", "retinoid", "Water-soluble vitamin A glucoside"),
    ("Hydroxypinacolone Retinoate", "retinoid", "HPR; Granactive Retinoid; binds directly to retinoid receptors"),
    ("Retinyl Retinoate", "retinoid", "Dual-action; converts to retinol and retinoic acid"),
    ("Dimethyl Isosorbide (and) Hydroxypinacolone Retinoate", "retinoid", "Full INCI for Granactive Retinoid blend"),

    # ── OXIDIZERS ─────────────────────────────────────────────────────────
    ("Benzoyl Peroxide", "oxidizer", "Degrades retinoids and vitamin C; generates free radicals"),
    ("Hydrogen Peroxide", "oxidizer", "EU max 12% hair, 4% skin; destroys antioxidants"),
    ("Carbamide Peroxide", "oxidizer", "Urea + H2O2 complex; teeth whitening"),
    ("Sodium Percarbonate", "oxidizer", "Releases H2O2 on contact with water; hair bleach"),
    ("Sodium Perborate", "oxidizer", "EU restricted; nail/hair bleach"),

    # ── VITAMIN C ─────────────────────────────────────────────────────────
    ("Ascorbic Acid", "vitamin_c", "Pure L-ascorbic acid; most potent; pH-sensitive"),
    ("Sodium Ascorbyl Phosphate", "vitamin_c", "SAP; stable vitamin C derivative"),
    ("Magnesium Ascorbyl Phosphate", "vitamin_c", "MAP; water-soluble, stable"),
    ("Ascorbyl Glucoside", "vitamin_c", "Slow-release; stable"),
    ("Ethyl Ascorbic Acid", "vitamin_c", "3-O-ethyl ascorbic acid; good stability"),
    ("Ascorbyl Palmitate", "vitamin_c", "Oil-soluble; less effective"),
    ("Ascorbyl Tetraisopalmitate", "vitamin_c", "Oil-soluble; high stability"),
    ("Tetrahexyldecyl Ascorbate", "vitamin_c", "Oil-soluble; penetrates well"),
    ("Sodium Ascorbate", "vitamin_c", "Salt form; gentle"),
    ("Calcium Ascorbate", "vitamin_c", "Salt form; gentle"),

    # ── COPPER PEPTIDES ───────────────────────────────────────────────────
    ("Copper Tripeptide-1", "copper_peptide", "GHK-Cu; pH conflict with acids and vitamin C"),
    ("Copper Lysinate/Prolinate", "copper_peptide", None),

    # ── NIACINAMIDE ───────────────────────────────────────────────────────
    ("Niacinamide", "niacinamide", "Low-severity pH conflict with high-conc ascorbic acid"),
]


async def seed(db_url: str) -> int:
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    inserted = 0
    async with async_session() as session:
        for inci_name, category, notes in INGREDIENTS:
            # Skip if already exists (idempotent)
            result = await session.execute(
                text("SELECT id FROM chemist_known_ingredients WHERE inci_name = :n"),
                {"n": inci_name},
            )
            if result.fetchone():
                continue
            await session.execute(
                text(
                    "INSERT INTO chemist_known_ingredients (inci_name, conflict_category, notes) "
                    "VALUES (:n, :c, :notes)"
                ),
                {"n": inci_name, "c": category, "notes": notes},
            )
            inserted += 1
        await session.commit()

    await engine.dispose()
    return inserted


if __name__ == "__main__":
    db_url = os.environ.get("DATABASE_URL", settings.database_url)
    added = asyncio.run(seed(db_url))
    print(f"Seeded chemist_known_ingredients: {added} rows added ({len(INGREDIENTS)} total defined)")

    # Print breakdown by category
    import collections
    by_cat: dict[str, int] = collections.Counter(row[1] for row in INGREDIENTS)
    for cat, count in sorted(by_cat.items()):
        print(f"  {cat}: {count}")
