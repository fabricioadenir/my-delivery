"""Admin HTTP routes for the staff notifications on this device."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.container import container
from backend.routes_admin import staff_token

router = APIRouter(prefix="/api/admin/push")


class EndpointIn(BaseModel):
    """Identifies this device's subscription."""

    endpoint: str = Field(pattern=r"^https://", max_length=1000)


class SubscriptionIn(EndpointIn):
    """A device subscription with its keys and the kinds of notices wanted."""

    p256dh: str = Field(default="", max_length=200)
    auth: str = Field(default="", max_length=100)
    device: Optional[str] = Field(default=None, max_length=80)
    notify_visits: bool = True
    notify_checkout: bool = True
    notify_orders: bool = True


@router.post("/subscribe")
async def subscribe(sub: SubscriptionIn, token: str = Depends(staff_token)) -> dict:
    """Save this device's subscription and preferences."""
    return await container.push.save(sub.model_dump(), token)


@router.post("/status")
async def status(sub: EndpointIn, token: str = Depends(staff_token)) -> dict:
    """Tell whether this device is subscribed and which notices it gets."""
    return {"subscribed_prefs": await container.push.status(sub.endpoint, token)}


@router.post("/remove")
async def remove(sub: EndpointIn, token: str = Depends(staff_token)) -> dict:
    """Stop notifications on this device."""
    await container.push.remove(sub.endpoint, token)
    return {"ok": True}


@router.post("/test")
async def test(sub: EndpointIn, token: str = Depends(staff_token)) -> dict:
    """Send a test notification to this device."""
    return {"sent": await container.push.test(sub.endpoint, token)}
