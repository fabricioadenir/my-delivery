"""Optional customer data saved in the database, tied to the phone number and protected by a PIN.

All checks (PIN hash, attempt limits, sessions, recovery codes) live in the database functions
``client_*``; this service only forwards the calls.
"""
import logging
from typing import Optional

from backend.repositories import TableRepository
from backend.supabase_client import SupabaseError

logger = logging.getLogger(__name__)


class ClientService:
    """Sign-up, PIN login, saved data, recovery link and order linking for customers."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    async def signup(self, name: str, phone: str, pin: str, addresses: list) -> dict:
        """Create the saved data for a phone number and start a session."""
        return await self._tables.rpc("client_signup", {"p": {"nome": name, "tel": phone, "pin": pin, "moradas": addresses}})

    async def login(self, phone: str, pin: str) -> dict:
        """Start a session with phone and PIN; wrong PINs count towards the lock."""
        result = await self._tables.rpc("client_login", {"p_tel": phone, "p_pin": pin})
        if result and result.get("erro"):
            raise SupabaseError(404 if result.get("sem_conta") else 403, result["erro"])
        return result

    async def me(self, token: str) -> dict:
        """Return the saved data and the orders made with the session."""
        return await self._tables.rpc("client_me", {"p_token": token})

    async def update(self, token: str, changes: dict) -> dict:
        """Change name and/or saved addresses."""
        return await self._tables.rpc("client_update", {"p_token": token, "p": changes})

    async def change_pin(self, token: str, old: str, new: str) -> None:
        """Change the PIN, checking the current one."""
        await self._tables.rpc("client_change_pin", {"p_token": token, "p_old": old, "p_new": new})

    async def logout(self, token: str) -> None:
        """End the session on this device."""
        await self._tables.rpc("client_logout", {"p_token": token})

    async def delete(self, token: str) -> None:
        """Delete the saved data (orders stay for the store, without the link)."""
        await self._tables.rpc("client_delete", {"p_token": token})

    async def recover_info(self, code: str) -> Optional[dict]:
        """First name and last digits for a recovery link, or None if it is not valid."""
        return await self._tables.rpc("client_recover_info", {"p_code": code})

    async def recover(self, code: str, pin: str) -> dict:
        """Set a new PIN from a recovery link and start a session."""
        return await self._tables.rpc("client_recover", {"p_code": code, "p_pin": pin})

    async def attach_order(self, token: Optional[str], order_id: Optional[str]) -> bool:
        """Link a just-created order to the customer's saved data; never fails the order."""
        if not token or not order_id:
            return False
        try:
            await self._tables.rpc("client_attach_order", {"p_token": token, "p_order": order_id})
            return True
        except SupabaseError as error:
            logger.warning("Could not link order to customer", extra={"status": error.status})
            return False

    async def staff_accounts(self, token: str) -> list:
        """Phones with saved data and their recovery codes (staff only)."""
        return await self._tables.rpc("client_accounts_staff", {}, token)
