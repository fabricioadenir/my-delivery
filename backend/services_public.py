"""Business logic for the public site and for authentication."""
import asyncio
import logging
import re
from typing import Optional

from backend.repositories import AuthRepository, TableRepository
from backend.schemas import CredentialsIn, OrderIn
from backend.supabase_client import SupabaseError

logger = logging.getLogger(__name__)
MENU_TABLES = ("settings", "opening_hours", "delivery_zones", "product_categories", "products")
AUTH_MESSAGES = {
    "Invalid login credentials": "Email ou palavra-passe errados.",
    "Email not confirmed": "Confirme primeiro o email: abra a mensagem que recebeu e carregue na ligação.",
    "User already registered": "Já existe uma conta com esse email. Use Entrar.",
}


class MenuService:
    """Builds the menu and store settings shown on the public site."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    async def menu(self, token: Optional[str] = None) -> dict:
        """Return settings, hours, zones, categories and products in one payload."""
        results = await asyncio.gather(*(self._tables.menu_table(name, token) for name in MENU_TABLES))
        settings, hours, zones, categories, products = results
        return {
            "settings": settings[0] if settings else {}, "hours": hours, "zones": zones,
            "categories": categories, "products": products,
        }


class OrderService:
    """Creates orders. Prices and totals are always computed in the database."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    @staticmethod
    def _clean_amount(text: Optional[str]) -> Optional[str]:
        """Turn free text such as '50 €' or '20,50' into a numeric string, or None."""
        digits = re.sub(r"[^0-9,.]", "", text or "").replace(",", ".")
        return digits if re.fullmatch(r"[0-9]+(\.[0-9]{1,2})?", digits) else None

    async def create(self, order: OrderIn) -> dict:
        """Register an order and return its number, items and totals."""
        payload = order.model_dump()
        payload["change_for"] = self._clean_amount(order.change_for)
        result = await self._tables.rpc("create_order", {"p": payload})
        logger.info("Order created", extra={"order_number": result.get("number")})
        return result


class AuthService:
    """Login, first-owner signup and permission checks."""

    def __init__(self, auth: AuthRepository, tables: TableRepository) -> None:
        """Keep the repositories."""
        self._auth = auth
        self._tables = tables

    @staticmethod
    def _translate(error: SupabaseError) -> SupabaseError:
        """Replace known Supabase Auth messages with Portuguese ones."""
        return SupabaseError(error.status, AUTH_MESSAGES.get(error.message, error.message))

    async def admin_exists(self) -> bool:
        """Tell whether the store already has an owner account."""
        return bool(await self._tables.rpc("admin_exists", {}))

    async def _session(self, data: dict) -> dict:
        """Turn a Supabase session into the response sent to the browser."""
        token = data.get("access_token")
        if not token:
            return {"token": None, "staff": False, "confirm": True}
        staff = bool(await self._tables.rpc("claim_admin", {}, token))
        return {"token": token, "staff": staff, "confirm": False}

    async def login(self, credentials: CredentialsIn) -> dict:
        """Log in and report whether the account belongs to the staff."""
        try:
            data = await self._auth.login(credentials.email.strip(), credentials.password)
        except SupabaseError as error:
            raise self._translate(error) from error
        return await self._session(data)

    async def signup(self, credentials: CredentialsIn) -> dict:
        """Create the owner account; allowed only while the store has no owner."""
        if await self.admin_exists():
            raise SupabaseError(403, "A loja já tem uma conta de dono.")
        try:
            data = await self._auth.signup(credentials.email.strip(), credentials.password)
        except SupabaseError as error:
            raise self._translate(error) from error
        return await self._session(data)

    async def require_staff(self, token: str) -> None:
        """Raise unless the token belongs to a staff member."""
        if not await self._tables.rpc("is_staff", {}, token):
            raise SupabaseError(403, "Esta conta não tem acesso à gestão.")
