"""Admin CLI — runs inside the container or a venv on the server.

Usage:
  python -m app.manage list-users
  python -m app.manage reset-password EMAIL [NEW_PASSWORD]

reset-password generates a temporary password if none is given, and signs
the account out everywhere. The user should change it right away via
Settings → Change password in the app.
"""
import secrets
import sys

import bcrypt
from sqlalchemy import select

from .db import SessionLocal
from .models import User


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
    db = SessionLocal()

    if args[0] == "list-users":
        for u in db.scalars(select(User).order_by(User.id)):
            print(f"{u.id}\t{u.email}\t{u.created_at:%Y-%m-%d}")

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
