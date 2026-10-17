"""Admin HTTP routes for the results dashboard, fixed costs and expenses."""
from fastapi import APIRouter, Depends, Query

from backend.container import container
from backend.routes_admin import staff_token
from backend.schemas_finance import DATE_PATTERN, ExpenseIn, FinanceSettingsIn, FixedCostIn

router = APIRouter(prefix="/api/admin")
OK = {"ok": True}


@router.get("/dashboard")
async def dashboard(
    start: str = Query(pattern=DATE_PATTERN), end: str = Query(pattern=DATE_PATTERN),
    token: str = Depends(staff_token),
) -> dict:
    """Return sales, costs and estimated result between two dates."""
    return await container.finance.dashboard(start, end, token)


@router.get("/finance")
async def finance(token: str = Depends(staff_token)) -> dict:
    """Return fixed costs, recent expenses and delivery cost settings."""
    return await container.finance.data(token)


@router.put("/finance/settings")
async def save_settings(settings: FinanceSettingsIn, token: str = Depends(staff_token)) -> dict:
    """Save cost per kilometre, profit goal and zone distances."""
    await container.finance.save_settings(settings, token)
    return OK


@router.post("/fixed-costs")
async def create_fixed_cost(cost: FixedCostIn, token: str = Depends(staff_token)) -> dict:
    """Create a fixed cost."""
    return await container.finance.save_fixed_cost(None, cost, token)


@router.put("/fixed-costs/{cost_id}")
async def update_fixed_cost(cost_id: str, cost: FixedCostIn, token: str = Depends(staff_token)) -> dict:
    """Update a fixed cost."""
    return await container.finance.save_fixed_cost(cost_id, cost, token)


@router.delete("/fixed-costs/{cost_id}")
async def delete_fixed_cost(cost_id: str, token: str = Depends(staff_token)) -> dict:
    """Remove a fixed cost."""
    await container.finance.remove("fixed_costs", cost_id, token)
    return OK


@router.post("/expenses")
async def add_expense(expense: ExpenseIn, token: str = Depends(staff_token)) -> dict:
    """Register an expense."""
    return await container.finance.add_expense(expense, token)


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, token: str = Depends(staff_token)) -> dict:
    """Remove an expense."""
    await container.finance.remove("expenses", expense_id, token)
    return OK
