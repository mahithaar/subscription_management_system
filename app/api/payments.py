from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import Invoice, Payment, InvoiceState, User
from app.api.deps import require_staff_or_admin
from app.services.pricing import quantize_money

router = APIRouter(prefix="/payments", tags=["Payments & Settlements"])

class PaymentCreate(BaseModel):
    invoice_id: int
    method: str = "bank_transfer"
    amount: Decimal
    paid_on: Optional[date] = None
    note: Optional[str] = None

@router.get("")
def list_payments(
    invoice_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    query = db.query(Payment)
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)

    payments = query.order_by(Payment.id.desc()).all()
    return [
        {
            "id": p.id,
            "invoice_id": p.invoice_id,
            "invoice_number": p.invoice.number if p.invoice else "",
            "customer_name": p.invoice.customer.name if p.invoice and p.invoice.customer else "",
            "method": p.method,
            "amount": str(p.amount),
            "paid_on": p.paid_on.isoformat(),
            "note": p.note,
            "recorded_by": p.recorded_by,
            "source": p.source
        } for p in payments
    ]

@router.post("", status_code=status.HTTP_201_CREATED)
def record_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    payment_amount = quantize_money(payload.amount)
    if payment_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    invoice = db.query(Invoice).filter(Invoice.id == payload.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if invoice.state in [InvoiceState.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Cannot record payment against a cancelled invoice.")

    outstanding = max(Decimal("0.00"), invoice.total - invoice.amount_paid)
    if payment_amount > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({payment_amount}) exceeds outstanding due ({outstanding}). Overpayments are restricted."
        )

    paid_date = payload.paid_on if payload.paid_on else date.today()

    payment = Payment(
        invoice_id=invoice.id,
        method=payload.method,
        amount=payment_amount,
        paid_on=paid_date,
        note=payload.note,
        recorded_by=current_user.email,
        source="manual"
    )
    db.add(payment)

    # Increment invoice amount_paid
    invoice.amount_paid = quantize_money(invoice.amount_paid + payment_amount)
    if invoice.amount_paid >= invoice.total:
        invoice.state = InvoiceState.PAID.value

    db.commit()
    db.refresh(payment)

    return {
        "payment_id": payment.id,
        "invoice_id": invoice.id,
        "amount": str(payment.amount),
        "invoice_state": invoice.state,
        "amount_paid": str(invoice.amount_paid),
        "amount_due": str(max(Decimal("0.00"), invoice.total - invoice.amount_paid)),
        "message": "Payment recorded successfully."
    }

