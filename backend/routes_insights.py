"""HTTP routes for the Raio-X: public event intake and the staff summary."""
import json

from fastapi import APIRouter, Depends, Query, Request

from backend.container import container
from backend.routes_admin import staff_token
from backend.schemas_finance import DATE_PATTERN

public_router = APIRouter(prefix="/api")
admin_router = APIRouter(prefix="/api/admin")
MAX_BODY = 32_000


@public_router.post("/events")
async def record_events(request: Request) -> dict:
    """Receive a batch of anonymous visitor events (also sent with navigator.sendBeacon)."""
    raw = await request.body()
    if len(raw) > MAX_BODY:
        return {"ok": False}
    try:
        body = json.loads(raw or b"{}")
    except ValueError:
        return {"ok": False}
    events = body.get("events") if isinstance(body, dict) else None
    saved = await container.insights.record(events, {k.lower(): v for k, v in request.headers.items()})
    return {"ok": True, "saved": saved}


@admin_router.get("/insights")
async def insights(
    start: str = Query(pattern=DATE_PATTERN), end: str = Query(pattern=DATE_PATTERN),
    token: str = Depends(staff_token),
) -> dict:
    """Return visits, funnel, audience and abandoned carts between two dates."""
    return await container.insights.summary(start, end, token)
