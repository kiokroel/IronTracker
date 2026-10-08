from __future__ import annotations

from fastapi import APIRouter

# Aggregating router configured with canonical /api/v1 prefix for all domain endpoints
router = APIRouter(prefix="/api/v1")

__all__ = ["router"]
