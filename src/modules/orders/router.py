"""
Order API routes — order placement, status tracking, and order history.
"""

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_db
from src.database.models import (
    Inventory,
    Order,
    OrderItem,
    OrderSource,
    OrderStatus,
    Product,
    User,
)
from src.modules.auth.security import get_current_user
from src.modules.schemas import (
    OrderCreateRequest,
    OrderItemResponse,
    OrderResponse,
    OrderStatusUpdate,
)

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(
    body: OrderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Place a new order (Mobile, POS, or Family Cart).
    Deducts inventory and checks availability.
    """
    if not body.items:
        raise HTTPException(status_code=400, detail="Order items cannot be empty")

    total_amount = Decimal("0.00")
    order_items = []

    for item_in in body.items:
        # Fetch product
        res = await db.execute(select(Product).where(Product.id == item_in.product_id))
        product = res.scalar_one_or_none()
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {item_in.product_id} not found",
            )

        # Fetch inventory
        inv_res = await db.execute(
            select(Inventory).where(Inventory.product_id == item_in.product_id)
        )
        inv = inv_res.scalar_one_or_none()
        if inv and (inv.quantity - inv.reserved_qty) < item_in.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for product '{product.name_en}'",
            )

        # Deduct or reserve inventory
        if inv:
            inv.quantity -= item_in.quantity
            inv.version += 1

        subtotal = product.price * item_in.quantity
        total_amount += subtotal

        order_items.append(
            OrderItem(
                product_id=product.id,
                quantity=item_in.quantity,
                unit_price=product.price,
                subtotal=subtotal,
            )
        )

    # Determine order source
    source = OrderSource.MOBILE
    if body.source.upper() == "POS":
        source = OrderSource.POS
    elif body.source.upper() == "FAMILY_CART":
        source = OrderSource.FAMILY_CART

    order = Order(
        user_id=current_user.id,
        source=source,
        status=OrderStatus.PENDING if source != OrderSource.POS else OrderStatus.COMPLETED,
        total_amount=total_amount,
        shift_id=body.shift_id,
        items=order_items,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    # Re-query with items loaded
    res = await db.execute(
        select(Order).where(Order.id == order.id).options(selectinload(Order.items))
    )
    full_order = res.scalar_one()

    return OrderResponse(
        id=full_order.id,
        user_id=full_order.user_id,
        source=full_order.source.value,
        status=full_order.status.value,
        total_amount=full_order.total_amount,
        created_at=full_order.created_at,
        items=[
            OrderItemResponse(
                id=i.id,
                product_id=i.product_id,
                quantity=i.quantity,
                unit_price=i.unit_price,
                subtotal=i.subtotal,
            )
            for i in full_order.items
        ],
    )


@router.get("", response_model=list[OrderResponse])
async def list_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List orders for current user (or all if cashier/manager)."""
    query = select(Order).options(selectinload(Order.items))
    if current_user.role.value not in ["CASHIER", "MANAGER", "ADMIN"]:
        query = query.where(Order.user_id == current_user.id)

    query = query.order_by(Order.created_at.desc()).limit(50)
    result = await db.execute(query)
    orders = result.scalars().all()

    return [
        OrderResponse(
            id=o.id,
            user_id=o.user_id,
            source=o.source.value,
            status=o.status.value,
            total_amount=o.total_amount,
            created_at=o.created_at,
            items=[
                OrderItemResponse(
                    id=i.id,
                    product_id=i.product_id,
                    quantity=i.quantity,
                    unit_price=i.unit_price,
                    subtotal=i.subtotal,
                )
                for i in o.items
            ],
        )
        for o in orders
    ]


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single order by ID."""
    res = await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if (
        order.user_id != current_user.id
        and current_user.role.value not in ["CASHIER", "MANAGER", "ADMIN"]
    ):
        raise HTTPException(status_code=403, detail="Forbidden")

    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        source=order.source.value,
        status=order.status.value,
        total_amount=order.total_amount,
        created_at=order.created_at,
        items=[
            OrderItemResponse(
                id=i.id,
                product_id=i.product_id,
                quantity=i.quantity,
                unit_price=i.unit_price,
                subtotal=i.subtotal,
            )
            for i in order.items
        ],
    )
