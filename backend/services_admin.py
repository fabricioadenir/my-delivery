"""Business logic for the admin area."""
import base64
import binascii
import re
import uuid
from datetime import datetime, timezone

from backend.repositories import PhotoRepository, TableRepository
from backend.schemas import CategoryIn, PhotoIn, ProductIn, StoreIn
from backend.services_public import MenuService
from backend.supabase_client import SupabaseError

DATA_URL = re.compile(r"^data:image/(jpeg|png|webp);base64,(.+)$", re.S)


def slugify(text: str) -> str:
    """Build a unique URL-safe identifier from a name."""
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"
    return f"{base[:40]}-{uuid.uuid4().hex[:6]}"


class AdminService:
    """Menu, store settings, photos and order status, for staff only."""

    def __init__(self, tables: TableRepository, photos: PhotoRepository, menu: MenuService) -> None:
        """Keep the repositories and the menu service."""
        self._tables = tables
        self._photos = photos
        self._menu = menu

    async def data(self, token: str) -> dict:
        """Return the full menu (hidden products included) and the latest orders."""
        data = await self._menu.menu(token)
        data["orders"] = await self._tables.recent_orders(token)
        return data

    async def save_product(self, product_id: str | None, product: ProductIn, token: str) -> dict:
        """Create or update a product."""
        row = product.model_dump()
        if product_id:
            return await self._tables.update("products", "id", product_id, row, token)
        row["slug"] = slugify(product.name)
        row["sort_order"] = 999
        return await self._tables.insert("products", row, token)

    async def save_category(self, category_id: str | None, category: CategoryIn, token: str) -> dict:
        """Create or update a category."""
        row = category.model_dump()
        if category_id:
            return await self._tables.update("product_categories", "id", category_id, row, token)
        row["slug"] = slugify(category.name)
        row["sort_order"] = 999
        return await self._tables.insert("product_categories", row, token)

    async def remove(self, table: str, row_id: str, token: str) -> None:
        """Soft-delete a product or a category."""
        changes = {"deleted_at": datetime.now(timezone.utc).isoformat(), "active": False}
        await self._tables.update(table, "id", row_id, changes, token)

    async def order_categories(self, ids: list[str], token: str) -> None:
        """Store the display order of the categories."""
        for position, category_id in enumerate(ids, start=1):
            await self._tables.update("product_categories", "id", category_id, {"sort_order": position}, token)

    async def order_products(self, ids: list[str], token: str) -> None:
        """Store the display order of products in a single database call."""
        await self._tables.rpc("reorder_products", {"p_ids": ids}, token)

    async def _save_zones(self, store: StoreIn, token: str) -> None:
        """Update, create and deactivate delivery zones to match the form."""
        current = {zone["id"] for zone in await self._tables.menu_table("delivery_zones", token)}
        kept = set()
        for position, zone in enumerate(store.zones, start=1):
            row = {"name": zone.name.strip(), "fee": zone.fee, "sort_order": position, "active": True}
            if zone.id in current:
                kept.add(zone.id)
                await self._tables.update("delivery_zones", "id", zone.id, row, token)
            else:
                row["slug"] = slugify(zone.name)
                await self._tables.insert("delivery_zones", row, token)
        for zone_id in current - kept:
            await self._tables.update("delivery_zones", "id", zone_id, {"active": False}, token)

    async def save_store(self, store: StoreIn, token: str) -> None:
        """Save minimum order, preparation time, opening hours and zones."""
        for hour in store.hours:
            if hour.is_open and not (hour.opens and hour.closes and hour.opens < hour.closes):
                raise SupabaseError(400, "A hora de fecho tem de ser depois da de abertura.")
        settings = {"min_order": store.min_order, "prep_minutes": store.prep_minutes}
        await self._tables.update("settings", "id", "true", settings, token)
        hours = [
            {"weekday": h.weekday, "is_open": h.is_open,
             "opens": h.opens if h.is_open else None, "closes": h.closes if h.is_open else None}
            for h in store.hours
        ]
        await self._tables.upsert("opening_hours", hours, "weekday", token)
        await self._save_zones(store, token)

    async def upload_photo(self, photo: PhotoIn, token: str) -> dict:
        """Store a product photo and return its public URL."""
        match = DATA_URL.match(photo.data_url)
        if not match:
            raise SupabaseError(400, "Imagem inválida. Use JPEG, PNG ou WebP.")
        try:
            raw = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as error:
            raise SupabaseError(400, "Imagem inválida.") from error
        kind = match.group(1)
        name = f"{uuid.uuid4().hex}.{'jpg' if kind == 'jpeg' else kind}"
        return {"url": await self._photos.upload(name, raw, f"image/{kind}", token)}

    async def set_order_status(self, order_id: str, status: str, token: str) -> None:
        """Change the status of an order and record who changed it."""
        await self._tables.rpc("set_order_status", {"p_order": order_id, "p_status": status}, token)
