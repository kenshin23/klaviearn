"""Shared fixtures.

app.db builds its engine at import time from KLAVIEARN_DB, and app.main calls
create_all() at import time too — so the env var has to be set before anything
under app.* is imported. conftest is imported before the test modules, which
makes this the right (and only) place for it.
"""
import os
import pathlib
import tempfile

_TMP = tempfile.mkdtemp(prefix="klaviearn-tests-")
os.environ["KLAVIEARN_DB"] = str(pathlib.Path(_TMP) / "test.db")
os.environ.setdefault("KLAVIEARN_ENV", "dev")
# A real-length secret: the dev fallback is 29 bytes and PyJWT warns on it.
os.environ.setdefault("KLAVIEARN_SECRET", "test-secret-long-enough-for-hs256-abcdef")

import pytest  # noqa: E402  — must follow the env setup above
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app import auth  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402

EMAIL = "pianist@example.com"
PASSWORD = "correct horse battery"


@pytest.fixture(autouse=True)
def fresh_state():
    """Every test starts with empty tables and an empty rate-limit window.

    The rate limiter keeps per-IP state in a module-global dict; without the
    clear, the eleventh auth call anywhere in the suite would 429.
    """
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    auth._attempts.clear()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def token(client):
    r = client.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def auth_client(client, token):
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture
def user_id(db, token):  # noqa: ARG001 — `token` is what creates the user
    return db.scalar(select(User)).id
