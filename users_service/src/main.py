from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from users_service.src.core.config import settings
from users_service.src.core.database import get_db_session
from users_service.src.routes import router

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    description="Authentication, JWT token issuance and user profile management",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include canonical /api/v1 router
app.include_router(router)


@app.get("/api/v1/users/docs", include_in_schema=False, response_class=HTMLResponse)
async def get_gateway_swagger_ui() -> HTMLResponse:
    """Swagger UI accessible through Caddy API Gateway."""
    return get_swagger_ui_html(
        openapi_url="/api/v1/users/openapi.json",
        title=f"{app.title} - Swagger UI",
    )


@app.get("/api/v1/users/openapi.json", include_in_schema=False)
async def get_gateway_openapi_schema() -> JSONResponse:
    """OpenAPI JSON schema accessible through Caddy API Gateway."""
    return JSONResponse(app.openapi())


@app.get("/health", tags=["Monitoring"])
async def health_check() -> dict[str, str]:
    """Liveness probe endpoint confirming Users Service process is running."""
    return {"status": "ok", "service": "users"}


@app.get("/ready", tags=["Monitoring"])
async def readiness_check(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, str]:
    """Readiness probe endpoint confirming PostgreSQL connection is responsive."""
    try:
        result = await session.execute(text("SELECT 1"))
        scalar_val = result.scalar()
        if scalar_val != 1:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database healthcheck returned invalid response",
            )
        return {"status": "ready", "database": "connected"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Readiness check failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unreachable: {exc}",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "users_service.src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=False,
    )
