from __future__ import annotations

import argparse
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import bcrypt
import pytest

from scripts.seed_demo_data import (
    BOT_SPECS,
    DEMO_USER_SPEC,
    generate_workouts_for_user,
    hash_user_password,
    parse_cli_args,
    print_summary,
    seed_data,
)
from shared.contracts.src.metrics import (
    BenchPressMetrics,
    CardioExerciseMetrics,
    DeadliftMetrics,
    SquatMetrics,
    StrengthExerciseMetrics,
    TreadmillMetrics,
)


def test_seed_specifications_completeness() -> None:
    """Ensure Demo User and Bot specifications meet architectural requirements."""
    assert DEMO_USER_SPEC["email"] == "athlete@irontracker.dev"
    assert DEMO_USER_SPEC["username"] == "IronAthlete"
    assert DEMO_USER_SPEC["password"] == "password123"
    assert DEMO_USER_SPEC["is_demo"] is True

    # At least 10-15 bots with diverse styles
    assert 10 <= len(BOT_SPECS) <= 15

    emails = {b["email"] for b in BOT_SPECS}
    usernames = {b["username"] for b in BOT_SPECS}
    assert len(emails) == len(BOT_SPECS), "Bot emails must be unique"
    assert len(usernames) == len(BOT_SPECS), "Bot usernames must be unique"

    for bot in BOT_SPECS:
        assert bot["email"].startswith("bot_")
        assert bot["username"].startswith("[BOT] ")
        assert bot["target_tonnage"] > 0
        assert "style" in bot


def test_hash_user_password_bcrypt() -> None:
    """Verify password hashing produces valid bcrypt hash."""
    raw = "password123"
    hashed = hash_user_password(raw)
    assert hashed != raw
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    assert not bcrypt.checkpw(b"wrongpass", hashed.encode("utf-8"))


def test_generate_workouts_for_user_validation() -> None:
    """Verify generated workouts have valid schemas and detailed_sets."""
    user_id = uuid4()
    workouts = generate_workouts_for_user(
        user_id=user_id,
        is_demo=True,
        style="heavy_strength",
        target_tonnage=40000.0,
        days_span=30,
    )

    assert len(workouts) > 0

    exercise_types_seen = set()
    total_warmups = 0
    total_working = 0

    for dt, wtype, metrics in workouts:
        assert isinstance(dt, datetime)
        assert dt.tzinfo is not None
        assert wtype in ("bench_press", "squats", "deadlift", "strength", "treadmill", "cardio")
        exercise_types_seen.add(wtype)

        # Validate that metrics model validates as Pydantic model
        assert isinstance(
            metrics,
            (
                BenchPressMetrics,
                SquatMetrics,
                DeadliftMetrics,
                StrengthExerciseMetrics,
                TreadmillMetrics,
                CardioExerciseMetrics,
            ),
        )

        if hasattr(metrics, "detailed_sets") and metrics.detailed_sets:
            for s in metrics.detailed_sets:
                assert s.set_number >= 1
                assert s.weight > 0
                assert s.reps > 0
                if s.rpe is not None:
                    assert 1 <= s.rpe <= 10
                if s.is_warmup:
                    total_warmups += 1
                else:
                    total_working += 1

    # Verify diversity
    assert len(exercise_types_seen) >= 4
    assert total_warmups > 0
    assert total_working > 0


def test_parse_cli_args_defaults() -> None:
    """Verify CLI argument parsing defaults."""
    with patch("argparse.ArgumentParser.parse_args", return_value=argparse.Namespace(
        pg_url=None, redis_url=None, mongo_url=None, mongo_db=None
    )):
        args = parse_cli_args()
        assert args.pg_url is None
        assert args.redis_url is None
        assert args.mongo_url is None


def test_print_summary_format(capsys: pytest.CaptureFixture[str]) -> None:
    """Verify print_summary output banner format."""
    mock_result = {
        "users_count": 13,
        "workouts_count": 186,
        "demo_user": DEMO_USER_SPEC,
        "demo_tonnage": 41200.0,
        "demo_rank": 5,
    }
    print_summary(mock_result)
    captured = capsys.readouterr().out
    assert "IRONTRACKER SYNTHETIC DEMO DATA SEEDED SUCCESSFULLY!" in captured
    assert "athlete@irontracker.dev" in captured
    assert "IronAthlete" in captured
    assert "Rank:      #5 on Leaderboard" in captured


@pytest.mark.asyncio
async def test_seed_data_mocked_execution() -> None:
    """Verify seed_data orchestration flow with mocked database engines."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.add = MagicMock()

    mock_session_factory = MagicMock()
    mock_session_factory.return_value.__aenter__.return_value = mock_session
    mock_session_factory.return_value.__aexit__.return_value = None

    mock_engine = AsyncMock()
    mock_engine.dispose = AsyncMock()

    mock_redis = AsyncMock()
    mock_redis.zadd = AsyncMock()
    mock_redis.zrevrank = AsyncMock(return_value=4)
    mock_redis.aclose = AsyncMock()

    mock_mongo_collection = AsyncMock()
    mock_mongo_collection.delete_many = AsyncMock()
    mock_mongo_collection.insert_many = AsyncMock()

    mock_mongo_db = MagicMock()
    mock_mongo_db.__getitem__.return_value = mock_mongo_collection

    mock_mongo_client = MagicMock()
    mock_mongo_client.__getitem__.return_value = mock_mongo_db
    mock_mongo_client.close = MagicMock()

    with (
        patch("scripts.seed_demo_data.create_async_engine", return_value=mock_engine),
        patch("scripts.seed_demo_data.async_sessionmaker", return_value=mock_session_factory),
        patch("scripts.seed_demo_data.Redis.from_url", return_value=mock_redis),
        patch("scripts.seed_demo_data.AsyncIOMotorClient", return_value=mock_mongo_client),
    ):
        result = await seed_data(
            pg_url="postgresql+asyncpg://mock:pass@localhost:5432/mock",
            redis_url="redis://localhost:6379/0",
            mongo_url="mongodb://localhost:27017",
            mongo_db_name="mock_analytics",
            silent=True,
        )

        assert result["users_count"] == 13
        assert result["workouts_count"] > 100
        assert result["demo_rank"] == 5
        assert result["demo_tonnage"] > 30000.0

        # Assert calls were made
        assert mock_session.commit.called
        assert mock_redis.zadd.called
        assert mock_mongo_collection.insert_many.called
        assert mock_engine.dispose.called
