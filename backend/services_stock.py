"""Business logic for stock, purchases and suppliers."""
import asyncio
from datetime import date, datetime, timedelta, timezone

from backend.repositories import TableRepository
from backend.schemas_stock import PurchaseIn, StockActionIn, SupplierIn

EXPIRY_WINDOW_DAYS = 3
INGREDIENTS = {
    "select": "id,name,kind,unit,unit_cost,stock_qty,min_stock", "deleted_at": "is.null", "order": "name.asc",
}
SUPPLIERS = {"select": "id,name,nif,phone,notes", "deleted_at": "is.null", "order": "name.asc"}
PURCHASES = {
    "select": "id,purchased_on,total,suppliers(name),"
              "purchase_items(quantity,total_price,lot,expires_on,ingredients(name,unit))",
    "order": "purchased_on.desc,created_at.desc", "limit": "10",
}


class StockService:
    """Tracks what is in stock, what was bought and what was lost."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    @staticmethod
    def _expiring_query(today: date) -> dict:
        """Build the query for purchased lots whose expiry date is near or just passed."""
        first, last = today - timedelta(days=EXPIRY_WINDOW_DAYS), today + timedelta(days=EXPIRY_WINDOW_DAYS)
        return {
            "select": "expires_on,lot,quantity,ingredients(name,unit)",
            "and": f"(expires_on.gte.{first.isoformat()},expires_on.lte.{last.isoformat()})",
            "order": "expires_on.asc",
        }

    async def data(self, token: str) -> dict:
        """Return stock levels, suppliers, recent purchases, expiring lots and waste value."""
        today = datetime.now(timezone.utc).date()
        results = await asyncio.gather(
            self._tables.list("ingredients", INGREDIENTS, token),
            self._tables.list("suppliers", SUPPLIERS, token),
            self._tables.list("purchases", PURCHASES, token),
            self._tables.list("purchase_items", self._expiring_query(today), token),
            self._tables.rpc("waste_month", {}, token),
        )
        ingredients, suppliers, purchases, expiring, waste = results
        return {
            "ingredients": ingredients, "suppliers": suppliers, "purchases": purchases,
            "expiring": expiring, "waste_month": float(waste or 0),
        }

    async def save_supplier(self, supplier_id: str | None, supplier: SupplierIn, token: str) -> dict:
        """Create or update a supplier."""
        row = supplier.model_dump()
        if supplier_id:
            return await self._tables.update("suppliers", "id", supplier_id, row, token)
        return await self._tables.insert("suppliers", row, token)

    async def remove_supplier(self, supplier_id: str, token: str) -> None:
        """Soft-delete a supplier."""
        changes = {"deleted_at": datetime.now(timezone.utc).isoformat()}
        await self._tables.update("suppliers", "id", supplier_id, changes, token)

    async def register_purchase(self, purchase: PurchaseIn, token: str) -> dict:
        """Register a purchase; stock, purchase prices and product costs are updated."""
        return await self._tables.rpc("register_purchase", {"p": purchase.model_dump()}, token)

    async def stock_action(self, ingredient_id: str, action: StockActionIn, token: str) -> None:
        """Apply a count, a waste record or a minimum stock to an ingredient."""
        args = {
            "p_ingredient": ingredient_id, "p_action": action.action,
            "p_quantity": action.quantity, "p_reason": action.reason,
        }
        await self._tables.rpc("stock_action", args, token)
