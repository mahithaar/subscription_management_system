from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import Invoice, InvoiceLine, Payment, InvoiceState, User, UserRole
from app.api.deps import get_current_user, require_staff_or_admin
from app.services.clock import ClockService
from app.services.pricing import quantize_money

router = APIRouter(prefix="/invoices", tags=["Invoices & Explain Trace"])

class PayInvoiceRequest(BaseModel):
    method: str = "Credit Card (•••• 4242)"
    gateway: str = "Razorpay"
    amount: Optional[Decimal] = None
    note: Optional[str] = "Direct Invoice Payment"


@router.get("")
def list_invoices(
    state: Optional[str] = None,
    customer_id: Optional[int] = None,
    overdue_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Invoice)

    # Server-side customer data scoping
    if current_user.role == UserRole.CUSTOMER.value:
        if not current_user.customer:
            return []
        query = query.filter(Invoice.customer_id == current_user.customer.id)
    elif customer_id:
        query = query.filter(Invoice.customer_id == customer_id)

    if state:
        query = query.filter(Invoice.state == state)

    today = ClockService.get_today(db)
    if overdue_only:
        query = query.filter(
            Invoice.state == InvoiceState.CONFIRMED.value,
            Invoice.due_date < today,
            Invoice.amount_paid < Invoice.total
        )

    invoices = query.order_by(Invoice.id.desc()).all()
    results = []
    for inv in invoices:
        is_overdue = (inv.state == InvoiceState.CONFIRMED.value and inv.due_date < today and inv.amount_paid < inv.total)
        outstanding = max(Decimal("0.00"), inv.total - inv.amount_paid)
        results.append({
            "id": inv.id,
            "number": inv.number or f"DRAFT-{inv.id}",
            "subscription_id": inv.subscription_id,
            "subscription_number": inv.subscription.number if inv.subscription else "",
            "customer_id": inv.customer_id,
            "customer_name": inv.customer.name if inv.customer else "",
            "period_start": inv.period_start.isoformat(),
            "period_end": inv.period_end.isoformat(),
            "invoice_date": inv.invoice_date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "state": inv.state,
            "is_overdue": is_overdue,
            "subtotal": str(inv.subtotal),
            "discount_total": str(inv.discount_total),
            "tax_total": str(inv.tax_total),
            "total": str(inv.total),
            "amount_paid": str(inv.amount_paid),
            "amount_due": str(outstanding)
        })
    return results

@router.get("/{invoice_id}")
def get_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if current_user.role == UserRole.CUSTOMER.value:
        if not current_user.customer or inv.customer_id != current_user.customer.id:
            raise HTTPException(status_code=403, detail="Access denied.")

    today = ClockService.get_today(db)
    is_overdue = (inv.state == InvoiceState.CONFIRMED.value and inv.due_date < today and inv.amount_paid < inv.total)
    outstanding = max(Decimal("0.00"), inv.total - inv.amount_paid)

    lines = []
    for l in inv.lines:
        lines.append({
            "id": l.id,
            "description": l.description,
            "quantity": l.quantity,
            "unit_price": str(l.unit_price),
            "discount_amount": str(l.discount_amount),
            "tax_snapshot": l.tax_snapshot,
            "line_total": str(l.line_total),
            "explain_trace": l.explain_trace  # The audit explanation differentiator
        })

    payments = [
        {
            "id": p.id,
            "method": p.method,
            "amount": str(p.amount),
            "paid_on": p.paid_on.isoformat(),
            "note": p.note
        } for p in inv.payments
    ]

    return {
        "id": inv.id,
        "number": inv.number or f"DRAFT-{inv.id}",
        "subscription_id": inv.subscription_id,
        "subscription_number": inv.subscription.number if inv.subscription else "",
        "customer": {
            "id": inv.customer.id,
            "name": inv.customer.name,
            "email": inv.customer.email,
            "billing_address": inv.customer.billing_address,
            "tax_id": inv.customer.tax_id
        },
        "period_start": inv.period_start.isoformat(),
        "period_end": inv.period_end.isoformat(),
        "invoice_date": inv.invoice_date.isoformat(),
        "due_date": inv.due_date.isoformat(),
        "state": inv.state,
        "is_overdue": is_overdue,
        "subtotal": str(inv.subtotal),
        "discount_total": str(inv.discount_total),
        "tax_total": str(inv.tax_total),
        "total": str(inv.total),
        "amount_paid": str(inv.amount_paid),
        "amount_due": str(outstanding),
        "lines": lines,
        "payments": payments
    }

