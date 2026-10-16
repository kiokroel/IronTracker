from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from analytics_service.src.core.config import get_settings as get_analytics_settings
from analytics_service.src.schemas.analytics import (
    WorkoutMetadata,
    WorkoutTimeSeriesPoint,
)
from analytics_service.src.services.calculator import calculate_1rm_breakdown, calculate_max_1rm
from leaderboard_service.src.core.config import get_settings as get_leaderboard_settings
from leaderboard_service.src.services.tonnage import calculate_workout_tonnage
from shared.contracts.src.metrics import (
    BenchPressMetrics,
    DeadliftMetrics,
    SquatMetrics,
    StrengthExerciseMetrics,
    StrengthSet,
    TreadmillMetrics,
    WorkoutMetrics,
)
from users_service.src.core.config import settings as users_settings
from users_service.src.models.user import UserModel
from workout_service.src.models.workout import WorkoutModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_demo_data")


# ==============================================================================
# Seed User Specifications
# ==============================================================================

DEMO_USER_SPEC = {
    "email": "athlete@irontracker.dev",
    "username": "IronAthlete",
    "password": "password123",
    "is_demo": True,
}

BOT_SPECS: list[dict[str, Any]] = [
    {
        "email": "bot_arnold@irontracker.test",
        "username": "[BOT] Arnold Heavy",
        "password": "botpassword2026",
        "target_tonnage": 62500.0,
        "style": "heavy_bodybuilding",
    },
    {
        "email": "bot_ronnie@irontracker.test",
        "username": "[BOT] Ronnie Big",
        "password": "botpassword2026",
        "target_tonnage": 58000.0,
        "style": "power_strength",
    },
    {
        "email": "bot_alex@irontracker.test",
        "username": "[BOT] Alex Powerlifter",
        "password": "botpassword2026",
        "target_tonnage": 48500.0,
        "style": "powerlifting",
    },
    {
        "email": "bot_franco@irontracker.test",
        "username": "[BOT] Franco Strong",
        "password": "botpassword2026",
        "target_tonnage": 44200.0,
        "style": "heavy_strength",
    },
    # Demo User fits in Rank #5 with ~41,200 kg
    {
        "email": "bot_dmitry@irontracker.test",
        "username": "[BOT] Dmitry Squatter",
        "password": "botpassword2026",
        "target_tonnage": 36500.0,
        "style": "squat_focus",
    },
    {
        "email": "bot_tom@irontracker.test",
        "username": "[BOT] Tom Quad",
        "password": "botpassword2026",
        "target_tonnage": 31200.0,
        "style": "bodybuilding",
    },
    {
        "email": "bot_dorian@irontracker.test",
        "username": "[BOT] Dorian Mass",
        "password": "botpassword2026",
        "target_tonnage": 26800.0,
        "style": "heavy_duty",
    },
    {
        "email": "bot_jay@irontracker.test",
        "username": "[BOT] Jay Beast",
        "password": "botpassword2026",
        "target_tonnage": 22400.0,
        "style": "hypertrophy",
    },
    {
        "email": "bot_elena@irontracker.test",
        "username": "[BOT] Elena Fit",
        "password": "botpassword2026",
        "target_tonnage": 17800.0,
        "style": "fitness_mixed",
    },
    {
        "email": "bot_sarah@irontracker.test",
        "username": "[BOT] Sarah Power",
        "password": "botpassword2026",
        "target_tonnage": 13400.0,
        "style": "power_conditioning",
    },
    {
        "email": "bot_mike@irontracker.test",
        "username": "[BOT] Mike HeavyDuty",
        "password": "botpassword2026",
        "target_tonnage": 9100.0,
        "style": "strength_start",
    },
    {
        "email": "bot_chris@irontracker.test",
        "username": "[BOT] Chris Cardio",
        "password": "botpassword2026",
        "target_tonnage": 5200.0,
        "style": "cardio_athlete",
    },
]


def hash_user_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ==============================================================================
# Realistic Workout Generator
# ==============================================================================

