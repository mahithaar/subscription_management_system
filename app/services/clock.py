from datetime import date, datetime
from sqlalchemy.orm import Session
from app.models.all_models import AppClock

class ClockService:
    @staticmethod
    def get_clock_record(db: Session) -> AppClock:
        clock = db.query(AppClock).filter(AppClock.id == 1).first()
        if not clock:
            clock = AppClock(id=1, virtual_today=None)
            db.add(clock)
            db.commit()
            db.refresh(clock)
        return clock

    @classmethod
    def get_today(cls, db: Session) -> date:
        clock = cls.get_clock_record(db)
        if clock.virtual_today:
            return clock.virtual_today
        return date.today()

    @classmethod
    def is_virtual(cls, db: Session) -> bool:
        clock = cls.get_clock_record(db)
        return clock.virtual_today is not None

    @classmethod
    def set_virtual_date(cls, db: Session, target_date: date) -> date:
        clock = cls.get_clock_record(db)
        clock.virtual_today = target_date
        db.commit()
        db.refresh(clock)
        return clock.virtual_today

    @classmethod
    def advance_days(cls, db: Session, days: int) -> date:
        current_date = cls.get_today(db)
        from datetime import timedelta
        new_date = current_date + timedelta(days=days)
        return cls.set_virtual_date(db, new_date)

    @classmethod
    def reset_to_real_time(cls, db: Session) -> date:
        clock = cls.get_clock_record(db)
        clock.virtual_today = None
        db.commit()
        return date.today()

