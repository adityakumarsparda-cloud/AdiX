"""FastAPI application entrypoint.

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import candidate, dashboard, jobs
from app.config import settings
from app.database.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="AI Job Search & Recruitment Outreach Agent",
    version=__version__,
    description="Local-first job discovery, matching, outreach and tracking. "
    "Every external action requires explicit human approval.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings().frontend_origin, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(candidate.router)
app.include_router(jobs.router)


@app.get("/")
def root() -> dict:
    return {
        "name": "AI Job Search & Recruitment Outreach Agent",
        "version": __version__,
        "docs": "/docs",
        "note": "Nothing is sent or submitted without explicit human approval.",
    }
