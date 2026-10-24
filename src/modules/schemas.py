"""
Pydantic schemas shared across modules.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


# ── Auth Schemas ─────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name_ar: str | None = None
    name_en: str | None = None
    phone: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    name_ar: str | None
    name_en: str | None
    phone: str | None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Product Schemas ──────────────────────────────────────────────────────────


class ProductResponse(BaseModel):
    id: int
    barcode: str
    name_ar: str
    name_en: str
    brand: str | None
    country: str | None
    size: str | None
    format: str | None
    price: Decimal
    image_url: str | None
    category_id: int | None

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int


# ── Category Schemas ─────────────────────────────────────────────────────────


class CategoryResponse(BaseModel):
    id: int
    name_ar: str
    name_en: str
    parent_id: int | None

    model_config = {"from_attributes": True}


class CategoryWithChildren(CategoryResponse):
    children: list[CategoryResponse] = []


# ── Inventory Schemas ────────────────────────────────────────────────────────


class InventoryResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    reserved_qty: int
    available: int = 0  # quantity - reserved_qty
    version: int

    model_config = {"from_attributes": True}


class InventoryUpdateRequest(BaseModel):
    quantity: int | None = None
    reserved_qty: int | None = None


# ── Order Schemas ────────────────────────────────────────────────────────────


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)


class OrderCreateRequest(BaseModel):
    source: str = "MOBILE"
    items: list[OrderItemCreate]
    shift_id: str | None = None


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: str
    user_id: str
    source: str
    status: str
    total_amount: Decimal
    created_at: datetime
    items: list[OrderItemResponse] = []

    model_config = {"from_attributes": True}


class OrderStatusUpdate(BaseModel):
    status: str


# ── Cart Schemas ─────────────────────────────────────────────────────────────


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, default=1)


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int

    model_config = {"from_attributes": True}


class CartResponse(BaseModel):
    id: str
    user_id: str
    is_family_cart: bool
    budget_limit: Decimal | None
    items: list[CartItemResponse] = []

    model_config = {"from_attributes": True}


class FamilyCartCreate(BaseModel):
    budget_limit: Decimal | None = None


class FamilyMemberAdd(BaseModel):
    user_id: str
    spend_limit: Decimal | None = None


# ── Shift Schemas ────────────────────────────────────────────────────────────


class ShiftStartRequest(BaseModel):
    opening_balance: Decimal = Decimal("0.00")


class ShiftCloseRequest(BaseModel):
    closing_balance: Decimal


class ShiftResponse(BaseModel):
    id: str
    cashier_id: str
    opening_balance: Decimal
    closing_balance: Decimal | None
    total_transactions: int
    started_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}
