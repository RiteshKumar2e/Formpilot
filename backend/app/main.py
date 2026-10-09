from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .config import get_settings
from . import admin_account, migrations
from .database import Base, engine
from .middleware import SecurityGuards
from .services import vectorstore
from .routers import admin, applications, auth, contact, documents, extension, integrations, profile, system, vault

settings = get_settings()
settings.validate_for_production()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    migrations.upgrade(engine)  # adds columns introduced after a database was created
    Base.metadata.create_all(bind=engine)
    admin_account.ensure_admin(engine)
    vectorstore.migrate_from_database(engine)  # passages stored in the database by earlier versions
    yield
    vectorstore.close()


app = FastAPI(
    title="FormPilot API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/api/docs",
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


# Size and cross-site checks run before routing, so nothing reads a refused body.
app.add_middleware(SecurityGuards)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if settings.https_required:
        proto = request.headers.get("x-forwarded-proto") if settings.trust_proxy_headers else None
        if (proto or request.url.scheme) == "http":
            return RedirectResponse(str(request.url.replace(scheme="https")), status_code=308)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.https_required or settings.cookie_secure:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


for router in (
    auth.router,
    documents.router,
    profile.router,
    applications.router,
    vault.router,
    extension.router,
    integrations.router,
    system.router,
    contact.router,
    admin.router,
):
    app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["health"])
@app.get("/health", include_in_schema=False)  # for hosting health checks that don't use /api
@app.get("/", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}
