"""Public HTTP routes: menu, orders and authentication."""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Header

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
async def create_order(order: OrderIn, background: BackgroundTasks, x_cliente: Optional[str] = Header(default=None)) -> dict:
    """Register an order sent by the public site and notify the staff phones.

    With a customer session (header X-Cliente) the order is also linked to the saved data,
    so it shows up in "Os meus pedidos" on any device.
    """
    result = await container.orders.create(order)
    result["saved"] = await container.clients.attach_order(x_cliente, result.get("id"))
    background.add_task(container.push.new_order, dict(result), order.customer_name, order.address_locality)
    if result.get("code"):
        result.pop("number", None)   # o cliente só vê o código, não quantos pedidos a loja já teve
    return result


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
