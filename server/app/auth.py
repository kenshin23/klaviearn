import os
from datetime import timedelta

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select

from .db import get_db
from .models import User, utcnow

SECRET = os.environ.get("KLAVIEARN_SECRET", "dev-secret-change-before-deploying")
ALGO = "HS256"
TOKEN_DAYS = 30

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()


class Credentials(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    token: str
    email: str


def make_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": utcnow() + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGO])
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        user = None
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


@router.post("/register", response_model=TokenOut)
def register(body: Credentials, db=Depends(get_db)):
    email = body.email.strip().lower()
    if "@" not in email or len(email) < 5:
        raise HTTPException(status_code=422, detail="That doesn't look like an email address")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    user = User(
        email=email,
        pw_hash=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
    )
    db.add(user)
    db.commit()
    return TokenOut(token=make_token(user.id), email=user.email)


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, db=Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not bcrypt.checkpw(body.password.encode(), user.pw_hash.encode()):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    return TokenOut(token=make_token(user.id), email=user.email)
