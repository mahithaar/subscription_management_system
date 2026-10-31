from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base
from app.models.all_models import *
from app.seed import seed_database

# Routers
from app.api.auth import router as auth_router
from app.api.catalog import router as catalog_router
from app.api.subscriptions import router as subscriptions_router
from app.api.billing import router as billing_router
from app.api.invoices import router as invoices_router
from app.api.payments import router as payments_router
from app.api.clock import router as clock_router
from app.api.dashboard import router as dashboard_router
from app.api.reconciliation import router as reconciliation_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables created and seed data loaded on startup
    Base.metadata.create_all(bind=engine)
    try:
        seed_database()
    except Exception as e:
        print(f"Seed note: {e}")
    yield

app = FastAPI(
    title="RecurOS — Auditable Subscription Billing Platform",
    description="Deterministic, idempotent subscription engine with mathematical billing proof, explainable invoices, time machine virtual clock, and bank statement CSV reconciliation.",
    version="1.0.0",
    lifespan=lifespan
)

# Open CORS so frontend teammates can connect effortlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(catalog_router, prefix=settings.API_V1_STR)
app.include_router(subscriptions_router, prefix=settings.API_V1_STR)
app.include_router(billing_router, prefix=settings.API_V1_STR)
app.include_router(invoices_router, prefix=settings.API_V1_STR)
app.include_router(payments_router, prefix=settings.API_V1_STR)
app.include_router(clock_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(reconciliation_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "platform": "RecurOS",
        "tagline": "Billing you can audit: never twice, never skipped, always explained.",
        "docs": "/docs",
        "health": "OK"
    }

