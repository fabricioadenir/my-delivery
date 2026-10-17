"""Admin HTTP routes for stock, purchases and suppliers."""
from fastapi import APIRouter, Depends

from backend.container import container
from backend.routes_admin import staff_token
from backend.schemas_stock import PurchaseIn, StockActionIn, SupplierIn

router = APIRouter(prefix="/api/admin")
OK = {"ok": True}


@router.get("/stock")
async def stock(token: str = Depends(staff_token)) -> dict:
    """Return stock levels, suppliers, recent purchases and alerts."""
    return await container.stock.data(token)


@router.post("/stock/{ingredient_id}")
async def stock_action(ingredient_id: str, action: StockActionIn, token: str = Depends(staff_token)) -> dict:
    """Record a count, a loss or the minimum stock of an ingredient."""
    await container.stock.stock_action(ingredient_id, action, token)
    return OK


@router.post("/purchases")
async def register_purchase(purchase: PurchaseIn, token: str = Depends(staff_token)) -> dict:
    """Register a purchase and return the price changes it caused."""
    return await container.stock.register_purchase(purchase, token)


@router.post("/suppliers")
async def create_supplier(supplier: SupplierIn, token: str = Depends(staff_token)) -> dict:
    """Create a supplier."""
    return await container.stock.save_supplier(None, supplier, token)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, supplier: SupplierIn, token: str = Depends(staff_token)) -> dict:
    """Update a supplier."""
    return await container.stock.save_supplier(supplier_id, supplier, token)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, token: str = Depends(staff_token)) -> dict:
    """Remove a supplier from the lists."""
    await container.stock.remove_supplier(supplier_id, token)
    return OK
