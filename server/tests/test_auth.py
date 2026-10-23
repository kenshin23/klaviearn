"""Accounts: registration, login, tokens, rate limiting, password changes."""
import jwt
import pytest
from sqlalchemy import select

from app import auth
from app.models import User

from .conftest import EMAIL, PASSWORD

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"


def register(client, email=EMAIL, password=PASSWORD, code=None):
    body = {"email": email, "password": password}
    if code is not None:
        body["code"] = code
    return client.post(REGISTER, json=body)


@pytest.fixture
def gated(monkeypatch):
    """A deployment with a signup code set.

    The module reads the environment once at import, so the test moves the
    value rather than the variable.
    """
    monkeypatch.setattr(auth, "SIGNUP_CODE", "let-me-in-please")
    monkeypatch.setattr(auth, "OPEN_WITHOUT_CODE", False)
    return "let-me-in-please"


# --- Registration ------------------------------------------------------------

def test_register_returns_a_token_and_the_normalised_email(client):
    r = register(client)
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL
    assert r.json()["token"]


@pytest.mark.parametrize("raw", ["  PIANIST@Example.COM  ", "Pianist@example.com"])
def test_register_normalises_case_and_whitespace(client, raw):
    assert register(client, email=raw).json()["email"] == EMAIL


def test_register_rejects_a_duplicate_email(client):
    register(client)
    r = register(client, email="PIANIST@example.com")
    assert r.status_code == 409


@pytest.mark.parametrize("password", ["", "short", "1234567"])
def test_register_rejects_a_short_password(client, password):
    assert register(client, password=password).status_code == 422


@pytest.mark.parametrize("email", ["not-an-email", "a@b", ""])
def test_register_rejects_a_malformed_email(client, email):
    assert register(client, email=email).status_code == 422


def test_the_password_is_not_stored_in_the_clear(client, db):
    register(client)
    user = db.scalar(select(User))
    assert PASSWORD not in user.pw_hash
    assert user.pw_hash.startswith("$2b$")


# --- Login -------------------------------------------------------------------

def test_login_with_the_right_password(client):
    register(client)
    r = client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["token"]


def test_login_is_case_insensitive_on_email(client):
    register(client)
    r = client.post(LOGIN, json={"email": "PIANIST@EXAMPLE.COM", "password": PASSWORD})
    assert r.status_code == 200


def test_login_rejects_a_wrong_password(client):
    register(client)
    r = client.post(LOGIN, json={"email": EMAIL, "password": "not the password"})
    assert r.status_code == 401


def test_login_rejects_an_unknown_account(client):
    r = client.post(LOGIN, json={"email": "nobody@example.com", "password": PASSWORD})
    assert r.status_code == 401


def test_unknown_account_and_wrong_password_are_indistinguishable(client):
    """Same status and message either way, so the endpoint can't enumerate emails."""
    register(client)
    wrong_pw = client.post(LOGIN, json={"email": EMAIL, "password": "nope-nope-nope"})
    no_user = client.post(LOGIN, json={"email": "ghost@example.com", "password": "nope-nope-nope"})
    assert wrong_pw.status_code == no_user.status_code
    assert wrong_pw.json() == no_user.json()


# --- Tokens ------------------------------------------------------------------

def test_a_token_grants_access(auth_client):
    assert auth_client.get("/api/me").status_code == 200


def test_a_request_without_a_token_is_refused(client):
    assert client.get("/api/me").status_code in (401, 403)


@pytest.mark.parametrize("bad", ["garbage", "a.b.c", ""])
def test_a_bad_token_is_refused(client, bad):
    r = client.get("/api/me", headers={"Authorization": f"Bearer {bad}"})
    assert r.status_code in (401, 403)


