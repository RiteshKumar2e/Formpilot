import base64
import hashlib
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-only-insecure-signing-key-change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    secret_key: str = ""
    file_encryption_key: str = ""
    database_url: str = "sqlite:///./formpilot.db"
    storage_dir: str = "./storage"
    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False
    session_hours: int = 12
    max_upload_bytes: int = 10 * 1024 * 1024
    # Redirect plain-HTTP requests to HTTPS. Defaults to on in production.
    enforce_https: bool | None = None
    # Trust X-Forwarded-For / X-Forwarded-Proto. Enable only behind a reverse proxy you control.
    trust_proxy_headers: bool = False
    rate_limit_enabled: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def https_required(self) -> bool:
        return self.is_production if self.enforce_https is None else self.enforce_https

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def signing_key(self) -> str:
        return self.secret_key or _DEV_SECRET

    @property
    def fernet_key(self) -> bytes:
        if self.file_encryption_key:
            return self.file_encryption_key.encode()
        # Development fallback: derive a stable key from the signing key.
        return base64.urlsafe_b64encode(hashlib.sha256(self.signing_key.encode()).digest())

    def validate_for_production(self) -> None:
        if not self.is_production:
            return
        missing = [name for name, value in (("SECRET_KEY", self.secret_key), ("FILE_ENCRYPTION_KEY", self.file_encryption_key)) if not value]
        if missing:
            raise RuntimeError(f"Missing required settings in production: {', '.join(missing)}")
        if not self.cookie_secure:
            raise RuntimeError("COOKIE_SECURE must be true in production.")
        if not self.https_required:
            raise RuntimeError("ENFORCE_HTTPS can't be disabled in production.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
