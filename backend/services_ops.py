"""Business logic for staff sessions, the admin home, customers and reports."""
import asyncio
import re

from backend.repositories import TableRepository
from backend.schemas import CredentialsIn
from backend.schemas_ops import UUID_PATTERN, VatIn
from backend.services_public import AUTH_MESSAGES
from backend.supabase_client import SupabaseClient, SupabaseError


class SessionService:
    """Staff sessions that can be renewed without typing the password again."""

    def __init__(self, client: SupabaseClient, tables: TableRepository) -> None:
        """Keep the Supabase client and the table repository."""
        self._client = client
        self._tables = tables

    async def _token(self, grant: str, body: dict) -> dict:
        """Ask Supabase Auth for a session and report whether it belongs to the staff."""
        try:
            data = await self._client.request("POST", "/auth/v1/token", params={"grant_type": grant}, json=body)
        except SupabaseError as error:
            raise SupabaseError(error.status, AUTH_MESSAGES.get(error.message, error.message)) from error
        token = data.get("access_token")
        if not token:
            raise SupabaseError(401, "Sessão terminada. Entre de novo.")
        staff = bool(await self._tables.rpc("claim_admin", {}, token))
        return {"token": token, "refresh": data.get("refresh_token"), "staff": staff}

    async def login(self, credentials: CredentialsIn) -> dict:
        """Log in with email and password."""
        return await self._token("password", {"email": credentials.email.strip(), "password": credentials.password})

    async def refresh(self, refresh_token: str) -> dict:
        """Renew a session from its refresh token."""
        return await self._token("refresh_token", {"refresh_token": refresh_token})


class OperationsService:
    """Daily operation: home summary, customers, exports, VAT and order tracking."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    async def home(self, today: str, month_start: str, token: str) -> dict:
        """Return today's and this month's results, the latest orders and the alerts."""
        results = await asyncio.gather(
            self._tables.rpc("dashboard", {"p_from": today, "p_to": today}, token),
            self._tables.rpc("dashboard", {"p_from": month_start, "p_to": today}, token),
            self._tables.recent_orders(token),
            self._tables.rpc("alerts", {}, token),
        )
        return {"today": results[0], "month": results[1], "orders": results[2], "alerts": results[3]}

    async def customers(self, token: str) -> list:
        """Return every customer with order count, total spent and favourite product."""
        return await self._tables.rpc("customers_summary", {}, token) or []

    async def report(self, start: str, end: str, token: str) -> dict:
        """Return orders, products sold and expenses of a period, ready to export."""
        return await self._tables.rpc("report", {"p_from": start, "p_to": end}, token)

    async def save_vat(self, vat: VatIn, token: str) -> None:
        """Save the VAT regime and the default rate."""
        await self._tables.update("settings", "id", "true", vat.model_dump(), token)

    async def tracking(self, ids: list[str]) -> list:
        """Return number and status of the orders a customer holds the ids of."""
        valid = [order_id for order_id in ids if re.fullmatch(UUID_PATTERN, order_id)]
        return await self._tables.rpc("order_tracking", {"p_ids": valid}) or []
