from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import auth, routes
from .db import Base, engine

Base.metadata.create_all(engine)

app = FastAPI(title="Klaviearn API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(routes.router, prefix="/api")
