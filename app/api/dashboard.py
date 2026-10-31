from decimal import Decimal
import time
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.all_models import (
    Subscription, Invoice, Payment, Customer,
    SubscriptionState, InvoiceState, BillingPeriod, User
)
from app.api.deps import require_staff_or_admin
from app.services.clock import ClockService
from app.services.pricing import quantize_money

router = APIRouter(prefix="/dashboard", tags=["Finance Dashboard & Reports"])

@router.get("/metrics")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    start_time = time.time()
    today = ClockService.get_today(db)

    # 1. Subscription counts
    active_subs = (
        db.query(Subscription)
        .filter(Subscription.state == SubscriptionState.ACTIVE.value, Subscription.is_paused == False)
        .all()
    )
    total_active_subs = len(active_subs)
    total_customers = db.query(Customer).count()

    # 2. Revenue figures
    billed_revenue = db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00"))).filter(
        Invoice.state.in_([InvoiceState.CONFIRMED.value, InvoiceState.PAID.value])
    ).scalar() or Decimal("0.00")

    collected_revenue = db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00"))).scalar() or Decimal("0.00")

    # 3. Overdue metrics
    overdue_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.state == InvoiceState.CONFIRMED.value,
            Invoice.due_date < today,
            Invoice.amount_paid < Invoice.total
        )
        .all()
    )
    overdue_count = len(overdue_invoices)
    overdue_amount = sum(inv.total - inv.amount_paid for inv in overdue_invoices) if overdue_invoices else Decimal("0.00")

    outstanding_amount = max(Decimal("0.00"), billed_revenue - collected_revenue)

    # 4. Canonical MRR calculation (Blueprint formula)
    # daily * 30, weekly * (52/12), monthly * 1, yearly / 12
    mrr = Decimal("0.00")
    for sub in active_subs:
        plan = sub.plan
        if not plan:
            continue
        # Subtotal of active lines
        sub_line_total = sum(l.unit_price * l.quantity for l in sub.lines) if sub.lines else plan.price
        period = plan.billing_period.lower()

        if period == BillingPeriod.DAILY.value:
            sub_mrr = sub_line_total * Decimal("30")
        elif period == BillingPeriod.WEEKLY.value:
            sub_mrr = sub_line_total * (Decimal("52") / Decimal("12"))
        elif period == BillingPeriod.YEARLY.value:
            sub_mrr = sub_line_total / Decimal("12")
        else: # monthly
            sub_mrr = sub_line_total

        mrr += sub_mrr

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "kpis": {
            "active_subscriptions": total_active_subs,
            "total_customers": total_customers,
            "mrr": str(quantize_money(mrr)),
            "billed_revenue": str(quantize_money(billed_revenue)),
            "collected_revenue": str(quantize_money(collected_revenue)),
            "outstanding_revenue": str(quantize_money(outstanding_amount)),
            "overdue_count": overdue_count,
            "overdue_amount": str(quantize_money(overdue_amount))
        },
        "performance": {
            "query_time_ms": elapsed_ms,
            "benchmark_status": "< 2.0s TARGET MET" if elapsed_ms < 2000 else "EXCEEDED",
            "as_of_date": today.isoformat()
        }
    }

@router.get("/overdue-list")
def get_overdue_list(
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    today = ClockService.get_today(db)
    overdue_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.state == InvoiceState.CONFIRMED.value,
            Invoice.due_date < today,
            Invoice.amount_paid < Invoice.total
        )
        .order_by(Invoice.due_date.asc())
        .limit(50)
        .all()
    )

    results = []
    for inv in overdue_invoices:
        days_overdue = (today - inv.due_date).days
        unpaid = inv.total - inv.amount_paid
        results.append({
            "invoice_id": inv.id,
            "invoice_number": inv.number or f"INV-{inv.id}",
            "customer_id": inv.customer_id,
            "customer_name": inv.customer.name if inv.customer else "",
            "customer_email": inv.customer.email if inv.customer else "",
            "due_date": inv.due_date.isoformat(),
            "days_overdue": days_overdue,
            "total": str(inv.total),
            "amount_paid": str(inv.amount_paid),
            "amount_due": str(unpaid)
        })
    return results

