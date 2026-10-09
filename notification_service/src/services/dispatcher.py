from __future__ import annotations

import asyncio
import logging
import secrets
from uuid import UUID

from notification_service.src.schemas.dispatch import NotificationDispatchResult
from shared.contracts.src.commands import (
    SendAchievementNotificationCommand,
    SendNotificationCommand,
)

logger = logging.getLogger(__name__)


class NotificationProviderError(Exception):
    """Raised when the third-party notification provider is unavailable or fails."""


class NotificationDispatcher:
    """Dispatches notification commands to simulated email and push providers."""

    def __init__(
        self,
        simulate_failure: bool = False,
        fail_rate: float = 0.0,
    ) -> None:
        self.simulate_failure = simulate_failure
        self.fail_rate = max(0.0, min(1.0, fail_rate))

    def _check_simulation_failure(self) -> None:
        """Trigger simulated provider failure if configured."""
        if self.simulate_failure:
            logger.warning("Simulated failure triggered (simulate_failure=True)")
            raise NotificationProviderError("Provider unavailable (simulation)")

        if self.fail_rate > 0.0 and secrets.SystemRandom().random() < self.fail_rate:
            logger.warning("Simulated failure triggered (fail_rate=%.2f)", self.fail_rate)
            raise NotificationProviderError("Provider unavailable (fail_rate triggered)")

    async def send_email(self, user_id: UUID, title: str, message: str) -> bool:
        """Simulate asynchronous email transmission to recipient."""
        self._check_simulation_failure()
        await asyncio.sleep(0)
        logger.info("Email delivered to user %s: [%s] %s", user_id, title, message)
        return True

    async def send_push(self, user_id: UUID, title: str, message: str) -> bool:
        """Simulate asynchronous push transmission to recipient."""
        self._check_simulation_failure()
        await asyncio.sleep(0)
        logger.info("Push delivered to user %s: [%s] %s", user_id, title, message)
        return True

    async def dispatch(
        self,
        command: SendNotificationCommand | SendAchievementNotificationCommand,
    ) -> NotificationDispatchResult:
        """Process command, format payload, and dispatch via simulated provider."""
        if isinstance(command, SendNotificationCommand):
            if command.channel == "email":
                await self.send_email(command.user_id, command.title, command.message)
            elif command.channel == "push":
                await self.send_push(command.user_id, command.title, command.message)
            else:
                raise ValueError(f"Unsupported notification channel: {command.channel}")

            return NotificationDispatchResult(
                command_id=command.command_id,
                user_id=command.user_id,
                channel=command.channel,
                status="sent",
                details={"title": command.title, "message": command.message},
            )

        if isinstance(command, SendAchievementNotificationCommand):
            formatted_title = (
                command.title if command.title.startswith("🏆") else f"🏆 {command.title}"
            )
            formatted_message = command.message
            if command.achievement_code == "bench_press_record":
                formatted_message = f"New Personal Record! {command.message}"

            await self.send_push(command.user_id, formatted_title, formatted_message)

            return NotificationDispatchResult(
                command_id=command.command_id,
                user_id=command.user_id,
                channel="push",
                status="sent",
                details={
                    "achievement_code": command.achievement_code,
                    "title": formatted_title,
                    "message": formatted_message,
                },
            )

        raise ValueError(f"Unknown command type: {type(command)}")


__all__ = [
    "NotificationDispatcher",
    "NotificationProviderError",
]
