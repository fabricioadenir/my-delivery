"""Pydantic schemas for suppliers, purchases and stock actions."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

UUID_PATTERN = r"^[0-9a-f-]{36}$"
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class SupplierIn(BaseModel):
    """Supplier contact data."""

    name: str = Field(min_length=1, max_length=120)
    nif: Optional[str] = Field(default=None, max_length=20)
    phone: Optional[str] = Field(default=None, max_length=30)
    notes: Optional[str] = Field(default=None, max_length=500)


class PurchaseLineIn(BaseModel):
    """One purchased ingredient with the total paid for it."""

    ingredient_id: str = Field(pattern=UUID_PATTERN)
    quantity: float = Field(gt=0, le=9999999)
    total_price: float = Field(ge=0, le=99999)
    lot: Optional[str] = Field(default=None, max_length=60)
    expires_on: Optional[str] = Field(default=None, pattern=DATE_PATTERN)


class PurchaseIn(BaseModel):
    """Purchase made from a supplier."""

    supplier_id: Optional[str] = Field(default=None, pattern=UUID_PATTERN)
    purchased_on: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    notes: Optional[str] = Field(default=None, max_length=500)
    items: list[PurchaseLineIn] = Field(min_length=1, max_length=60)


class StockActionIn(BaseModel):
    """Stock count, waste record or minimum stock for one ingredient."""

    action: Literal["count", "waste", "minimum"]
    quantity: Optional[float] = Field(default=None, ge=0, le=9999999)
    reason: Optional[str] = Field(default=None, max_length=200)
