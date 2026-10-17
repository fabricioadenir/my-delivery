"""Admin HTTP routes. Every route requires a staff session."""
from typing import Optional

from fastapi import APIRouter, Depends, Header

from backend.container import container
from backend.schemas import CategoryIn, CategoryOrderIn, PhotoIn, ProductIn, StatusIn, StoreIn
from backend.supabase_client import SupabaseError


async def staff_token(authorization: Optional[str] = Header(default=None)) -> str:
    """Extract the bearer token and check that it belongs to the staff."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise SupabaseError(401, "Sessão em falta. Entre de novo.")
    token = authorization[7:].strip()
    await container.auth.require_staff(token)
    return token


router = APIRouter(prefix="/api/admin")
OK = {"ok": True}


@router.get("/data")
async def data(token: str = Depends(staff_token)) -> dict:
    """Return the full menu, store settings and latest orders."""
    return await container.admin.data(token)


@router.post("/products")
async def create_product(product: ProductIn, token: str = Depends(staff_token)) -> dict:
    """Create a product."""
    return await container.admin.save_product(None, product, token)


@router.post("/products/order")
async def order_products(order: CategoryOrderIn, token: str = Depends(staff_token)) -> dict:
    """Save the display order of the products of one category."""
    await container.admin.order_products(order.ids, token)
    return OK


@router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductIn, token: str = Depends(staff_token)) -> dict:
    """Update a product."""
    return await container.admin.save_product(product_id, product, token)


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, token: str = Depends(staff_token)) -> dict:
    """Remove a product from the menu."""
    await container.admin.remove("products", product_id, token)
    return OK


@router.post("/categories")
async def create_category(category: CategoryIn, token: str = Depends(staff_token)) -> dict:
    """Create a category."""
    return await container.admin.save_category(None, category, token)


@router.post("/categories/order")
async def order_categories(order: CategoryOrderIn, token: str = Depends(staff_token)) -> dict:
    """Save the display order of the categories."""
    await container.admin.order_categories(order.ids, token)
    return OK


@router.put("/categories/{category_id}")
async def update_category(category_id: str, category: CategoryIn, token: str = Depends(staff_token)) -> dict:
    """Update a category."""
    return await container.admin.save_category(category_id, category, token)


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, token: str = Depends(staff_token)) -> dict:
    """Remove an empty category."""
    await container.admin.remove("product_categories", category_id, token)
    return OK


@router.put("/store")
async def save_store(store: StoreIn, token: str = Depends(staff_token)) -> dict:
    """Save opening hours, zones, minimum order and preparation time."""
    await container.admin.save_store(store, token)
    return OK


@router.post("/photo")
async def upload_photo(photo: PhotoIn, token: str = Depends(staff_token)) -> dict:
    """Upload a product photo."""
    return await container.admin.upload_photo(photo, token)


@router.patch("/orders/{order_id}")
async def set_order_status(order_id: str, body: StatusIn, token: str = Depends(staff_token)) -> dict:
    """Change the status of an order."""
    await container.admin.set_order_status(order_id, body.status, token)
    return OK