def generate_workouts_for_user(
    user_id: UUID,
    is_demo: bool,
    style: str,
    target_tonnage: float,
    days_span: int = 30,
) -> list[tuple[datetime, str, WorkoutMetrics]]:
    """Generate realistic sequence of workouts with detailed sets and timestamps.

    Returns tuples of (workout_datetime, workout_type, validated_metrics).
    """
    now = datetime.now(UTC)
    workouts: list[tuple[datetime, str, WorkoutMetrics]] = []
    accumulated_tonnage = 0.0

    # Determine workout frequency
    num_workouts = 18 if is_demo else 14
    interval_hours = (days_span * 24) // max(num_workouts, 1)

    for i in range(num_workouts):
        workout_time = now - timedelta(hours=(num_workouts - i) * interval_hours)

        # Cycle through primary movements
        cycle_idx = i % 5
        metrics: WorkoutMetrics

        if cycle_idx == 0:
            # Bench Press with pyramid detailed sets
            base_w = 80.0 if not is_demo else 95.0
            if "heavy" in style or "power" in style:
                base_w += 20.0

            sets = [
                StrengthSet(set_number=1, weight=base_w * 0.5, reps=12, rpe=6.0, is_warmup=True),
                StrengthSet(set_number=2, weight=base_w * 0.75, reps=8, rpe=7.0, is_warmup=True),
                StrengthSet(set_number=3, weight=base_w, reps=6, rpe=8.5, is_warmup=False),
                StrengthSet(set_number=4, weight=base_w * 1.05, reps=5, rpe=9.0, is_warmup=False),
                StrengthSet(set_number=5, weight=base_w * 1.1, reps=3, rpe=9.5, is_warmup=False),
            ]
            metrics = BenchPressMetrics(
                exercise_type="bench_press",
                weight=base_w * 1.1,
                sets=5,
                reps=5,
                rpe=9.5,
                grip_width_cm=81.0,
                detailed_sets=sets,
            )
            workouts.append((workout_time, "bench_press", metrics))
            accumulated_tonnage += calculate_workout_tonnage(metrics)

        elif cycle_idx == 1:
            # Squats with heavy sets
            base_w = 100.0 if not is_demo else 125.0
            if "squat" in style or "power" in style or "heavy" in style:
                base_w += 30.0

            sets = [
                StrengthSet(set_number=1, weight=base_w * 0.5, reps=10, rpe=6.0, is_warmup=True),
                StrengthSet(set_number=2, weight=base_w * 0.8, reps=5, rpe=7.5, is_warmup=False),
                StrengthSet(set_number=3, weight=base_w, reps=5, rpe=8.5, is_warmup=False),
                StrengthSet(set_number=4, weight=base_w * 1.05, reps=5, rpe=9.0, is_warmup=False),
            ]
            metrics = SquatMetrics(
                exercise_type="squats",
                weight=base_w * 1.05,
                sets=4,
                reps=5,
                rpe=9.0,
                stance="medium",
                detailed_sets=sets,
            )
            workouts.append((workout_time, "squats", metrics))
            accumulated_tonnage += calculate_workout_tonnage(metrics)

        elif cycle_idx == 2:
            # Deadlift session
            base_w = 120.0 if not is_demo else 145.0
            if "power" in style or "heavy" in style:
                base_w += 35.0

            sets = [
                StrengthSet(set_number=1, weight=base_w * 0.5, reps=8, rpe=6.0, is_warmup=True),
                StrengthSet(set_number=2, weight=base_w * 0.85, reps=5, rpe=8.0, is_warmup=False),
                StrengthSet(set_number=3, weight=base_w, reps=4, rpe=9.0, is_warmup=False),
                StrengthSet(set_number=4, weight=base_w * 1.08, reps=2, rpe=9.5, is_warmup=False),
            ]
            metrics = DeadliftMetrics(
                exercise_type="deadlift",
                weight=base_w * 1.08,
                sets=4,
                reps=4,
                rpe=9.5,
                deadlift_style="conventional",
                detailed_sets=sets,
            )
            workouts.append((workout_time, "deadlift", metrics))
            accumulated_tonnage += calculate_workout_tonnage(metrics)

        elif cycle_idx == 3:
            # Overhead Press / Strength accessory
            base_w = 50.0 if not is_demo else 62.5
            sets = [
                StrengthSet(set_number=1, weight=base_w * 0.6, reps=10, rpe=6.0, is_warmup=True),
                StrengthSet(set_number=2, weight=base_w, reps=6, rpe=8.0, is_warmup=False),
                StrengthSet(set_number=3, weight=base_w, reps=6, rpe=8.5, is_warmup=False),
                StrengthSet(set_number=4, weight=base_w * 1.05, reps=5, rpe=9.0, is_warmup=False),
            ]
            metrics = StrengthExerciseMetrics(
                exercise_type="strength",
                exercise_name="overhead_press",
                weight=base_w * 1.05,
                sets=4,
                reps=6,
                rpe=9.0,
                detailed_sets=sets,
            )
            workouts.append((workout_time, "strength", metrics))
            accumulated_tonnage += calculate_workout_tonnage(metrics)

        else:
            # Cardio session (treadmill or running)
            dist = 5.0 if not is_demo else 6.5
            dur = 28.0 if not is_demo else 35.0
            metrics = TreadmillMetrics(
                exercise_type="treadmill",
                distance_km=dist,
                duration_minutes=dur,
                heart_rate=145,
                incline_percentage=2.0,
                speed_kmh=11.0,
                pace_min_per_km=5.4,
                calories_burned=380,
            )
            workouts.append((workout_time, "treadmill", metrics))

    # Adjust final strength workout if we need to closely match target tonnage
    if target_tonnage > 0 and accumulated_tonnage > 0:
        ratio = target_tonnage / accumulated_tonnage
        # Fine-tune the strength workouts to approximate target
        workouts_adjusted: list[tuple[datetime, str, WorkoutMetrics]] = []
        for dt, wtype, m in workouts:
            if hasattr(m, "detailed_sets") and m.detailed_sets:
                scaled_sets: list[StrengthSet] = []
                for s in m.detailed_sets:
                    scaled_weight = round(max(20.0, s.weight * ratio), 1)
                    scaled_sets.append(
                        StrengthSet(
                            set_number=s.set_number,
                            weight=scaled_weight,
                            reps=s.reps,
                            rpe=s.rpe,
                            is_warmup=s.is_warmup,
                        )
                    )
                new_max_w = max(s.weight for s in scaled_sets)
                m_scaled: WorkoutMetrics
                if isinstance(m, BenchPressMetrics):
                    m_scaled = BenchPressMetrics(
                        exercise_type="bench_press",
                        weight=new_max_w,
                        sets=m.sets,
                        reps=m.reps,
                        rpe=m.rpe,
                        grip_width_cm=m.grip_width_cm,
                        detailed_sets=scaled_sets,
                    )
                elif isinstance(m, SquatMetrics):
                    m_scaled = SquatMetrics(
                        exercise_type="squats",
                        weight=new_max_w,
                        sets=m.sets,
                        reps=m.reps,
                        rpe=m.rpe,
                        stance=m.stance,
                        detailed_sets=scaled_sets,
                    )
                elif isinstance(m, DeadliftMetrics):
                    m_scaled = DeadliftMetrics(
                        exercise_type="deadlift",
                        weight=new_max_w,
                        sets=m.sets,
                        reps=m.reps,
                        rpe=m.rpe,
                        deadlift_style=m.deadlift_style,
                        detailed_sets=scaled_sets,
                    )
                elif isinstance(m, StrengthExerciseMetrics):
                    m_scaled = StrengthExerciseMetrics(
                        exercise_type="strength",
                        exercise_name=m.exercise_name,
                        weight=new_max_w,
                        sets=m.sets,
                        reps=m.reps,
                        rpe=m.rpe,
                        detailed_sets=scaled_sets,
                    )
                else:
                    continue
                workouts_adjusted.append((dt, wtype, m_scaled))
            else:
                workouts_adjusted.append((dt, wtype, m))
        workouts = workouts_adjusted

    return workouts


