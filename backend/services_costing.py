"""Business logic for ingredients, preparations, recipes and product costs."""
import asyncio
from datetime import datetime, timezone

from backend.repositories import TableRepository
from backend.schemas_costing import IngredientIn, LineIn, PreparationIn, RecipeIn
from backend.supabase_client import SupabaseError

RECIPE_COLUMNS = {"i": "ingredient_id", "p": "preparation_id", "c": "component_id"}
PREPARATION_COLUMNS = {"i": "ingredient_id", "p": "sub_preparation_id"}
QUERIES = {
    "ingredients": {"select": "*", "deleted_at": "is.null", "order": "name.asc"},
    "preparations": {
        "select": "id,name,unit,yield_qty,"
                  "preparation_items!preparation_items_preparation_id_fkey(ingredient_id,sub_preparation_id,quantity)",
        "deleted_at": "is.null", "order": "name.asc",
    },
    "recipe_items": {"select": "product_id,ingredient_id,preparation_id,component_id,quantity"},
    "products": {"select": "id,recipe_yield", "deleted_at": "is.null"},
}


class CostingService:
    """Keeps recipes up to date and reports what each product costs to make."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    @staticmethod
    def _rows(lines: list[LineIn], columns: dict[str, str]) -> list[dict]:
        """Turn recipe lines into database rows, rejecting kinds that have no column here."""
        rows = []
        for line in lines:
            kind, ref_id = line.ref.split(":", 1)
            if kind not in columns:
                raise SupabaseError(400, "Uma das linhas da ficha não é válida.")
            rows.append({columns[kind]: ref_id, "quantity": line.quantity})
        return rows

    async def data(self, token: str) -> dict:
        """Return ingredients, preparations, recipes and the current costs."""
        lists = [self._tables.list(name, params, token) for name, params in QUERIES.items()]
        costs = [self._tables.rpc("product_costs", {}, token), self._tables.rpc("preparation_costs", {}, token)]
        results = await asyncio.gather(*lists, *costs)
        ingredients, preparations, recipes, yields, product_costs, preparation_costs = results
        return {
            "ingredients": ingredients, "preparations": preparations, "recipe_items": recipes, "recipe_yields": yields,
            "product_costs": product_costs or [], "preparation_costs": preparation_costs or [],
        }

    async def _record_costs(self, token: str) -> None:
        """Store in the history the products whose cost has just changed."""
        await self._tables.rpc("snapshot_costs", {}, token)

    async def save_ingredient(self, ingredient_id: str | None, ingredient: IngredientIn, token: str) -> dict:
        """Create or update an ingredient and refresh the cost history."""
        row = ingredient.model_dump()
        if ingredient_id:
            saved = await self._tables.update("ingredients", "id", ingredient_id, row, token)
        else:
            saved = await self._tables.insert("ingredients", row, token)
        await self._record_costs(token)
        return saved

    async def remove(self, table: str, row_id: str, token: str) -> None:
        """Soft-delete an ingredient or a preparation."""
        changes = {"deleted_at": datetime.now(timezone.utc).isoformat()}
        await self._tables.update(table, "id", row_id, changes, token)

    async def save_preparation(self, preparation_id: str | None, preparation: PreparationIn, token: str) -> dict:
        """Create or replace a preparation with its ingredients and the preparations it uses."""
        rows = self._rows(preparation.items, PREPARATION_COLUMNS)
        if preparation_id and any(row.get("sub_preparation_id") == preparation_id for row in rows):
            raise SupabaseError(400, "Uma preparação não pode entrar nela própria.")
        args = {
            "p_id": preparation_id, "p_name": preparation.name.strip(), "p_unit": preparation.unit,
            "p_yield": preparation.yield_qty, "p_items": rows,
        }
        saved_id = await self._tables.rpc("save_preparation_tree", args, token)
        await self._record_costs(token)
        return {"id": saved_id}

    async def save_recipe(self, product_id: str, recipe: RecipeIn, token: str) -> None:
        """Replace the recipe of a product."""
        rows = self._rows(recipe.items, RECIPE_COLUMNS)
        if any(row.get("component_id") == product_id for row in rows):
            raise SupabaseError(400, "Um produto não pode entrar na sua própria ficha.")
        args = {"p_product": product_id, "p_yield": recipe.recipe_yield, "p_items": rows}
        await self._tables.rpc("save_recipe", args, token)
        await self._record_costs(token)
