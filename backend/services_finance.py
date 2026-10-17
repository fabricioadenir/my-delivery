"""Business logic for the results dashboard, fixed costs and expenses."""
import asyncio
from datetime import datetime, timezone

from backend.repositories import TableRepository
from backend.schemas_finance import ExpenseIn, FinanceSettingsIn, FixedCostIn

FIXED_COSTS = {"select": "id,name,monthly_amount", "deleted_at": "is.null", "order": "name.asc"}
EXPENSES = {
    "select": "id,spent_on,category,description,amount", "deleted_at": "is.null",
    "order": "spent_on.desc,created_at.desc", "limit": "30",
}
ZONES = {"select": "id,name,fee,distance_km", "active": "eq.true", "order": "sort_order.asc"}
SETTINGS = {"select": "cost_per_km,profit_goal,vat_regime,default_vat_rate", "limit": "1"}


class FinanceService:
    """Answers how much was sold and earned, and keeps the costs behind it."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    async def dashboard(self, start: str, end: str, token: str) -> dict:
        """Return the results of a period; every figure is computed in the database."""
        args = {"p_from": start, "p_to": end}
        result, extras = await asyncio.gather(
            self._tables.rpc("dashboard", args, token), self._tables.rpc("period_extras", args, token))
        result["extras"] = extras
        return result

    async def data(self, token: str) -> dict:
        """Return fixed costs, recent expenses, zone distances and cost settings."""
        fixed, expenses, zones, settings = await asyncio.gather(
            self._tables.list("fixed_costs", FIXED_COSTS, token),
            self._tables.list("expenses", EXPENSES, token),
            self._tables.list("delivery_zones", ZONES, token),
            self._tables.list("settings", SETTINGS, token),
        )
        return {
            "fixed_costs": fixed, "expenses": expenses, "zones": zones,
            "settings": settings[0] if settings else {"cost_per_km": 0, "profit_goal": 0},
        }

    async def save_fixed_cost(self, cost_id: str | None, cost: FixedCostIn, token: str) -> dict:
        """Create or update a fixed cost."""
        row = cost.model_dump()
        if cost_id:
            return await self._tables.update("fixed_costs", "id", cost_id, row, token)
        return await self._tables.insert("fixed_costs", row, token)

    async def add_expense(self, expense: ExpenseIn, token: str) -> dict:
        """Register an expense; the date defaults to today in the database."""
        row = {key: value for key, value in expense.model_dump().items() if value is not None}
        return await self._tables.insert("expenses", row, token)

    async def remove(self, table: str, row_id: str, token: str) -> None:
        """Soft-delete a fixed cost or an expense."""
        changes = {"deleted_at": datetime.now(timezone.utc).isoformat()}
        await self._tables.update(table, "id", row_id, changes, token)

    async def save_settings(self, settings: FinanceSettingsIn, token: str) -> None:
        """Save the cost per kilometre, the profit goal and the zone distances."""
        changes = {"cost_per_km": settings.cost_per_km, "profit_goal": settings.profit_goal}
        await self._tables.update("settings", "id", "true", changes, token)
        for zone in settings.zones:
            await self._tables.update("delivery_zones", "id", zone.id, {"distance_km": zone.distance_km}, token)
