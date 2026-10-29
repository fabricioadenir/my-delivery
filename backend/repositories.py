"""Data-access classes. Every query to Supabase lives here."""
from typing import Any, Optional

from backend.supabase_client import SupabaseClient, SupabaseError

MENU_QUERIES = {
    "settings": {"select": "*", "limit": "1"},
    "opening_hours": {"select": "weekday,is_open,opens,closes,opens2,closes2", "order": "weekday.asc"},
    "delivery_zones": {"select": "id,name,fee,min_order,sort_order", "active": "eq.true", "order": "sort_order.asc"},
    "product_categories": {
        "select": "id,name,description,layout,sort_order,active", "deleted_at": "is.null", "order": "sort_order.asc",
    },
    "products": {
        "select": "id,category_id,name,description,price,min_qty,pieces,photo_url,photos,illustration,active,sort_order",
        "deleted_at": "is.null", "order": "sort_order.asc,name.asc",
    },
}
ORDER_QUERY = {
    "select": "*,order_items(product_name,quantity,unit_price,line_total)",
    "order": "created_at.desc", "limit": "50",
}


class TableRepository:
    """Generic read and write access to the tables exposed by PostgREST."""

    def __init__(self, client: SupabaseClient) -> None:
        """Keep the Supabase client."""
        self._client = client

    async def list(self, table: str, params: dict, token: Optional[str] = None) -> list:
        """Return the rows of a table that match the PostgREST params."""
        return await self._client.request("GET", f"/rest/v1/{table}", token, params=params) or []

    async def menu_table(self, table: str, token: Optional[str] = None) -> list:
        """Return one of the menu tables with its standard query."""
        return await self.list(table, MENU_QUERIES[table], token)

    async def insert(self, table: str, row: dict, token: str) -> dict:
        """Insert one row and return it."""
        rows = await self._client.request(
            "POST", f"/rest/v1/{table}", token, json=row, prefer="return=representation")
        return rows[0]

    async def update(self, table: str, column: str, value: Any, changes: dict, token: str) -> dict:
        """Update the row where column equals value and return it."""
        rows = await self._client.request(
            "PATCH", f"/rest/v1/{table}", token, json=changes,
            params={column: f"eq.{value}"}, prefer="return=representation")
        if not rows:
            raise SupabaseError(404, "Registo não encontrado ou sem permissão.")
        return rows[0]

    async def upsert(self, table: str, rows: list, conflict: str, token: str) -> None:
        """Insert rows, replacing the ones that already exist."""
        await self._client.request(
            "POST", f"/rest/v1/{table}", token, json=rows,
            params={"on_conflict": conflict}, prefer="resolution=merge-duplicates,return=minimal")

    async def rpc(self, function: str, args: dict, token: Optional[str] = None) -> Any:
        """Call a database function."""
        return await self._client.request("POST", f"/rest/v1/rpc/{function}", token, json=args)

    async def recent_orders(self, token: str) -> list:
        """Return the latest orders with their items."""
        return await self.list("orders", ORDER_QUERY, token)


class AuthRepository:
    """Access to Supabase Auth."""

    def __init__(self, client: SupabaseClient) -> None:
        """Keep the Supabase client."""
        self._client = client

    async def login(self, email: str, password: str) -> dict:
        """Exchange email and password for a session."""
        return await self._client.request(
            "POST", "/auth/v1/token", params={"grant_type": "password"},
            json={"email": email, "password": password})

    async def signup(self, email: str, password: str) -> dict:
        """Create an account; the session is absent when email confirmation is required."""
        return await self._client.request("POST", "/auth/v1/signup", json={"email": email, "password": password})


class PhotoRepository:
    """Storage of product photos."""

    def __init__(self, client: SupabaseClient) -> None:
        """Keep the Supabase client."""
        self._client = client

    async def upload(self, name: str, raw: bytes, mime: str, token: str) -> str:
        """Upload a photo and return its public URL."""
        await self._client.request("POST", self._client.upload_path(name), token, content=raw, content_type=mime)
        return self._client.public_file_url(name)