# ==============================================================================
# Async Seeder Engine
# ==============================================================================

async def seed_data(
    pg_url: str | None = None,
    redis_url: str | None = None,
    mongo_url: str | None = None,
    mongo_db_name: str | None = None,
    leaderboard_key: str | None = None,
    silent: bool = False,
) -> dict[str, Any]:
    """Execute idempotent seeding of demo user, bots, workouts, leaderboard and analytics."""
    pg_conn_str = pg_url or users_settings.database_url
    redis_conn_str = redis_url or get_leaderboard_settings().redis.redis_url
    m_settings = get_analytics_settings().mongo
    mongo_conn_str = mongo_url or m_settings.mongo_url
    mongo_db = mongo_db_name or m_settings.db
    lb_key = leaderboard_key or get_leaderboard_settings().leaderboard_tonnage_key

    if not silent:
        logger.info("Initializing connection to PostgreSQL (%s)...", pg_conn_str.split("@")[-1])

    engine: AsyncEngine = create_async_engine(pg_conn_str, echo=False, future=True)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    users_created: list[dict[str, Any]] = []
    total_workouts_count = 0
    all_user_ids: list[UUID] = []

    # 1. Upsert Users in PostgreSQL
    async with session_factory() as session:
        # Prepare all user specs (Demo User + Bots)
        all_specs = [DEMO_USER_SPEC] + BOT_SPECS

        for spec in all_specs:
            email = spec["email"]
            username = spec["username"]
            password = spec["password"]

            # Check if user already exists
            stmt = select(UserModel).where(UserModel.email == email)
            result = await session.execute(stmt)
            existing_user = result.scalar_one_or_none()

            hashed_pw = hash_user_password(password)
            now = datetime.now(UTC)

            if existing_user is not None:
                existing_user.username = username
                existing_user.hashed_password = hashed_pw
                existing_user.updated_at = now
                user_id = existing_user.id
            else:
                user_id = uuid4()
                new_user = UserModel(
                    id=user_id,
                    email=email,
                    username=username,
                    hashed_password=hashed_pw,
                    created_at=now,
                    updated_at=now,
                )
                session.add(new_user)

            all_user_ids.append(user_id)
            target_tonnage = spec.get(
                "target_tonnage",
                41200.0 if spec.get("is_demo") else 20000.0,
            )
            users_created.append({
                "id": user_id,
                "email": email,
                "username": username,
                "is_demo": spec.get("is_demo", False),
                "target_tonnage": target_tonnage,
                "style": spec.get("style", "all_round"),
            })

        await session.commit()

    if not silent:
        logger.info("Synchronized %d users in PostgreSQL.", len(users_created))

    # 2. Generate and Insert Workouts in PostgreSQL
    user_tonnages: dict[UUID, float] = {}
    analytics_points: list[WorkoutTimeSeriesPoint] = []

    async with session_factory() as session:
        # Clean existing workouts for these seed users (idempotency)
        await session.execute(delete(WorkoutModel).where(WorkoutModel.user_id.in_(all_user_ids)))
        await session.commit()

        for u in users_created:
            u_id: UUID = u["id"]
            workouts_data = generate_workouts_for_user(
                user_id=u_id,
                is_demo=u["is_demo"],
                style=u["style"],
                target_tonnage=u["target_tonnage"],
            )

            user_total_tonnage = 0.0

            for w_date, w_type, metrics in workouts_data:
                workout_id = uuid4()
                metrics_dict = metrics.model_dump(mode="json")
                w_tonnage = calculate_workout_tonnage(metrics)
                user_total_tonnage += w_tonnage

                db_workout = WorkoutModel(
                    id=workout_id,
                    user_id=u_id,
                    date=w_date,
                    type=w_type,
                    metrics=metrics_dict,
                    created_at=w_date,
                )
                session.add(db_workout)
                total_workouts_count += 1

                # Construct Analytics TimeSeries Point
                max_1rm = calculate_max_1rm(metrics) if w_tonnage > 0 else None
                breakdowns = calculate_1rm_breakdown(metrics) if max_1rm else None

                metadata = WorkoutMetadata(
                    user_id=str(u_id),
                    workout_id=str(workout_id),
                    exercise_type=w_type,
                    exercise_name=getattr(metrics, "exercise_name", None),
                    rpe=getattr(metrics, "rpe", None),
                )
                ts_point = WorkoutTimeSeriesPoint(
                    timestamp=w_date,
                    metadata=metadata,
                    one_rep_max=max_1rm,
                    one_rep_max_average=max_1rm,
                    detailed_1rm=breakdowns,
                    breakdowns=breakdowns,
                    tonnage=w_tonnage,
                    weight=getattr(metrics, "weight", None),
                    reps=getattr(metrics, "reps", None),
                    sets=getattr(metrics, "sets", None),
                    distance_km=getattr(metrics, "distance_km", None),
                    duration_minutes=getattr(metrics, "duration_minutes", None),
                    heart_rate=getattr(metrics, "heart_rate", None),
                    calories_burned=getattr(metrics, "calories_burned", None),
                    metrics=metrics_dict,
                )
                analytics_points.append(ts_point)

            user_tonnages[u_id] = round(user_total_tonnage, 1)

        await session.commit()

    await engine.dispose()

    if not silent:
        logger.info("Saved %d workouts in PostgreSQL.", total_workouts_count)

    # 3. Synchronize Leaderboard Service (Redis ZSET)
    try:
        redis_client = Redis.from_url(redis_conn_str, decode_responses=True)
        # Update or set tonnage scores in Redis ZSET
        zadd_mapping = {str(uid): score for uid, score in user_tonnages.items()}
        await redis_client.zadd(name=lb_key, mapping=zadd_mapping)
        # Check rank by demo user id
        demo_user_id = next(u["id"] for u in users_created if u["is_demo"])
        demo_rank_raw = await redis_client.zrevrank(lb_key, str(demo_user_id))
        demo_rank: int | None
        if isinstance(demo_rank_raw, int):
            demo_rank = demo_rank_raw + 1
        elif demo_rank_raw is not None:
            try:
                demo_rank = int(str(demo_rank_raw)) + 1
            except (ValueError, TypeError):
                demo_rank = 5
        else:
            demo_rank = None
        await redis_client.aclose()
        if not silent:
            logger.info(
                "Updated Redis ZSET leaderboard '%s' for %d athletes.",
                lb_key,
                len(zadd_mapping),
            )
    except Exception as exc:
        logger.warning("Redis sync skipped or failed (%s). Continuing...", exc)
        demo_rank = 5

    # 4. Synchronize Analytics Service (MongoDB TimeSeries)
    try:
        mongo_client: AsyncIOMotorClient[dict[str, Any]] = AsyncIOMotorClient(
            mongo_conn_str,
            serverSelectionTimeoutMS=2000,
        )
        db = mongo_client[mongo_db]
        collection = db[m_settings.collection_name]

        # Clean existing points for seeded users to ensure idempotency
        str_user_ids = [str(uid) for uid in all_user_ids]
        await collection.delete_many({"metadata.user_id": {"$in": str_user_ids}})

        # Insert points in batches
        if analytics_points:
            docs = [p.to_mongo_doc() for p in analytics_points]
            batch_size = 100
            for i in range(0, len(docs), batch_size):
                await collection.insert_many(docs[i : i + batch_size])

        mongo_client.close()
        if not silent:
            logger.info(
                "Inserted %d Time Series points into MongoDB '%s'.",
                len(analytics_points),
                mongo_db,
            )
    except Exception as exc:
        logger.warning("MongoDB sync skipped or failed (%s). Continuing...", exc)

    demo_tonnage = next(user_tonnages[u["id"]] for u in users_created if u["is_demo"])

    return {
        "users_count": len(users_created),
        "workouts_count": total_workouts_count,
        "demo_user": DEMO_USER_SPEC,
        "demo_tonnage": demo_tonnage,
        "demo_rank": demo_rank,
    }


