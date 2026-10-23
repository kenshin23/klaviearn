import hmac
import os
import time
from collections import defaultdict, deque
from datetime import timedelta

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select

from .db import get_db
from .models import User, utcnow

# A fixed fallback secret is only acceptable on a dev machine; any deployed
# instance must bring its own (e.g. `openssl rand -hex 32`).
ENV = os.environ.get("KLAVIEARN_ENV", "dev")
SECRET = os.environ.get("KLAVIEARN_SECRET")
if not SECRET:
    if ENV != "dev":
        raise RuntimeError("KLAVIEARN_SECRET must be set when KLAVIEARN_ENV is not 'dev'")
    SECRET = "dev-secret-not-for-production"
ALGO = "HS256"
TOKEN_DAYS = 30

# Signing up on a deployed instance takes a shared code, handed out on
# purpose. Dev leaves it open so a fresh clone can register without ceremony.
#
# Unset outside dev means signups are CLOSED, not open: forgetting the
# variable should cost somebody an account, not quietly hold the door open
# again. It deliberately does not stop the app booting the way a missing
# SECRET does — practising matters more than registering, and an instance
# that serves its existing users with signups off is the better failure.
SIGNUP_CODE = os.environ.get("KLAVIEARN_SIGNUP_CODE", "")
OPEN_WITHOUT_CODE = ENV == "dev"

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()

# Per-IP sliding-window rate limit on the auth endpoints: makes credential
# brute-forcing and email enumeration impractical.
RATE_LIMIT, RATE_WINDOW_S = 10, 60
_attempts: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    window = _attempts[ip]
    now = time.monotonic()
    while window and now - window[0] > RATE_WINDOW_S:
        window.popleft()
    if len(window) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many attempts — try again in a minute")
    window.append(now)


class Credentials(BaseModel):
    email: str
    password: str


class Registration(Credentials):
    # Defaulted rather than required: a client that has not been told about
    # the code should be turned away by the gate below, with a message about
    # the code, instead of by a 422 about its request shape.
    code: str = ""


def check_signup_code(code: str) -> None:
    """Let through only someone who was given the code.

    Checked before the request touches the database at all, so that someone
    without the code cannot use the duplicate-email conflict as an oracle for
    who already has an account here.

    compare_digest because this is a shared secret: a plain == leaks how much
    of a guess was right through how long the comparison took.
    """
    if not SIGNUP_CODE:
        if OPEN_WITHOUT_CODE:
            return
        raise HTTPException(status_code=403, detail="Signups are closed")
    if not hmac.compare_digest(code.encode(), SIGNUP_CODE.encode()):
        raise HTTPException(status_code=403, detail="That signup code is not right")


class TokenOut(BaseModel):
    token: str
    email: str


def make_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "ver": user.token_version,
        "exp": utcnow() + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGO])
        user = db.get(User, int(payload["sub"]))
        # Tokens minted before the last password change no longer verify.
        # Absent claim == 0, so tokens issued before this existed still work.
        if user is not None and payload.get("ver", 0) != user.token_version:
            user = None
    except (jwt.PyJWTError, KeyError, ValueError):
        user = None
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


@router.post("/register", response_model=TokenOut, dependencies=[Depends(rate_limit)])
def register(body: Registration, db=Depends(get_db)):
    check_signup_code(body.code)
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
    return TokenOut(token=make_token(user), email=user.email)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(rate_limit)])
def login(body: Credentials, db=Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not bcrypt.checkpw(body.password.encode(), user.pw_hash.encode()):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    return TokenOut(token=make_token(user), email=user.email)
