from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e71b29a83412"
down_revision: str | None = "c341729036f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exercises",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("target_muscle_groups", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("equipment", sa.String(length=50), server_default="other", nullable=False),
        sa.Column("is_custom", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exercises_category"), "exercises", ["category"], unique=False)
    op.create_index(op.f("ix_exercises_is_custom"), "exercises", ["is_custom"], unique=False)
    op.create_index(op.f("ix_exercises_name"), "exercises", ["name"], unique=False)
    op.create_index(op.f("ix_exercises_user_id"), "exercises", ["user_id"], unique=False)

    # Insert default system exercises via raw SQL for full offline (--sql) and online compatibility
    op.execute(
        """
        INSERT INTO exercises (
            id, user_id, name, category, target_muscle_groups, equipment, is_custom
        )
        VALUES
        (
            '11111111-1111-1111-1111-111111110001', NULL,
            'Жим штанги лежа', 'strength',
            '["chest", "shoulders", "arms"]'::jsonb, 'barbell', false
        ),
        (
            '11111111-1111-1111-1111-111111110002', NULL,
            'Приседания со штангой', 'strength',
            '["legs", "core"]'::jsonb, 'barbell', false
        ),
        (
            '11111111-1111-1111-1111-111111110003', NULL,
            'Становая тяга', 'strength',
            '["back", "legs", "core"]'::jsonb, 'barbell', false
        ),
        (
            '11111111-1111-1111-1111-111111110004', NULL,
            'Армейский жим стоя', 'strength',
            '["shoulders", "arms", "core"]'::jsonb, 'barbell', false
        ),
        (
            '11111111-1111-1111-1111-111111110005', NULL,
            'Подтягивания', 'bodyweight',
            '["back", "arms"]'::jsonb, 'bodyweight', false
        ),
        (
            '11111111-1111-1111-1111-111111110006', NULL,
            'Тяга штанги в наклоне', 'strength',
            '["back", "arms"]'::jsonb, 'barbell', false
        ),
        (
            '11111111-1111-1111-1111-111111110007', NULL,
            'Беговая дорожка', 'cardio',
            '["legs", "core"]'::jsonb, 'machine', false
        ),
        (
            '11111111-1111-1111-1111-111111110008', NULL,
            'Гребной тренажер', 'cardio',
            '["full_body", "back", "legs"]'::jsonb, 'machine', false
        )
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_exercises_user_id"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_name"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_is_custom"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_category"), table_name="exercises")
    op.drop_table("exercises")
