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

STEPS = {
    "dados": "os seus dados", "morada": "morada", "entrega": "quando receber", "acompanhamentos": "acompanhamentos",
    "pagamento": "pagamento", "observacoes": "observações", "guardar_dados": "guardar dados (PIN)",
    "fazer_pedido": "tocou em Fazer pedido",
}


def _eur(value: float) -> str:
    """Format euros the Portuguese way (34,90 €)."""
    return f"{value:.2f} €".replace(".", ",")


def abandon_text(row: dict) -> tuple:
    """Title and body of the notice for a checkout left without an order."""
    form = row.get("checkout") if isinstance(row.get("checkout"), dict) else {}
    try:
        value = float(row.get("valor") or 0)
    except (TypeError, ValueError):
        value = 0.0
    title = "Desistiu do pedido" + (f" · {_eur(value)}" if value else "")
    parts = []
    step = row.get("passo")
    parts.append(f"Parou em: {STEPS.get(step, step)}" if step else "Não mexeu no formulário")
    if form.get("quando") == "ja":
        parts.append("o mais cedo possível")
    elif form.get("quando") == "agendar" and form.get("dia"):
        parts.append(f"agendar {form['dia']}" + (f" às {form['hora']}" if form.get("hora") else ""))
    if form.get("ja") is False and form.get("primeira"):
        parts.append(f"sem 'o mais cedo possível' (1.ª hora: {form['primeira']})")
    place = ", ".join(x for x in (form.get("localidade"), form.get("zona")) if x)
    if place:
        parts.append(place)
    errors = row.get("erros") if isinstance(row.get("erros"), list) else []
    if errors:
        parts.append(f"Aviso: {errors[-1]}")
    if row.get("saida"):
        parts.append(str(row["saida"]).capitalize())
    seconds = row.get("seg_checkout") or 0
    if isinstance(seconds, (int, float)) and seconds > 0:
        parts.append(f"{round(seconds / 60)} min no formulário" if seconds >= 60 else f"{int(seconds)} s no formulário")
    who = [SOURCES.get(row.get("origem") or "direto", row.get("origem") or "Direto"), row.get("modelo"), row.get("cidade")]
    parts.append(" · ".join(str(x) for x in who if x))
    after = row.get("pedido_depois")
    if isinstance(after, dict) and after.get("numero"):
        parts.append(f"Depois chegou o pedido n.º {after['numero']} ({_eur(float(after.get('total') or 0))}) — pode ser a mesma pessoa")
    return title, " · ".join(p for p in parts if p)


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
                await self.notify("checkout", "Alguém está a finalizar um pedido", self._checkout_body(event), "/?abrir=raiox", "high")

    @staticmethod
    def _checkout_body(event: dict) -> str:
        """Describe the cart of someone who just opened the checkout form."""
        detail = event.get("detail") if isinstance(event.get("detail"), dict) else {}
        items = detail.get("itens") if isinstance(detail.get("itens"), list) else []
        try:
            value = float(event.get("value") or 0)
        except (TypeError, ValueError):
            value = 0.0
        if not value:
            return "Abriu o formulário de envio no site."
        n = len(items)
        products = f" ({n} {'produto' if n == 1 else 'produtos'})" if n else ""
        return f"Abriu o formulário com {_eur(value)} no carrinho{products}."

    async def abandoned_checkouts(self) -> int:
        """Notify every visitor who opened the checkout and left it for 10 minutes without ordering.

        The database marks each one as notified, so a visit is only announced once.
        """
        if not self._config.push_secret:
            return 0
        try:
            rows = await self._tables.rpc("checkout_abandonos", {"p_secret": self._config.push_secret}) or []
        except Exception:  # noqa: BLE001
            logger.exception("Abandoned checkouts failed")
            return 0
        sent = 0
        for row in rows if isinstance(rows, list) else []:
            if isinstance(row, dict):
                title, body = abandon_text(row)
                sent += await self.notify("checkout", title, body, "/?abrir=raiox", "high")
        return sent

    async def new_order(self, order: dict, customer: str, locality: str = "") -> None:
        """Notify a new order with its number, customer, total and locality."""
        total = float(order.get("total") or (float(order.get("subtotal") or 0) + float(order.get("delivery_fee") or 0)))
        body = f"{customer.split()[0] if customer else 'Cliente'} · {total:.2f} €".replace(".", ",")
        if locality or order.get("zone_name"):
            body += f" · {locality or order['zone_name']}"
        code = f" · {order['code']}" if order.get("code") else ""
        title = f"TESTE · Pedido de teste{code}" if order.get("test") else f"Novo pedido n.º {order.get('number', '')}{code}"
        await self.notify("orders", title, body, "/?abrir=pedidos", "high")

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