def test_a_token_for_a_deleted_user_is_refused(client, db, token):
    db.delete(db.scalar(select(User)))
    db.commit()
    r = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_a_token_signed_with_another_secret_is_refused(client):
    forged = jwt.encode({"sub": "1"}, "some-other-secret", algorithm="HS256")
    r = client.get("/api/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


# --- Rate limiting -----------------------------------------------------------

def test_auth_endpoints_are_rate_limited(client):
    for _ in range(auth.RATE_LIMIT):
        client.post(LOGIN, json={"email": EMAIL, "password": "wrong-password"})
    r = client.post(LOGIN, json={"email": EMAIL, "password": "wrong-password"})
    assert r.status_code == 429


def test_the_rate_limit_covers_registration_too(client):
    for i in range(auth.RATE_LIMIT):
        register(client, email=f"user{i}@example.com")
    assert register(client, email="one-too-many@example.com").status_code == 429


def test_the_rate_limit_window_is_per_ip(client):
    for _ in range(auth.RATE_LIMIT):
        client.post(LOGIN, json={"email": EMAIL, "password": "wrong-password"})
    auth._attempts.clear()  # stand-in for a different client IP
    assert client.post(LOGIN, json={"email": EMAIL, "password": "wrong"}).status_code == 401


# --- Changing a password -----------------------------------------------------

NEW_PASSWORD = "an even better passphrase"


def test_change_password_then_log_in_with_the_new_one(auth_client):
    r = auth_client.put("/api/me/password", json={"current": PASSWORD, "new": NEW_PASSWORD})
    assert r.status_code == 200

    assert auth_client.post(LOGIN, json={"email": EMAIL, "password": NEW_PASSWORD}).status_code == 200
    assert auth_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code == 401


def test_change_password_requires_the_current_one(auth_client):
    r = auth_client.put("/api/me/password", json={"current": "wrong", "new": NEW_PASSWORD})
    assert r.status_code == 401
    # ...and the old password still works.
    assert auth_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code == 200


def test_change_password_enforces_a_minimum_length(auth_client):
    r = auth_client.put("/api/me/password", json={"current": PASSWORD, "new": "short"})
    assert r.status_code == 422


def test_change_password_needs_authentication(client):
    r = client.put("/api/me/password", json={"current": PASSWORD, "new": NEW_PASSWORD})
    assert r.status_code in (401, 403)


# --- Session invalidation (security review) ----------------------------------

def test_changing_the_password_invalidates_tokens_issued_before_it(client, token):
    """A stolen token must not outlive the password change made to revoke it."""
    client.headers["Authorization"] = f"Bearer {token}"
    assert client.put(
        "/api/me/password", json={"current": PASSWORD, "new": NEW_PASSWORD}
    ).status_code == 200

    # Same token, after the change.
    assert client.get("/api/me").status_code == 401


def test_an_admin_reset_also_invalidates_existing_tokens(client, db, token):
    from app.manage import reset_password

    reset_password(db, EMAIL, "a fresh temporary password")
    r = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_the_password_endpoint_is_rate_limited(auth_client):
    for _ in range(auth.RATE_LIMIT):
        auth_client.put("/api/me/password", json={"current": "wrong", "new": NEW_PASSWORD})
    r = auth_client.put("/api/me/password", json={"current": "wrong", "new": NEW_PASSWORD})
    assert r.status_code == 429


# --- The signup code ---------------------------------------------------------
#
# Registration is open on a dev machine and gated on a deployed one. The gate
# is a shared code rather than an invite system because the point is modest:
# someone who stumbles onto the URL should not be able to make an account,
# while someone who was told the code can do it on their phone, with nothing
# for the owner to administer.

def test_the_right_code_registers(client, gated):
    r = register(client, code=gated)
    assert r.status_code == 200
    assert r.json()["token"]


@pytest.mark.parametrize("code", ["", "nearly-right", "LET-ME-IN-PLEASE", "let-me-in-pleas"])
def test_a_wrong_code_is_refused(client, gated, code):
    r = register(client, code=code)
    assert r.status_code == 403
    assert "code" in r.json()["detail"]


def test_a_client_that_sends_no_code_at_all_is_refused_by_the_gate(client, gated):
    # Not a 422 about the request shape: an older frontend should be told
    # about the code, which is something the person can act on.
    r = register(client, code=None)
    assert r.status_code == 403
    assert "code" in r.json()["detail"]


def test_a_refused_signup_creates_nothing(client, gated, db):
    register(client, code="wrong")
    assert db.scalar(select(User).where(User.email == EMAIL)) is None


def test_a_wrong_code_does_not_reveal_who_already_has_an_account(client, gated, db):
    register(client, code=gated)  # EMAIL now exists

    taken = register(client, email=EMAIL, code="wrong")
    free = register(client, email="nobody@example.com", code="wrong")
    # Same answer either way: the duplicate-email 409 would otherwise let
    # someone without the code probe for who practises here.
    assert taken.status_code == free.status_code == 403
    assert taken.json() == free.json()


def test_deployed_without_a_code_closes_signups_rather_than_opening_them(client, monkeypatch):
    monkeypatch.setattr(auth, "SIGNUP_CODE", "")
    monkeypatch.setattr(auth, "OPEN_WITHOUT_CODE", False)
    r = register(client)
    assert r.status_code == 403
    assert r.json()["detail"] == "Signups are closed"


def test_dev_without_a_code_stays_open(client, monkeypatch):
    monkeypatch.setattr(auth, "SIGNUP_CODE", "")
    monkeypatch.setattr(auth, "OPEN_WITHOUT_CODE", True)
    assert register(client).status_code == 200


def test_the_gate_does_not_touch_logging_in(client, gated):
    register(client, code=gated)
    r = client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200


# --- create-user: the way in when signups are shut ---------------------------

def test_create_user_makes_a_working_account(client, db):
    from app.manage import create_user

    password = create_user(db, "teacher@example.com")
    assert len(password) >= 8  # generated, not blank

    r = client.post(LOGIN, json={"email": "teacher@example.com", "password": password})
    assert r.status_code == 200


def test_create_user_takes_a_chosen_password_and_normalises_the_email(client, db):
    from app.manage import create_user

    create_user(db, "  Teacher@Example.COM  ", "a chosen passphrase")
    r = client.post(LOGIN, json={"email": "teacher@example.com", "password": "a chosen passphrase"})
    assert r.status_code == 200


def test_create_user_bypasses_the_signup_gate_but_not_the_validation(db, gated):
    from app.manage import create_user

    # The gate is for strangers with the URL, not for the owner at a shell.
    create_user(db, "teacher@example.com", "a chosen passphrase")
    assert db.scalar(select(User).where(User.email == "teacher@example.com")) is not None

    for bad in ("short", "1234567"):
        with pytest.raises(ValueError, match="at least 8"):
            create_user(db, f"x{bad}@example.com", bad)
    # An empty password means "generate one", the same as omitting it.
    assert len(create_user(db, "generated@example.com", "")) >= 8
    with pytest.raises(ValueError, match="email address"):
        create_user(db, "nonsense", "a chosen passphrase")


def test_create_user_refuses_to_clobber_an_existing_account(client, db):
    from app.manage import create_user

    register(client)
    with pytest.raises(ValueError, match="already exists"):
        create_user(db, EMAIL, "a different passphrase")
