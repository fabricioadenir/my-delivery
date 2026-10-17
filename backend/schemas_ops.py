"""Pydantic schemas for sessions, VAT settings and order tracking."""
from typing import Literal

from pydantic import BaseModel, Field

UUID_PATTERN = r"^[0-9a-f-]{36}$"


class RefreshIn(BaseModel):
    """Refresh token of a staff session."""

    refresh_token: str = Field(min_length=10, max_length=2000)


class VatIn(BaseModel):
    """VAT regime of the business and the rate used when a product has none."""

    vat_regime: Literal["por_definir", "isento", "normal"]
    default_vat_rate: float = Field(ge=0, lt=100)


class TrackingIn(BaseModel):
    """Order ids a customer wants to follow."""

    ids: list[str] = Field(min_length=1, max_length=20)
