"""Raio-X do site: anonymous visitor events and the summary shown to the staff."""
import logging
import re
from typing import Any, Optional
from urllib.parse import unquote

from backend.repositories import TableRepository

logger = logging.getLogger(__name__)
MAX_EVENTS = 40
BOT_PATTERN = re.compile(r"bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pingdom", re.I)


class InsightsService:
    """Stores what visitors do on the site and summarises it for the staff."""

    def __init__(self, tables: TableRepository) -> None:
        """Keep the table repository."""
        self._tables = tables

    @staticmethod
    def _header(headers: dict, name: str) -> Optional[str]:
        """Read a Vercel geolocation header, which arrives URL-encoded."""
        value = headers.get(name)
        return unquote(value)[:60] if value else None

    def with_place(self, events: list, headers: dict) -> list:
        """Return the events with the approximate city on the visit, as they were saved."""
        city = self._header(headers, "x-vercel-ip-city")
        return [dict(e, city=city) if isinstance(e, dict) and e.get("type") == "visita" else e for e in events[:MAX_EVENTS]]

    async def record(self, events: Any, headers: dict) -> int:
        """Save a batch of events; the approximate city comes from the network, never from the visitor."""
        if not isinstance(events, list) or BOT_PATTERN.search(headers.get("user-agent", "")):
            return 0
        place = {
            "city": self._header(headers, "x-vercel-ip-city"),
            "region": self._header(headers, "x-vercel-ip-country-region"),
            "country": self._header(headers, "x-vercel-ip-country"),
        }
        batch = []
        for event in events[:MAX_EVENTS]:
            if not isinstance(event, dict):
                continue
            row = {key: event[key] for key in event if key not in place}
            if row.get("type") == "visita":
                row.update(place)
            batch.append(row)
        if not batch:
            return 0
        return await self._tables.rpc("log_site_events", {"p": batch}) or 0

    async def summary(self, start: str, end: str, token: str) -> dict:
        """Return the visitor summary between two dates, computed in the database."""
        return await self._tables.rpc("site_analytics", {"p_from": start, "p_to": end}, token)
