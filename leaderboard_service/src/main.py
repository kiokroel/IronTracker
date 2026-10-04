from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(
    title="IronTracker Leaderboard Service",
    description="Service for real-time ranking and leaderboards using Redis ZSET",
    version="0.1.0",
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for Leaderboard Service."""
    return {"status": "ok", "service": "leaderboard"}
