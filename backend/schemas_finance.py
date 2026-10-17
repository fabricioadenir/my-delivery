"""Pydantic schemas for fixed costs, expenses and delivery cost settings."""
from typing import Optional

from pydantic import BaseModel, Field

UUID_PATTERN = r"^[0-9a-f-]{36}$"
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class FixedCostIn(BaseModel):
    """Cost paid every month, whatever the sales."""

    name: str = Field(min_length=1, max_length=120)
    monthly_amount: float = Field(ge=0, le=999999)


class ExpenseIn(BaseModel):
    """One-off expense that is neither an ingredient purchase nor a fixed cost."""

    spent_on: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    category: str = Field(min_length=1, max_length=60)
    description: Optional[str] = Field(default=None, max_length=200)
    amount: float = Field(gt=0, le=999999)


class ZoneDistanceIn(BaseModel):
    """Round-trip distance of a delivery zone."""

    id: str = Field(pattern=UUID_PATTERN)
    distance_km: float = Field(ge=0, le=999)


class FinanceSettingsIn(BaseModel):
    """Cost per kilometre, monthly profit goal and zone distances."""

    cost_per_km: float = Field(ge=0, le=99)
    profit_goal: float = Field(ge=0, le=9999999)
    zones: list[ZoneDistanceIn] = Field(default_factory=list, max_length=30)
