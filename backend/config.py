"""Application configuration read from environment variables."""
import os


class Config:
    """Holds every environment-dependent setting of the API."""

    def __init__(self) -> None:
        """Read all settings from the process environment."""
        self.supabase_url: str = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.supabase_key: str = os.environ.get("SUPABASE_KEY", "")
        self.photo_bucket: str = os.environ.get("PHOTO_BUCKET", "fotos")
        self.timeout_seconds: float = float(os.environ.get("SUPABASE_TIMEOUT", "20"))

    def is_ready(self) -> bool:
        """Tell whether the Supabase connection settings are present."""
        return bool(self.supabase_url and self.supabase_key)
