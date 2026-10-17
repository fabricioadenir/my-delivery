"""Public HTTP routes: menu, orders and authentication."""
from fastapi import APIRouter

from backend.container import container
from backend.schemas import CredentialsIn, OrderIn

router = APIRouter(prefix="/api")


@router.get("/health")
async def health() -> dict:
    """Report that the API is running."""
    return {"ok": True}


@router.get("/menu")
async def menu() -> dict:
    """Return the public menu and store settings."""
    return await container.menu.menu()


@router.post("/orders")
async def create_order(order: OrderIn) -> dict:
    """Register an order sent by the public site."""
    return await container.orders.create(order)


@router.get("/auth/status")
async def auth_status() -> dict:
    """Tell whether the store already has an owner account."""
    return {"admin_exists": await container.auth.admin_exists()}


@router.post("/auth/login")
async def login(credentials: CredentialsIn) -> dict:
    """Log a staff member in."""
    return await container.auth.login(credentials)


@router.post("/auth/signup")
async def signup(credentials: CredentialsIn) -> dict:
    """Create the owner account while the store has none."""
    return await container.auth.signup(credentials)
