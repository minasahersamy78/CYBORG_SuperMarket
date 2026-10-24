"""
Product and Category API routes.
Supports pagination, multilingual search (Arabic & English), and category filtering.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_db
from src.database.models import Category, Inventory, Product
from src.database.seeder import seed_products
from src.modules.schemas import (
    CategoryResponse,
    CategoryWithChildren,
    ProductListResponse,
    ProductResponse,
)

router = APIRouter(prefix="/api", tags=["Products & Categories"])


@router.get("/products", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category_id: int | None = Query(None, description="Filter by category ID"),
    search: str | None = Query(None, description="Search by name (AR/EN) or barcode"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve products with pagination, search, and category filtering."""
    query = select(Product)

    if category_id:
        query = query.where(Product.category_id == category_id)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.where(
            or_(
                Product.name_en.ilike(search_filter),
                Product.name_ar.ilike(search_filter),
                Product.barcode.ilike(search_filter),
                Product.brand.ilike(search_filter),
            )
        )

    # Count total matching products
    from sqlalchemy import func
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Apply pagination and sorting
    query = (
        query.order_by(Product.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    products = result.scalars().all()

    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch details for a single product by ID."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )
    return ProductResponse.model_validate(product)


@router.get("/products/barcode/{barcode}", response_model=ProductResponse)
async def get_product_by_barcode(barcode: str, db: AsyncSession = Depends(get_db)):
    """Barcode lookup for POS scanners."""
    result = await db.execute(select(Product).where(Product.barcode == barcode.strip()))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode '{barcode}' not found",
        )
    return ProductResponse.model_validate(product)


@router.get("/categories", response_model=list[CategoryWithChildren])
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all root categories with their subcategories."""
    query = (
        select(Category)
        .where(Category.parent_id.is_(None))
        .options(selectinload(Category.children))
    )
    result = await db.execute(query)
    categories = result.scalars().all()
    return [CategoryWithChildren.model_validate(c) for c in categories]


@router.post("/products/seed", tags=["Admin"])
async def trigger_seed(db: AsyncSession = Depends(get_db)):
    """Seed the database with 1000 products from data/super_market.xlsx."""
    summary = await seed_products(db)
    return summary
