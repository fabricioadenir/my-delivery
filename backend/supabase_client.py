"""Infrastructure client for the Supabase REST, Auth and Storage APIs."""
import logging
from typing import Any, Optional

import httpx

from backend.config import Config

logger = logging.getLogger(__name__)
PASS_THROUGH = (400, 401, 403, 404, 409, 422)


class SupabaseError(Exception):
    """Error returned by Supabase, with the HTTP status to send to the client."""

    def __init__(self, status: int, message: str) -> None:
        """Store the status and the human-readable message."""
        super().__init__(message)
        self.status = status if status in PASS_THROUGH else 502
        self.message = message


class SupabaseClient:
    """Thin HTTP client that talks to one Supabase project."""

    def __init__(self, config: Config) -> None:
        """Keep the configuration used on every request."""
        self._config = config

    def _headers(self, token: Optional[str], prefer: Optional[str], content_type: str) -> dict:
        """Build request headers; the user token is sent only when present."""
        headers = {"apikey": self._config.supabase_key, "Content-Type": content_type}
        if token:
            headers["Authorization"] = "Bearer " + token
        if prefer:
            headers["Prefer"] = prefer
        return headers

    @staticmethod
    def _message(response: httpx.Response) -> str:
        """Extract the most useful error message from a Supabase response."""
        try:
            body = response.json()
        except ValueError:
            return response.text
        for key in ("message", "msg", "error_description", "error"):
            if isinstance(body, dict) and body.get(key):
                return str(body[key])
        return response.text

    async def request(self, method: str, path: str, token: Optional[str] = None, **options: Any) -> Any:
        """Call Supabase and return the decoded JSON body, or None when empty.

        Options: json, params, content, prefer, content_type.
        """
        if not self._config.is_ready():
            raise SupabaseError(500, "O backend não tem a ligação ao Supabase configurada.")
        headers = self._headers(token, options.get("prefer"), options.get("content_type", "application/json"))
        async with httpx.AsyncClient(timeout=self._config.timeout_seconds) as client:
            response = await client.request(
                method, self._config.supabase_url + path, headers=headers,
                json=options.get("json"), params=options.get("params"), content=options.get("content"),
            )
        if response.status_code >= 400:
            message = self._message(response)
            logger.warning("Supabase error", extra={"path": path, "status": response.status_code})
            raise SupabaseError(response.status_code, message)
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return None

    def public_file_url(self, name: str) -> str:
        """Return the public URL of a file stored in the photo bucket."""
        return f"{self._config.supabase_url}/storage/v1/object/public/{self._config.photo_bucket}/{name}"

    def upload_path(self, name: str) -> str:
        """Return the Storage API path used to upload a photo."""
        return f"/storage/v1/object/{self._config.photo_bucket}/{name}"