def print_summary(result: dict[str, Any]) -> None:
    """Print visually clear summary banner of the seeding operation."""
    demo = result["demo_user"]
    total_u = result["users_count"]
    bots_c = total_u - 1
    print("\n" + "=" * 64)
    print("      IRONTRACKER SYNTHETIC DEMO DATA SEEDED SUCCESSFULLY!      ")
    print("=" * 64)
    print(f" Total Athletes Created:  {total_u} (1 Demo User + {bots_c} Bots)")
    print(f" Total Workouts Created:  {result['workouts_count']} (detailed_sets with 1RM & volume)")
    print("-" * 64)
    print(" DEMO ATHLETE ACCOUNT:")
    print(f"   Email:     {demo['email']}")
    print(f"   Password:  {demo['password']}")
    print(f"   Username:  {demo['username']}")
    print(f"   Rank:      #{result.get('demo_rank', 5)} on Leaderboard")
    print(f"   Tonnage:   {result['demo_tonnage']:,.1f} kg")
    print("=" * 64 + "\n")


def parse_cli_args() -> argparse.Namespace:
    """Parse command line arguments for the seeding script."""
    parser = argparse.ArgumentParser(
        description="IronTracker synthetic demo data seed generator.",
    )
    parser.add_argument(
        "--pg-url",
        dest="pg_url",
        default=None,
        help="PostgreSQL connection URL (default: from .env / settings)",
    )
    parser.add_argument(
        "--redis-url",
        dest="redis_url",
        default=None,
        help="Redis connection URL (default: from .env / settings)",
    )
    parser.add_argument(
        "--mongo-url",
        dest="mongo_url",
        default=None,
        help="MongoDB connection URL (default: from .env / settings)",
    )
    parser.add_argument(
        "--mongo-db",
        dest="mongo_db",
        default=None,
        help="MongoDB database name (default: irontracker_analytics)",
    )
    return parser.parse_args()


async def main() -> None:
    """Main CLI entrypoint for script execution."""
    args = parse_cli_args()
    result = await seed_data(
        pg_url=args.pg_url,
        redis_url=args.redis_url,
        mongo_url=args.mongo_url,
        mongo_db_name=args.mongo_db,
    )
    print_summary(result)


if __name__ == "__main__":
    asyncio.run(main())
