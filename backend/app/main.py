import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_models
from app.seed import seed
from app.routers import auth, users, crypto_identity, messages, media, link_preview, devices

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

app = FastAPI(title="unnamed-chat backend")

# Dev-open CORS. Tighten to the actual app origin before this ever
# touches anything but localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- centralized error handling ----------
# Every error the client sees comes back as {"error": {"code": ..., "message": ...}}
# so the mobile client can branch on `code` instead of parsing prose.

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "validation_error", "message": exc.errors()}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "internal_error", "message": "something went wrong"}},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(crypto_identity.router)
app.include_router(messages.router)
app.include_router(media.router)
app.include_router(link_preview.router)
app.include_router(devices.router)


@app.on_event("startup")
async def on_startup():
    # Dev convenience only. Real deploys run `alembic upgrade head` instead
    # of this - see alembic/ - so schema changes are tracked, not implicit.
    await init_models()
    # Ensure both "devansh" and "swarnima" accounts exist on every start.
    # Critical for Render Free Tier where SQLite DB is wiped on every restart.
    await seed()
