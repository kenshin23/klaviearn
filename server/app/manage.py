"""Admin CLI — runs inside the container or a venv on the server.

Usage:
  python -m app.manage list-users
  python -m app.manage reset-password EMAIL [NEW_PASSWORD]

reset-password generates a temporary password if none is given. The user
should change it right away via Settings → Change password in the app.
"""
import secrets
import sys

import bcrypt
from sqlalchemy import select

from .db import SessionLocal
from .models import User


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
        email = args[1].strip().lower()
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            sys.exit(f"No account with email {email}")
        password = args[2] if len(args) > 2 else secrets.token_urlsafe(9)
        user.pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        db.add(user)
        db.commit()
        print(f"Password for {email} reset to: {password}")
        print("Have them change it in the app: Settings → Change password.")

    else:
        print(__doc__)


main()
