"""Tables (ROADMAP 4.4, simplified for v1.0: countries and cities live inside snapshots).

All JSON columns are JSONB on Postgres and JSON on SQLite. Enumerations are plain
strings validated in the services (Literal types), so a migration never has to touch
a database enum type.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from arena.db import Base

JSONVariant = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(UTC)


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    mode: Mapped[str] = mapped_column(String(16), default="live")  # live | playtest
    status: Mapped[str] = mapped_column(String(16), default="lobby")  # lobby|running|finished
    title: Mapped[str] = mapped_column(String(200), default="")
    rules_version: Mapped[str] = mapped_column(String(32))
    rules_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONVariant)
    scenario_id: Mapped[str] = mapped_column(String(64))
    seed: Mapped[int] = mapped_column(Integer)
    current_round: Mapped[int] = mapped_column(Integer, default=1)
    phase: Mapped[str] = mapped_column(String(16), default="orders")  # orders|resolving|done
    host_code: Mapped[str] = mapped_column(String(32), unique=True)

    players: Mapped[list[Player]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )
    rounds: Mapped[list[Round]] = relationship(back_populates="game", cascade="all, delete-orphan")


class Player(Base):
    """Who controls a country in a game."""

    __tablename__ = "players"
    __table_args__ = (UniqueConstraint("game_id", "country_id", name="uq_players_game_country"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    country_id: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(16), default="human")  # human | bot | llm
    agent_config: Mapped[dict[str, Any]] = mapped_column(JSONVariant, default=dict)
    join_code: Mapped[str] = mapped_column(String(32), unique=True)
    display_name: Mapped[str] = mapped_column(String(100), default="")
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped[Game] = relationship(back_populates="players")


class Round(Base):
    __tablename__ = "rounds"
    __table_args__ = (UniqueConstraint("game_id", "number", name="uq_rounds_game_number"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open|resolving|resolved
    laugh_winner: Mapped[str | None] = mapped_column(String(32), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped[Game] = relationship(back_populates="rounds")


class Order(Base):
    """One country's orders for one round (CountryOrders as JSON); resubmission replaces."""

    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint(
            "game_id", "round_number", "country_id", name="uq_orders_game_round_country"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    round_number: Mapped[int] = mapped_column(Integer)
    country_id: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONVariant)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Event(Base):
    """Append-only journal, one row per engine event."""

    __tablename__ = "events"
    __table_args__ = (
        UniqueConstraint("game_id", "round_number", "seq", name="uq_events_game_round_seq"),
        Index("ix_events_game_round", "game_id", "round_number"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"), primary_key=True, autoincrement=True
    )
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    round_number: Mapped[int] = mapped_column(Integer)
    seq: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(48))
    schema_version: Mapped[int] = mapped_column(Integer)
    actor: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target: Mapped[str | None] = mapped_column(String(32), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONVariant)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StateSnapshot(Base):
    """Full GameState after each round; round_number 0 is the initial state."""

    __tablename__ = "state_snapshots"
    __table_args__ = (UniqueConstraint("game_id", "round_number", name="uq_snapshots_game_round"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    round_number: Mapped[int] = mapped_column(Integer)
    state_schema_version: Mapped[int] = mapped_column(Integer)
    state: Mapped[dict[str, Any]] = mapped_column(JSONVariant)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Message(Base):
    """Debate / negotiation messages (empty in v1.0, used by chat and LLM agents later)."""

    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_game_round", "game_id", "round_number"),)

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"), primary_key=True, autoincrement=True
    )
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    round_number: Mapped[int] = mapped_column(Integer)
    channel: Mapped[str] = mapped_column(String(32), default="debate")
    sender_country: Mapped[str | None] = mapped_column(String(32), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
