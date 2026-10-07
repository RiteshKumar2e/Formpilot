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
    # Local development uses a libSQL file (same engine as Turso, including vector search).
    database_url: str = "sqlite+libsql:///./formpilot.db"
    # Turso: when set, the app uses this remote database instead of DATABASE_URL.
    turso_database_url: str = ""
    turso_auth_token: str = ""
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

    # Public URL of the web app. OAuth sign-in returns the browser here.
    app_url: str = "http://localhost:5173"
    # Public URL where the browser reaches this API. Defaults to APP_URL (the Vite dev server and
    # most deployments proxy /api from the web app's origin).
    api_public_url: str = ""

    # --- AI ---
    # An LLM on Groq reads documents and maps form fields. Without a key FormPilot falls back to its
    # rule-based extractor and embedding matcher, so it still works offline.
    groq_api_key: str = ""
    # None: on when GROQ_API_KEY is set.
    llm_enabled: bool | None = None
    # Must support strict JSON-schema output on Groq.
    llm_model: str = "openai/gpt-oss-120b"
    llm_timeout_seconds: float = 60.0
    # "fastembed" runs a local ONNX embedding model (downloaded once). "hash" is a dependency-free
    # fallback used in tests and when the model can't be loaded.
    embedding_provider: str = "fastembed"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    rag_top_k: int = 4

    # --- Sign in with Google (OAuth 2.0 / OpenID Connect) ---
    google_client_id: str = ""
    google_client_secret: str = ""

    # --- Integrations ---
    webhook_timeout_seconds: float = 5.0

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def https_required(self) -> bool:
        return self.is_production if self.enforce_https is None else self.enforce_https

    @property
    def llm_active(self) -> bool:
        return bool(self.groq_api_key) if self.llm_enabled is None else self.llm_enabled

    @property
    def api_base_url(self) -> str:
        return (self.api_public_url or self.app_url).rstrip("/")

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

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
