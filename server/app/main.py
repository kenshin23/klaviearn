from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import auth, routes
from .db import Base, engine

Base.metadata.create_all(engine)

# Lightweight migration for pre-existing dev databases. (A real migration
# tool like Alembic comes when the schema stops churning.)
with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE attempts ADD COLUMN played INTEGER"))
    except Exception:
        pass  # column already exists

app = FastAPI(title="Klaviearn API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(routes.router, prefix="/api")