@router.post("/{invoice_id}/pay")
def pay_invoice(
    invoice_id: int,
    payload: Optional[PayInvoiceRequest] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if inv.state == InvoiceState.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Cannot record payment against a cancelled invoice.")

    outstanding = max(Decimal("0.00"), inv.total - inv.amount_paid)
    if outstanding <= Decimal("0.00") and inv.state == InvoiceState.PAID.value:
        return {
            "success": True,
            "message": f"Invoice {inv.number or inv.id} is already fully paid.",
            "invoice_id": inv.id,
            "state": inv.state
        }

    pay_amount = payload.amount if (payload and payload.amount is not None) else outstanding
    pay_amount = quantize_money(pay_amount)

    if pay_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    if pay_amount > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({pay_amount}) exceeds outstanding balance ({outstanding}). Overpayments are restricted."
        )

    method = payload.method if payload else "card"
    gateway = payload.gateway if payload else "Razorpay"
    note = payload.note if payload else "Interactive Payment"

    payment = Payment(
        invoice_id=inv.id,
        method=method,
        amount=pay_amount,
        paid_on=ClockService.get_today(db),
        note=f"{note} via {gateway}",
        recorded_by=user.email,
        source="manual"
    )
    db.add(payment)

    inv.amount_paid = quantize_money(inv.amount_paid + pay_amount)
    if inv.amount_paid >= inv.total:
        inv.state = InvoiceState.PAID.value
    elif inv.amount_paid > Decimal("0.00"):
        inv.state = "partial"

    db.commit()
    db.refresh(payment)
    db.refresh(inv)

    return {
        "success": True,
        "payment_id": payment.id,
        "invoice_id": inv.id,
        "amount": str(payment.amount),
        "invoice_state": inv.state,
        "amount_paid": str(inv.amount_paid),
        "amount_due": str(max(Decimal("0.00"), inv.total - inv.amount_paid)),
        "message": f"Payment of ₹{payment.amount} recorded successfully for Invoice {inv.number or inv.id}."
    }

@router.post("/{invoice_id}/confirm")
def confirm_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.state != InvoiceState.DRAFT.value:
        raise HTTPException(status_code=400, detail="Only Draft invoices can be confirmed.")

    inv.state = InvoiceState.CONFIRMED.value
    if not inv.number:
        inv.number = f"INV-{inv.invoice_date.year}-{inv.id:04d}"
    db.commit()
    return {"id": inv.id, "number": inv.number, "state": inv.state}

@router.post("/{invoice_id}/cancel")
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.amount_paid > Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Cannot cancel an invoice with recorded payments.")

    inv.state = InvoiceState.CANCELLED.value
    db.commit()
    return {"id": inv.id, "state": inv.state, "message": "Invoice cancelled."}

@router.post("/{invoice_id}/send")
def send_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    # Simulated email delivery
    return {
        "message": f"Invoice {inv.number or inv.id} sent to {inv.customer.email}",
        "recipient": inv.customer.email,
        "status": "delivered_to_mailpit"
    }

@router.get("/{invoice_id}/html", response_class=HTMLResponse)
def get_invoice_html(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Print-friendly HTML invoice fallback for clean PDF saving directly in browser."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    lines_html = "".join([
        f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">{l.description}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">{l.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹{l.unit_price}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">-₹{l.discount_amount}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹{l.line_total}</td>
        </tr>
        """ for l in inv.lines
    ])

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Invoice {inv.number or inv.id}</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; }}
            .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }}
            .brand {{ font-size: 24px; font-weight: bold; color: #0284c7; }}
            .meta {{ text-align: right; }}
            .customer-box {{ margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 8px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 30px; }}
            th {{ background: #f1f5f9; padding: 12px; text-align: left; font-size: 13px; text-transform: uppercase; }}
            .totals {{ margin-top: 30px; float: right; width: 300px; }}
            .totals tr td {{ padding: 6px 0; }}
            .grand-total {{ font-size: 18px; font-weight: bold; border-top: 2px solid #0f172a; padding-top: 8px; }}
            .explain-banner {{ margin-top: 60px; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="brand">RecurOS — Brightloop Software</div>
                <div style="color: #64748b; font-size: 13px;">Billing You Can Audit</div>
            </div>
            <div class="meta">
                <h2>INVOICE</h2>
                <div style="font-weight: 600;">{inv.number or f'DRAFT-{inv.id}'}</div>
                <div>Date: {inv.invoice_date}</div>
                <div>Due: {inv.due_date}</div>
                <div style="margin-top: 6px; font-weight: bold; color: {'#16a34a' if inv.state == 'Paid' else '#ea580c'};">
                    STATUS: {inv.state.upper()}
                </div>
            </div>
        </div>

        <div class="customer-box">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Billed To:</div>
            <div style="font-size: 16px; font-weight: 600; margin-top: 4px;">{inv.customer.name}</div>
            <div>{inv.customer.email}</div>
            <div>{inv.customer.billing_address or ''}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Item Description</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Discount</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                {lines_html}
            </tbody>
        </table>

        <div class="totals">
            <table style="width: 100%;">
                <tr><td>Subtotal:</td><td style="text-align: right;">₹{inv.subtotal}</td></tr>
                <tr><td>Discounts:</td><td style="text-align: right; color: #16a34a;">-₹{inv.discount_total}</td></tr>
                <tr><td>Taxes:</td><td style="text-align: right;">+₹{inv.tax_total}</td></tr>
                <tr class="grand-total"><td>Total:</td><td style="text-align: right;">₹{inv.total}</td></tr>
                <tr><td>Amount Paid:</td><td style="text-align: right;">₹{inv.amount_paid}</td></tr>
                <tr style="font-weight: 600; color: #b91c1c;"><td>Amount Due:</td><td style="text-align: right;">₹{max(Decimal('0.00'), inv.total - inv.amount_paid)}</td></tr>
            </table>
        </div>

        <div style="clear: both;"></div>

        <div class="explain-banner">
            <strong>Auditable Invoice Trace:</strong> This invoice was generated by the RecurOS Deterministic Billing Engine. All line items, variant surcharges, discount rules, and tax snapshots are permanently preserved in the invoice snapshot.
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

