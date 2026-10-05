from __future__ import annotations

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.core.database import get_db_session
from workout_service.src.routes import router

app = FastAPI(
    title="IronTracker Workout Service",
    description="Service for workout management and tracking with strict validation",
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

# Include application API routes
app.include_router(router)


@app.get("/health", tags=["Monitoring"])
async def health_check() -> dict[str, str]:
    """Liveness probe endpoint verifying that the service process is running."""
    return {"status": "ok", "service": "workout"}


@app.get("/ready", tags=["Monitoring"])
async def readiness_check(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, str]:
    """Readiness probe endpoint verifying database connectivity via SELECT 1."""
    try:
        result = await session.execute(text("SELECT 1"))
        scalar_value = result.scalar()
        if scalar_value != 1:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database healthcheck returned invalid response",
            )
        return {"status": "ready", "database": "connected"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unreachable: {exc}",
        ) from exc


if __name__ == "__main__":
    import os

    import uvicorn

    host = os.getenv("APP_HOST", "127.0.0.1")
    port = int(os.getenv("APP_PORT", "8000"))
    uvicorn.run(
        app,
        host=host,
        port=port,
    )
