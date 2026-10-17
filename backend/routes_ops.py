"""HTTP routes for sessions, order tracking, the admin home, customers and reports."""
from fastapi import APIRouter, Depends, Query

from backend.container import container
from backend.routes_admin import staff_token
from backend.schemas import CredentialsIn
from backend.schemas_finance import DATE_PATTERN
from backend.schemas_ops import RefreshIn, TrackingIn, VatIn

public_router = APIRouter(prefix="/api")
admin_router = APIRouter(prefix="/api/admin")


@public_router.post("/session/login")
async def session_login(credentials: CredentialsIn) -> dict:
    """Log a staff member in and return a renewable session."""
    return await container.sessions.login(credentials)


@public_router.post("/session/refresh")
async def session_refresh(body: RefreshIn) -> dict:
    """Renew a staff session."""
    return await container.sessions.refresh(body.refresh_token)


@public_router.post("/orders/status")
async def order_status(body: TrackingIn) -> list:
    """Return the status of the orders whose ids the customer holds."""
    return await container.operations.tracking(body.ids)


@admin_router.get("/home")
async def home(
    today: str = Query(pattern=DATE_PATTERN), month_start: str = Query(pattern=DATE_PATTERN),
    token: str = Depends(staff_token),
) -> dict:
    """Return the summary shown when the staff opens the admin area."""
    return await container.operations.home(today, month_start, token)


@admin_router.get("/customers")
async def customers(token: str = Depends(staff_token)) -> list:
    """Return the customer list with totals."""
    return await container.operations.customers(token)


@admin_router.get("/reports")
async def reports(
    start: str = Query(pattern=DATE_PATTERN), end: str = Query(pattern=DATE_PATTERN),
    token: str = Depends(staff_token),
) -> dict:
    """Return the data of a period for export."""
    return await container.operations.report(start, end, token)


@admin_router.put("/vat")
async def save_vat(vat: VatIn, token: str = Depends(staff_token)) -> dict:
    """Save the VAT regime and default rate."""
    await container.operations.save_vat(vat, token)
    return {"ok": True}
