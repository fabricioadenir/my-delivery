"""Admin HTTP routes for ingredients, preparations, recipes and costs."""
from fastapi import APIRouter, Depends

from backend.container import container
from backend.routes_admin import staff_token
from backend.schemas_costing import IngredientIn, PreparationIn, RecipeIn

router = APIRouter(prefix="/api/admin")
OK = {"ok": True}


@router.get("/costing")
async def costing(token: str = Depends(staff_token)) -> dict:
    """Return ingredients, preparations, recipes and current costs."""
    return await container.costing.data(token)


@router.post("/ingredients")
async def create_ingredient(ingredient: IngredientIn, token: str = Depends(staff_token)) -> dict:
    """Create an ingredient or packaging item."""
    return await container.costing.save_ingredient(None, ingredient, token)


@router.put("/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: str, ingredient: IngredientIn, token: str = Depends(staff_token)) -> dict:
    """Update an ingredient; affected product costs are recalculated."""
    return await container.costing.save_ingredient(ingredient_id, ingredient, token)


@router.delete("/ingredients/{ingredient_id}")
async def delete_ingredient(ingredient_id: str, token: str = Depends(staff_token)) -> dict:
    """Remove an ingredient from the lists."""
    await container.costing.remove("ingredients", ingredient_id, token)
    return OK


@router.post("/preparations")
async def create_preparation(preparation: PreparationIn, token: str = Depends(staff_token)) -> dict:
    """Create a preparation."""
    return await container.costing.save_preparation(None, preparation, token)


@router.put("/preparations/{preparation_id}")
async def update_preparation(preparation_id: str, preparation: PreparationIn, token: str = Depends(staff_token)) -> dict:
    """Replace a preparation and its ingredients."""
    return await container.costing.save_preparation(preparation_id, preparation, token)


@router.delete("/preparations/{preparation_id}")
async def delete_preparation(preparation_id: str, token: str = Depends(staff_token)) -> dict:
    """Remove a preparation from the lists."""
    await container.costing.remove("preparations", preparation_id, token)
    return OK


@router.put("/products/{product_id}/recipe")
async def save_recipe(product_id: str, recipe: RecipeIn, token: str = Depends(staff_token)) -> dict:
    """Replace the recipe of a product."""
    await container.costing.save_recipe(product_id, recipe, token)
    return OK
