"""Admin CLI — runs inside the container or a venv on the server.

Usage:
  python -m app.manage list-users
  python -m app.manage create-user EMAIL [PASSWORD]
  python -m app.manage reset-password EMAIL [NEW_PASSWORD]

create-user is the way in when signups are closed, or when the signup code
is not something you want to hand out for one account. Both it and
reset-password generate a temporary password if none is given, which the
user should change right away via Settings → Change password in the app.
"""
import secrets
import sys

import bcrypt
from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .models import User


def create_user(db, email: str, password: str | None = None) -> str:
    """Make an account without going through the signup gate.

    The counterpart to closing registration: the owner still needs a way to
    let somebody in, and it should not mean handing out the shared code or
    reopening signups for everyone.

    Deliberately skips the gate, not the validation — a weak password is no
    more acceptable because an admin typed it.
    """
    email = email.strip().lower()
    if "@" not in email or len(email) < 5:
        raise ValueError(f"That doesn't look like an email address: {email}")
    if db.scalar(select(User).where(User.email == email)):
        raise ValueError(f"An account with email {email} already exists")
    password = password or secrets.token_urlsafe(9)
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    user = User(email=email, pw_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode())
    db.add(user)
    db.commit()
    return password


def reset_password(db, email: str, password: str | None = None) -> str:
    """Set a new password and revoke every token already issued.

    Returns the password that was set. Bumping token_version matters here:
    a reset is what you reach for when an account may be compromised, and
    without it the attacker's existing token would outlive the reset.
    """
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        raise LookupError(f"No account with email {email}")
    password = password or secrets.token_urlsafe(9)
    user.pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user.token_version += 1
    db.add(user)
    db.commit()
    return password


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    # The CLI can be the first thing to touch a database (a fresh server, or
    # a restore), and app.main is what normally creates the tables. Without
    # this, every command below dies in a wall of SQLAlchemy traceback.
    Base.metadata.create_all(engine)
    db = SessionLocal()

    if args[0] == "list-users":
        for u in db.scalars(select(User).order_by(User.id)):
            print(f"{u.id}\t{u.email}\t{u.created_at:%Y-%m-%d}")

    elif args[0] == "create-user" and len(args) >= 2:
        try:
            password = create_user(db, args[1], args[2] if len(args) > 2 else None)
        except ValueError as err:
            sys.exit(str(err))
        print(f"Created {args[1].strip().lower()} with password: {password}")
        print("Have them change it in the app: Settings → Change password.")

    elif args[0] == "reset-password" and len(args) >= 2:
        try:
            password = reset_password(db, args[1], args[2] if len(args) > 2 else None)
        except LookupError as err:
            sys.exit(str(err))
        print(f"Password for {args[1].strip().lower()} reset to: {password}")
        print("Every existing session has been signed out.")
        print("Have them change it in the app: Settings → Change password.")

    else:
        print(__doc__)


if __name__ == "__main__":
    main()
