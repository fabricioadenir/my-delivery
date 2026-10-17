"""FastAPI application factory."""
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from backend.routes_admin import router as admin_router
from backend.routes_costing import router as costing_router
from backend.routes_finance import router as finance_router
from backend.routes_ops import admin_router as ops_admin_router
from backend.routes_ops import public_router as ops_public_router
from backend.routes_public import router as public_router
from backend.routes_stock import router as stock_router
from backend.supabase_client import SupabaseError

logger = logging.getLogger(__name__)


async def supabase_error_handler(request: Request, error: SupabaseError) -> JSONResponse:
    """Turn a Supabase error into a JSON response the site can show."""
    logger.warning("Request failed", extra={"path": request.url.path, "status": error.status})
    return JSONResponse(status_code=error.status, content={"detail": error.message})


def create_app() -> FastAPI:
    """Create the application with its routes and error handling."""
    application = FastAPI(title="Sakura & Sal API", docs_url="/api/docs", openapi_url="/api/openapi.json")
    application.add_exception_handler(SupabaseError, supabase_error_handler)
    application.include_router(public_router)
    application.include_router(admin_router)
    application.include_router(costing_router)
    application.include_router(stock_router)
    application.include_router(finance_router)
    application.include_router(ops_public_router)
    application.include_router(ops_admin_router)
    return application


app = create_app()
