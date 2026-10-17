"""Wires configuration, infrastructure, repositories and services together."""
from backend.config import Config
from backend.repositories import AuthRepository, PhotoRepository, TableRepository
from backend.services_admin import AdminService
from backend.services_costing import CostingService
from backend.services_finance import FinanceService
from backend.services_ops import OperationsService, SessionService
from backend.services_public import AuthService, MenuService, OrderService
from backend.services_stock import StockService
from backend.supabase_client import SupabaseClient


class Container:
    """Holds the single instance of every service used by the routes."""

    def __init__(self) -> None:
        """Build the object graph once per function instance."""
        client = SupabaseClient(Config())
        tables = TableRepository(client)
        self.menu = MenuService(tables)
        self.orders = OrderService(tables)
        self.auth = AuthService(AuthRepository(client), tables)
        self.admin = AdminService(tables, PhotoRepository(client), self.menu)
        self.costing = CostingService(tables)
        self.stock = StockService(tables)
        self.finance = FinanceService(tables)
        self.sessions = SessionService(client, tables)
        self.operations = OperationsService(tables)


container = Container()
