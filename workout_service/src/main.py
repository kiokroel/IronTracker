from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(
    title="IronTracker Workout Service",
    description="Service for workout management and tracking with strict validation",
    version="0.1.0",
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for Workout Service."""
    return {"status": "ok", "service": "workout"}
