"""
Inventory API routes — stock lookups and optimistic-locking stock updates.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.database.models import Inventory, UserRole
from src.modules.auth.security import require_roles
from src.modules.schemas import InventoryResponse, InventoryUpdateRequest

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("/{product_id}", response_model=InventoryResponse)
async def get_inventory(product_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve current stock and reservation levels for a product."""
    result = await db.execute(
        select(Inventory).where(Inventory.product_id == product_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory for product {product_id} not found",
        )
    return InventoryResponse(
        id=inv.id,
        product_id=inv.product_id,
        quantity=inv.quantity,
        reserved_qty=inv.reserved_qty,
        available=max(0, inv.quantity - inv.reserved_qty),
        version=inv.version,
    )


@router.put(
    "/{product_id}",
    response_model=InventoryResponse,
    dependencies=[Depends(require_roles(UserRole.CASHIER.value, UserRole.MANAGER.value, UserRole.ADMIN.value))],
)
async def update_inventory(
    product_id: int,
    body: InventoryUpdateRequest,
    version: int = 1,
    db: AsyncSession = Depends(get_db),
):
    """
    Update inventory quantity with optimistic locking check.
    Fails if the version has changed since the last read.
    """
    result = await db.execute(
        select(Inventory).where(Inventory.product_id == product_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory record not found")

    if inv.version != version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict: Inventory was modified by another transaction. Please reload.",
        )

    if body.quantity is not None:
        inv.quantity = body.quantity
    if body.reserved_qty is not None:
        inv.reserved_qty = body.reserved_qty

    inv.version += 1
    await db.commit()
    await db.refresh(inv)

    return InventoryResponse(
        id=inv.id,
        product_id=inv.product_id,
        quantity=inv.quantity,
        reserved_qty=inv.reserved_qty,
        available=max(0, inv.quantity - inv.reserved_qty),
        version=inv.version,
    )
