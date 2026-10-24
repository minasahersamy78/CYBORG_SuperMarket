"""
Cart and Family Cart API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_db
from src.database.models import Cart, CartItem, Product, User
from src.modules.auth.security import get_current_user
from src.modules.schemas import (
    CartItemCreate,
    CartItemResponse,
    CartResponse,
    FamilyCartCreate,
)

router = APIRouter(prefix="/api/cart", tags=["Cart"])


async def get_or_create_cart(user_id: str, db: AsyncSession) -> Cart:
    """Retrieve existing active cart or initialize a new one."""
    res = await db.execute(
        select(Cart)
        .where(Cart.user_id == user_id, Cart.is_family_cart == False)  # noqa: E712
        .options(selectinload(Cart.items))
    )
    cart = res.scalar_one_or_none()
    if not cart:
        cart = Cart(user_id=user_id, is_family_cart=False)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
        # re-query with items
        res = await db.execute(
            select(Cart).where(Cart.id == cart.id).options(selectinload(Cart.items))
        )
        cart = res.scalar_one()
    return cart


@router.get("", response_model=CartResponse)
async def get_cart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve current user's shopping cart."""
    cart = await get_or_create_cart(current_user.id, db)
    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        is_family_cart=cart.is_family_cart,
        budget_limit=cart.budget_limit,
        items=[
            CartItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
            )
            for item in cart.items
        ],
    )


@router.post("/items", response_model=CartResponse)
async def add_item_to_cart(
    body: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a product or increment its quantity in the cart."""
    # Verify product exists
    prod_res = await db.execute(select(Product).where(Product.id == body.product_id))
    if not prod_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    cart = await get_or_create_cart(current_user.id, db)

    # Check if item is already in cart
    item_res = await db.execute(
        select(CartItem).where(
            CartItem.cart_id == cart.id, CartItem.product_id == body.product_id
        )
    )
    cart_item = item_res.scalar_one_or_none()

    if cart_item:
        cart_item.quantity += body.quantity
    else:
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=body.product_id,
            quantity=body.quantity,
        )
        db.add(cart_item)

    await db.commit()

    # Re-query cart
    res = await db.execute(
        select(Cart).where(Cart.id == cart.id).options(selectinload(Cart.items))
    )
    fresh_cart = res.scalar_one()

    return CartResponse(
        id=fresh_cart.id,
        user_id=fresh_cart.user_id,
        is_family_cart=fresh_cart.is_family_cart,
        budget_limit=fresh_cart.budget_limit,
        items=[
            CartItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
            )
            for item in fresh_cart.items
        ],
    )


@router.delete("/items/{item_id}", response_model=CartResponse)
async def remove_item_from_cart(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the cart."""
    cart = await get_or_create_cart(current_user.id, db)
    item_res = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
    )
    cart_item = item_res.scalar_one_or_none()
    if not cart_item:
        raise HTTPException(status_code=404, detail="Item not in cart")

    await db.delete(cart_item)
    await db.commit()

    # Re-query cart
    res = await db.execute(
        select(Cart).where(Cart.id == cart.id).options(selectinload(Cart.items))
    )
    fresh_cart = res.scalar_one()

    return CartResponse(
        id=fresh_cart.id,
        user_id=fresh_cart.user_id,
        is_family_cart=fresh_cart.is_family_cart,
        budget_limit=fresh_cart.budget_limit,
        items=[
            CartItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
            )
            for item in fresh_cart.items
        ],
    )
