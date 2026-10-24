"""
Product seeder — imports all 1000 products from super_market.xlsx
into the database, creating categories and subcategories automatically.
"""

import logging
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.models import Category, Inventory, Product

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "super_market.xlsx"


async def seed_products(db: AsyncSession) -> dict:
    """
    Read super_market.xlsx and insert all products with their categories.
    Returns a summary dict with counts.
    """
    # Check if products already exist
    result = await db.execute(select(Product).limit(1))
    if result.scalar_one_or_none():
        logger.info("Products already seeded — skipping.")
        return {"status": "skipped", "message": "Products already exist"}

    wb = load_workbook(str(DATA_FILE), read_only=True)
    ws = wb.active

    # Caches to avoid duplicate inserts
    category_cache: dict[str, Category] = {}  # "en_name" -> Category
    stats = {"categories": 0, "subcategories": 0, "products": 0}

    rows = list(ws.iter_rows(min_row=2, values_only=True))

    for row in rows:
        (
            barcode,
            name_ar,
            name_en,
            cat_ar,
            cat_en,
            subcat_ar,
            subcat_en,
            brand,
            country,
            size,
            fmt,
            price,
            image,
            _id,
            _embedding,
        ) = row

        if not barcode or not name_en:
            continue

        # ── Upsert parent category ───────────────────────────────────
        if cat_en and cat_en not in category_cache:
            cat = Category(name_ar=cat_ar or "", name_en=cat_en)
            db.add(cat)
            await db.flush()
            category_cache[cat_en] = cat
            stats["categories"] += 1

        # ── Upsert subcategory ───────────────────────────────────────
        subcat_key = f"{cat_en}::{subcat_en}"
        if subcat_en and subcat_key not in category_cache:
            parent = category_cache.get(cat_en)
            subcat = Category(
                name_ar=subcat_ar or "",
                name_en=subcat_en,
                parent_id=parent.id if parent else None,
            )
            db.add(subcat)
            await db.flush()
            category_cache[subcat_key] = subcat
            stats["subcategories"] += 1

        # ── Insert product ───────────────────────────────────────────
        subcat_key = f"{cat_en}::{subcat_en}"
        cat_obj = category_cache.get(subcat_key) or category_cache.get(cat_en)

        product = Product(
            barcode=str(barcode),
            name_ar=name_ar or "",
            name_en=name_en or "",
            brand=brand,
            country=country,
            size=size,
            format=fmt,
            price=price or 0,
            image_url=str(image) if image else None,
            category_id=cat_obj.id if cat_obj else None,
        )
        db.add(product)
        await db.flush()

        # Create inventory record with random stock
        inventory = Inventory(
            product_id=product.id,
            quantity=50,  # Default starting stock
            reserved_qty=0,
        )
        db.add(inventory)
        stats["products"] += 1

    await db.commit()
    wb.close()

    logger.info(
        f"Seeded {stats['products']} products, "
        f"{stats['categories']} categories, "
        f"{stats['subcategories']} subcategories"
    )
    return {"status": "success", **stats}
