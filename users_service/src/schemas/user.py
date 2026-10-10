from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

EmailType = Annotated[
    str,
    Field(
        pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$",
        description="Valid email address string",
    ),
]


class UserRegister(BaseModel):
    """Payload for registering a new athlete user account."""

    model_config = ConfigDict(extra="forbid")

    email: EmailType = Field(
        description="Unique athlete email address",
        examples=["athlete@irontracker.io"],
    )
    username: str = Field(
        min_length=2,
        max_length=50,
        description="Display name of the athlete",
        examples=["IronLifter"],
    )
    password: str = Field(
        min_length=6,
        max_length=128,
        description="Plaintext password to be hashed",
        examples=["StrongSecret123!"],
    )


class UserLogin(BaseModel):
    """Payload for authenticating and requesting a JWT access token."""

    model_config = ConfigDict(extra="forbid")

    email: EmailType = Field(
        description="Registered athlete email address",
        examples=["athlete@irontracker.io"],
    )
    password: str = Field(
        min_length=1,
        description="Account password",
        examples=["StrongSecret123!"],
    )


class TokenResponse(BaseModel):
    """Response containing signed JWT access token."""

    model_config = ConfigDict(extra="forbid")

    access_token: str = Field(description="Stateless signed JWT access token")
    token_type: str = Field(default="bearer", description="Token scheme type")
    user_id: UUID = Field(description="Unique ID of authenticated user")
    email: str = Field(description="Email of authenticated user")


class UserResponse(BaseModel):
    """Public athlete profile response."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID = Field(description="Unique athlete ID")
    email: str = Field(description="Athlete email address")
    username: str = Field(description="Display username")
    created_at: datetime = Field(description="Account creation datetime")
    updated_at: datetime = Field(description="Last update datetime")


class UserUpdate(BaseModel):
    """Payload for updating athlete profile details."""

    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(
        default=None,
        min_length=2,
        max_length=50,
        description="New display username",
    )
    password: str | None = Field(
        default=None,
        min_length=6,
        max_length=128,
        description="New account password",
    )
