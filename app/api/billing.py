from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import BillingRun, User
from app.api.deps import require_staff_or_admin
from app.services.clock import ClockService
from app.services.billing import BillingEngine

router = APIRouter(prefix="/billing", tags=["Billing Run & Idempotency Engine"])

class BillingRunRequest(BaseModel):
    as_of_date: Optional[date] = None
    mode: str = "execute"  # "preview" or "execute"

@router.post("/preview")
@router.get("/preview")
def preview_billing_run(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    target_date = as_of_date if as_of_date else ClockService.get_today(db)
    return BillingEngine.run_billing(
        db=db,
        as_of_date=target_date,
        mode="preview"
    )

@router.post("/run")
def execute_billing_run(
    payload: BillingRunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    target_date = payload.as_of_date if payload.as_of_date else ClockService.get_today(db)
    result = BillingEngine.run_billing(
        db=db,
        as_of_date=target_date,
        mode=payload.mode
    )
    return result

@router.get("/runs")
def list_billing_runs(
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    runs = db.query(BillingRun).order_by(BillingRun.id.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "run_date": r.run_date.isoformat(),
            "as_of_date": r.as_of_date.isoformat(),
            "mode": r.mode,
            "due_count": r.due_count,
            "invoiced_count": r.invoiced_count,
            "skipped_count": r.skipped_count,
            "duplicate_blocked_count": r.duplicate_blocked_count,
            "error_count": r.error_count
        } for r in runs
    ]

@router.get("/runs/{run_id}")
def get_billing_run_detail(
    run_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    run = db.query(BillingRun).filter(BillingRun.id == run_id).first()
    if not run:
        return {"error": "Run not found"}
    return {
        "id": run.id,
        "run_date": run.run_date.isoformat(),
        "as_of_date": run.as_of_date.isoformat(),
        "mode": run.mode,
        "due_count": run.due_count,
        "invoiced_count": run.invoiced_count,
        "skipped_count": run.skipped_count,
        "duplicate_blocked_count": run.duplicate_blocked_count,
        "error_count": run.error_count,
        "summary": run.summary_json
    }

