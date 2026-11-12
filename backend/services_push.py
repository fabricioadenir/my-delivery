"""Notifications on the staff phones (Web Push): visits, checkouts and new orders."""
import asyncio
import json
import logging
from typing import Optional

from pywebpush import WebPushException, webpush

from backend.config import Config
from backend.repositories import TableRepository

logger = logging.getLogger(__name__)
GONE = (404, 410)
SOURCES = {
    "direto": "Direto", "flyer": "Flyer", "instagram": "Instagram", "instagram-bio": "Instagram (bio)",
    "instagram-story": "Instagram (story)", "facebook": "Facebook", "google": "Google", "whatsapp": "WhatsApp",
    "acompanhar-pedido": "Acompanhar pedido",
}


class PushService:
    """Sends notifications to every staff device that asked for that kind of notice."""

    def __init__(self, tables: TableRepository, config: Config) -> None:
        """Keep the table repository and the Web Push keys."""
        self._tables = tables
        self._config = config

    def _send_one(self, target: dict, payload: dict, urgency: str) -> Optional[int]:
        """Send one notification; return the HTTP status when the push service refused it."""
        try:
            webpush(
                subscription_info={"endpoint": target["endpoint"], "keys": {"p256dh": target["p256dh"], "auth": target["auth"]}},
                data=json.dumps(payload, ensure_ascii=False), vapid_private_key=self._config.vapid_private_key,
                vapid_claims={"sub": self._config.vapid_subject}, ttl=3600, headers={"Urgency": urgency}, timeout=8)
            return None
        except WebPushException as error:
            status = error.response.status_code if error.response is not None else 0
            logger.warning("Push refused", extra={"status": status})
            return status
        except Exception:  # noqa: BLE001 - a failed notice must never break the request that caused it
            logger.exception("Push failed")
            return 0

    async def _deliver(self, targets: list, payload: dict, urgency: str) -> int:
        """Send to several devices at once and drop the subscriptions the push service says are gone."""
        results = await asyncio.gather(*(asyncio.to_thread(self._send_one, t, payload, urgency) for t in targets))
        for target, status in zip(targets, results):
            if status in GONE:
                await self._tables.rpc("push_drop", {"p_secret": self._config.push_secret, "p_endpoint": target["endpoint"]})
        return sum(1 for status in results if status is None)

    async def notify(self, kind: str, title: str, body: str, url: str = "/", urgency: str = "normal") -> int:
        """Notify every device subscribed to this kind (visits, checkout or orders)."""
        if not self._config.push_ready():
            return 0
        try:
            targets = await self._tables.rpc("push_targets", {"p_secret": self._config.push_secret, "p_kind": kind}) or []
            if not targets:
                return 0
            return await self._deliver(targets, {"title": title, "body": body, "url": url, "tag": kind}, urgency)
        except Exception:  # noqa: BLE001
            logger.exception("Notify failed")
            return 0

    async def visit_events(self, events: list) -> None:
        """Turn a batch of site events into notices: new visit and someone at checkout."""
        for event in events:
            if not isinstance(event, dict):
                continue
            if event.get("type") == "visita":
                parts = [SOURCES.get(event.get("source") or "direto", event.get("source") or "Direto"),
                         event.get("model") or event.get("os"), event.get("city")]
                await self.notify("visits", "Nova visita no site", " · ".join(p for p in parts if p), "/?abrir=raiox")
            elif event.get("type") == "finalizar":
                await self.notify("checkout", "Alguém está a finalizar um pedido", "Abriu o formulário de envio no site.", "/?abrir=raiox", "high")

    async def new_order(self, order: dict, customer: str, locality: str = "") -> None:
        """Notify a new order with its number, customer, total and locality."""
        total = float(order.get("total") or (float(order.get("subtotal") or 0) + float(order.get("delivery_fee") or 0)))
        body = f"{customer.split()[0] if customer else 'Cliente'} · {total:.2f} €".replace(".", ",")
        if locality or order.get("zone_name"):
            body += f" · {locality or order['zone_name']}"
        await self.notify("orders", f"Novo pedido n.º {order.get('number', '')}" + (f" · {order['code']}" if order.get("code") else ""), body, "/?abrir=pedidos", "high")

    async def save(self, data: dict, token: str) -> dict:
        """Save this device's subscription and preferences."""
        return await self._tables.rpc("push_save", {"p": data}, token)

    async def status(self, endpoint: str, token: str) -> Optional[dict]:
        """Return this device's preferences, or None when it is not subscribed."""
        found = await self._tables.rpc("push_get", {"p_endpoint": endpoint}, token)
        return {k: found[k] for k in ("notify_visits", "notify_checkout", "notify_orders")} if found else None

    async def remove(self, endpoint: str, token: str) -> None:
        """Stop notifications on this device."""
        await self._tables.rpc("push_remove", {"p_endpoint": endpoint}, token)

    async def test(self, endpoint: str, token: str) -> bool:
        """Send a test notification to this device only."""
        found = await self._tables.rpc("push_get", {"p_endpoint": endpoint}, token)
        if not found or not self._config.push_ready():
            return False
        payload = {"title": "Sakura & Sal", "body": "As notificações estão a funcionar neste aparelho.", "url": "/?abrir=raiox", "tag": "teste"}
        return await self._deliver([found], payload, "high") == 1
