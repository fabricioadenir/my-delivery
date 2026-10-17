"""Pydantic schemas for ingredients, preparations and product recipes."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

Unit = Literal["g", "ml", "un"]
REF_PATTERN = r"^[ipc]:[0-9a-f-]{36}$"


class IngredientIn(BaseModel):
    """Ingredient or packaging item with its purchase price."""

    name: str = Field(min_length=1, max_length=120)
    kind: Literal["ingredient", "packaging"] = "ingredient"
    unit: Unit = "g"
    purchase_price: float = Field(ge=0, le=99999)
    purchase_qty: float = Field(gt=0, le=9999999)
    supplier: Optional[str] = Field(default=None, max_length=120)


class LineIn(BaseModel):
    """One recipe line. ref is 'i:<id>' ingredient, 'p:<id>' preparation or 'c:<id>' product."""

    ref: str = Field(pattern=REF_PATTERN)
    quantity: float = Field(gt=0, le=9999999)


class PreparationIn(BaseModel):
    """Intermediate recipe made in batches, with its yield."""

    name: str = Field(min_length=1, max_length=120)
    unit: Unit = "g"
    yield_qty: float = Field(gt=0, le=9999999)
    items: list[LineIn] = Field(default_factory=list, max_length=60)


class RecipeIn(BaseModel):
    """Recipe of a product and how many units it yields."""

    recipe_yield: float = Field(gt=0, le=9999)
    items: list[LineIn] = Field(default_factory=list, max_length=60)
