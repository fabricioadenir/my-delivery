"""Pydantic schemas for request bodies."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

OrderStatus = Literal["received", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]


class OrderItemIn(BaseModel):
    """One line of an order: product and quantity."""

    product_id: str
    quantity: int = Field(ge=1, le=99)


class OrderIn(BaseModel):
    """Order sent by the public site. Prices are never accepted from the client."""

    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(min_length=9, max_length=30)
    zone_id: str
    address_street: str = Field(min_length=1, max_length=200)
    address_locality: str = Field(min_length=1, max_length=120)
    address_reference: Optional[str] = Field(default=None, max_length=300)
    asap: bool = False
    deliver_at_local: Optional[str] = Field(default=None, max_length=20)
    items: list[OrderItemIn] = Field(min_length=1, max_length=60)
    payment_method: Optional[str] = Field(default=None, max_length=40)
    change_for: Optional[str] = Field(default=None, max_length=40)
    extras: dict[str, Any] = Field(default_factory=dict)
    allergy_notes: Optional[str] = Field(default=None, max_length=1000)


class CredentialsIn(BaseModel):
    """Email and password of a staff account."""

    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=6, max_length=200)


class ProductIn(BaseModel):
    """Product as edited in the admin area."""

    category_id: str
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=600)
    price: float = Field(ge=0, le=9999)
    min_qty: int = Field(default=1, ge=1, le=99)
    pieces: Optional[int] = Field(default=None, ge=1, le=999)
    photo_url: Optional[str] = Field(default=None, max_length=600)
    active: bool = True


class CategoryIn(BaseModel):
    """Menu category as edited in the admin area."""

    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=300)
    layout: Literal["cards", "list"] = "list"


class CategoryOrderIn(BaseModel):
    """Category ids in the order they should appear."""

    ids: list[str] = Field(min_length=1, max_length=100)


class HourIn(BaseModel):
    """Opening hours of one weekday (0 = Sunday)."""

    weekday: int = Field(ge=0, le=6)
    is_open: bool
    opens: Optional[str] = Field(default=None, max_length=8)
    closes: Optional[str] = Field(default=None, max_length=8)


class ZoneIn(BaseModel):
    """Delivery zone with its fee; id is empty for a new zone."""

    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=80)
    fee: float = Field(ge=0, le=999)


class StoreIn(BaseModel):
    """Store settings edited together in the admin area."""

    min_order: float = Field(ge=0, le=9999)
    prep_minutes: int = Field(ge=0, le=600)
    hours: list[HourIn] = Field(min_length=7, max_length=7)
    zones: list[ZoneIn] = Field(min_length=1, max_length=30)


class StatusIn(BaseModel):
    """New status for an order."""

    status: OrderStatus


class PhotoIn(BaseModel):
    """Product photo as a base64 data URL."""

    data_url: str = Field(min_length=30, max_length=1_500_000)
