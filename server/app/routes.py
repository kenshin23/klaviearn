import json
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from . import srs
from .auth import current_user
from .content import NODE_BY_ID, SKILL_NODES, node_items
from .db import get_db
from .models import Attempt, ItemSRS, SessionRecord, utcnow

router = APIRouter(tags=["app"])

DEFAULT_SETTINGS = {"scaffold": "auto", "strictOctave": False, "staffSize": "large"}


def day_streak(db, user_id: int) -> int:
    rows = db.scalars(
        select(SessionRecord.finished_at)
        .where(SessionRecord.user_id == user_id)
        .order_by(SessionRecord.finished_at.desc())
    ).all()
    days = sorted({r.date() for r in rows}, reverse=True)
    if not days:
        return 0
    today = utcnow().date()
    if days[0] not in (today, today - timedelta(days=1)):
        return 0  # streak broken
    streak = 1
    for newer, older in zip(days, days[1:]):
        if (newer - older).days == 1:
            streak += 1
        else:
            break
    return streak


def xp_total(db, user_id: int) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(SessionRecord.xp), 0)).where(
            SessionRecord.user_id == user_id
        )
    )


@router.get("/me")
def me(user=Depends(current_user), db=Depends(get_db)):
    return {
        "email": user.email,
        "settings": {**DEFAULT_SETTINGS, **json.loads(user.settings_json or "{}")},
        "xp": xp_total(db, user.id),
        "streakDays": day_streak(db, user.id),
    }


@router.put("/me/settings")
def save_settings(settings: dict, user=Depends(current_user), db=Depends(get_db)):
    user.settings_json = json.dumps({**DEFAULT_SETTINGS, **settings})
    db.add(user)
    db.commit()
    return {"ok": True}


@router.get("/tree")
def tree(user=Depends(current_user), db=Depends(get_db)):
    now = utcnow()
    states = {
        s.item_key: s
        for s in db.scalars(select(ItemSRS).where(ItemSRS.user_id == user.id))
    }
    nodes = []
    for node in SKILL_NODES:
        keys = [k for k, _ in node_items(node)]
        seen = sum(states[k].seen for k in keys if k in states)
        correct = sum(states[k].correct for k in keys if k in states)
        due = sum(1 for k in keys if k in states and states[k].due_at <= now)
        levels = [states[k].level for k in keys if k in states]
        nodes.append(
            {
                **node,
                "accuracy": (correct / seen) if seen else None,
                "dueCount": due,
                "mastery": (sum(levels) / (len(keys) * srs.MAX_LEVEL)) if levels else 0,
            }
        )
    return {"nodes": nodes}


class SessionStart(BaseModel):
    node_id: str
    drill: str


class ResultIn(BaseModel):
    item: str = Field(max_length=32)
    hit: bool


class SessionComplete(BaseModel):
    node_id: str
    drill: str
    # Generous bound: sessions are 10 exercises; this only stops abuse.
    results: list[ResultIn] = Field(max_length=50)


@router.post("/sessions")
def start_session(body: SessionStart, user=Depends(current_user), db=Depends(get_db)):
    node = NODE_BY_ID.get(body.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Unknown skill node")
    return {"exercises": srs.build_session(db, user.id, node, body.drill)}


@router.post("/sessions/complete")
def complete_session(body: SessionComplete, user=Depends(current_user), db=Depends(get_db)):
    if not body.results:
        raise HTTPException(status_code=422, detail="No results")
    node = NODE_BY_ID.get(body.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Unknown skill node")
    valid_items = {k for k, _ in node_items(node)}
    if any(r.item not in valid_items for r in body.results):
        raise HTTPException(status_code=422, detail="Result items don't belong to that skill node")
    ok = 0
    by_item: dict[str, list[bool]] = {}
    for r in body.results:
        by_item.setdefault(r.item, []).append(r.hit)
        db.add(Attempt(user_id=user.id, item_key=r.item, hit=r.hit))
        ok += r.hit
    for item, hits in by_item.items():
        srs.record_review(srs.get_or_create(db, user.id, item), hits)
    xp = 10 * ok + (5 if ok == len(body.results) else 0)
    db.add(
        SessionRecord(
            user_id=user.id,
            node_id=body.node_id,
            drill=body.drill,
            ok=ok,
            total=len(body.results),
            xp=xp,
        )
    )
    db.commit()
    return {
        "xpGained": xp,
        "xp": xp_total(db, user.id),
        "streakDays": day_streak(db, user.id),
    }
