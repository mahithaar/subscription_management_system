from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.clock import ClockService
from app.api.deps import require_admin, User

router = APIRouter(prefix="/clock", tags=["Time Machine (Simulated Clock)"])

class SetDateRequest(BaseModel):
    target_date: date

class AdvanceDateRequest(BaseModel):
    days: int

@router.get("")
def get_clock_status(db: Session = Depends(get_db)):
    today = ClockService.get_today(db)
    is_virtual = ClockService.is_virtual(db)
    return {
        "today": today.isoformat(),
        "is_simulated": is_virtual,
        "mode": "SIMULATED DATE" if is_virtual else "REAL-TIME",
        "description": "RecurOS Time Machine allows judges to test recurring billing cycles and discount expiration without waiting."
    }

@router.post("/set")
def set_clock_date(
    payload: SetDateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    new_date = ClockService.set_virtual_date(db, payload.target_date)
    return {
        "message": f"Time Machine date set to {new_date.isoformat()}",
        "today": new_date.isoformat(),
        "is_simulated": True
    }

@router.post("/advance")
def advance_clock_date(
    payload: AdvanceDateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    new_date = ClockService.advance_days(db, payload.days)
    return {
        "message": f"Time Machine advanced {payload.days} days to {new_date.isoformat()}",
        "today": new_date.isoformat(),
        "is_simulated": True
    }

@router.post("/reset")
def reset_clock_date(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    real_today = ClockService.reset_to_real_time(db)
    return {
        "message": "Time Machine reset to real time.",
        "today": real_today.isoformat(),
        "is_simulated": False
    }

