from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    # Naive UTC throughout: SQLite round-trips naive datetimes, and mixing
    # aware/naive breaks comparisons.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    pw_hash: Mapped[str] = mapped_column(String)
    settings_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ItemSRS(Base):
    """Spaced-repetition state for one (user, note-on-staff) pair."""

    __tablename__ = "item_srs"
    __table_args__ = (UniqueConstraint("user_id", "item_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    item_key: Mapped[str] = mapped_column(String, index=True)  # e.g. "treble:60"
    ease: Mapped[float] = mapped_column(default=2.5)
    interval_days: Mapped[float] = mapped_column(default=0.0)
    due_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    reps: Mapped[int] = mapped_column(default=0)
    lapses: Mapped[int] = mapped_column(default=0)
    streak: Mapped[int] = mapped_column(default=0)
    level: Mapped[int] = mapped_column(default=0)  # scaffold: 0 full, 1 colors, 2 plain
    seen: Mapped[int] = mapped_column(default=0)
    correct: Mapped[int] = mapped_column(default=0)


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    node_id: Mapped[str] = mapped_column(String)
    drill: Mapped[str] = mapped_column(String)
    ok: Mapped[int] = mapped_column(default=0)
    total: Mapped[int] = mapped_column(default=0)
    xp: Mapped[int] = mapped_column(default=0)
    finished_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Attempt(Base):
    """Per-exercise log — feeds the future confusion-matrix stats."""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    item_key: Mapped[str] = mapped_column(String)
    hit: Mapped[bool] = mapped_column(default=False)
    ts: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
