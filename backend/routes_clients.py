"""Public HTTP routes for the optional customer data (phone + PIN)."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from backend.container import container
from backend.routes_admin import staff_token
from backend.supabase_client import SupabaseError

router = APIRouter(prefix="/api/cliente")
admin_router = APIRouter(prefix="/api/admin")
Pin = Field(pattern=r"^[0-9]{4}$")


class SignupIn(BaseModel):
    """Name, phone, chosen PIN and addresses to keep."""

    nome: str = Field(min_length=2, max_length=80)
    tel: str = Field(min_length=9, max_length=30)
    pin: str = Pin
    moradas: list[dict[str, Any]] = Field(default_factory=list, max_length=10)


class LoginIn(BaseModel):
    """Phone and PIN."""

    tel: str = Field(min_length=9, max_length=30)
    pin: str = Field(max_length=10)


class UpdateIn(BaseModel):
    """Fields to change; missing ones are kept."""

    nome: Optional[str] = Field(default=None, max_length=80)
    moradas: Optional[list[dict[str, Any]]] = Field(default=None, max_length=10)


class PinIn(BaseModel):
    """Current and new PIN."""

    atual: str = Field(max_length=10)
    novo: str = Pin


class RecoverIn(BaseModel):
    """Recovery code from the link and the new PIN."""

    codigo: str = Field(pattern=r"^[0-9a-f]{36}$")
    pin: str = Pin


def client_token(x_cliente: Optional[str] = Header(default=None)) -> str:
    """Read the customer session sent by the site."""
    if not x_cliente:
        raise SupabaseError(401, "Sessão terminada. Entre outra vez.")
    return x_cliente


@router.post("/criar")
async def signup(body: SignupIn) -> dict:
    """Save the customer's data and start a session."""
    return await container.clients.signup(body.nome, body.tel, body.pin, body.moradas)


@router.post("/entrar")
async def login(body: LoginIn) -> dict:
    """Start a session with phone and PIN."""
    return await container.clients.login(body.tel, body.pin)


@router.get("/eu")
async def me(token: str = Depends(client_token)) -> dict:
    """Saved data and orders of the session."""
    return await container.clients.me(token)


@router.put("/eu")
async def update(body: UpdateIn, token: str = Depends(client_token)) -> dict:
    """Change name and/or addresses."""
    return await container.clients.update(token, body.model_dump(exclude_none=True))


@router.put("/pin")
async def change_pin(body: PinIn, token: str = Depends(client_token)) -> dict:
    """Change the PIN."""
    await container.clients.change_pin(token, body.atual, body.novo)
    return {"ok": True}


@router.post("/sair")
async def logout(token: str = Depends(client_token)) -> dict:
    """End the session on this device."""
    await container.clients.logout(token)
    return {"ok": True}


@router.delete("/eu")
async def delete(token: str = Depends(client_token)) -> dict:
    """Delete the saved data."""
    await container.clients.delete(token)
    return {"ok": True}


@router.get("/recuperar/{codigo}")
async def recover_info(codigo: str) -> dict:
    """Check a recovery link before asking for the new PIN."""
    info = await container.clients.recover_info(codigo) if len(codigo) == 36 else None
    if not info:
        raise SupabaseError(404, "Este link já foi usado ou não é válido. Peça-nos um novo pelo WhatsApp.")
    return info


@router.post("/recuperar")
async def recover(body: RecoverIn) -> dict:
    """Choose a new PIN from a recovery link."""
    return await container.clients.recover(body.codigo, body.pin)


@admin_router.get("/client-accounts")
async def staff_accounts(token: str = Depends(staff_token)) -> list:
    """Phones with saved data and recovery codes, for the staff to send the link."""
    return await container.clients.staff_accounts(token)
