import csv
import io
import re
from decimal import Decimal
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import Invoice, Payment, InvoiceState, User
from app.api.deps import require_staff_or_admin
from app.services.pricing import quantize_money

router = APIRouter(prefix="/reconciliation", tags=["Bank Statement CSV Reconciliation"])

class ParseCsvRequest(BaseModel):
    csv_content: str

class ConfirmMatchRequest(BaseModel):
    invoice_id: int
    amount: Decimal
    paid_on: date
    method: str = "bank_transfer"
    reference: Optional[str] = None

@router.post("/parse-csv")
def parse_and_match_csv(
    payload: ParseCsvRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    """
    Parses bank CSV string and runs automated 3-tier matching rules against open invoices:
    Tier 1: Exact invoice number match in reference/description (HIGH confidence)
    Tier 2: Exact amount + customer name match (MEDIUM-HIGH confidence)
    Tier 3: Exact amount unique match (MEDIUM confidence)
    """
    reader = csv.DictReader(io.StringIO(payload.csv_content))

    # Fetch all unpaid/partially paid confirmed invoices
    open_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.state == InvoiceState.CONFIRMED.value,
            Invoice.amount_paid < Invoice.total
        )
        .all()
    )

    matches = []
    unmatched = []

    for row_idx, row in enumerate(reader):
        # Extract row fields flexibly across bank formats
        desc = row.get("description") or row.get("Description") or row.get("Narration") or row.get("memo") or ""
        ref = row.get("reference") or row.get("Reference") or row.get("Ref No") or row.get("txn_id") or ""
        amt_str = row.get("amount") or row.get("Amount") or row.get("Credit") or row.get("Deposit") or "0"
        date_str = row.get("date") or row.get("Date") or row.get("Txn Date") or str(date.today())

        try:
            # Clean commas, currency signs
            clean_amt = re.sub(r"[^\d.]", "", amt_str)
            amount = quantize_money(Decimal(clean_amt)) if clean_amt else Decimal("0.00")
        except Exception:
            continue

        if amount <= Decimal("0.00"):
            continue

        search_text = f"{desc} {ref}".lower()
        matched_invoice = None
        confidence = "LOW"
        match_rule = ""

        # Rule 1: Invoice number directly in reference/description
        for inv in open_invoices:
            inv_num = (inv.number or "").lower()
            if inv_num and inv_num in search_text:
                matched_invoice = inv
                confidence = "HIGH"
                match_rule = f"Exact invoice number match ('{inv.number}')"
                break

        # Rule 2: Exact amount + customer name match
        if not matched_invoice:
            for inv in open_invoices:
                unpaid = inv.total - inv.amount_paid
                if unpaid == amount:
                    cust_name = inv.customer.name.lower()
                    if cust_name in search_text or any(part in search_text for part in cust_name.split() if len(part) > 2):
                        matched_invoice = inv
                        confidence = "HIGH"
                        match_rule = f"Exact amount + customer name match ('{inv.customer.name}')"
                        break

        # Rule 3: Exact amount unique match
        if not matched_invoice:
            exact_amt_matches = [inv for inv in open_invoices if (inv.total - inv.amount_paid) == amount]
            if len(exact_amt_matches) == 1:
                matched_invoice = exact_amt_matches[0]
                confidence = "MEDIUM"
                match_rule = "Unique open invoice matching exact amount"

        item = {
            "row_index": row_idx + 1,
            "raw_date": date_str,
            "description": desc,
            "reference": ref,
            "amount": str(amount),
            "matched_invoice_id": matched_invoice.id if matched_invoice else None,
            "matched_invoice_number": matched_invoice.number if matched_invoice else None,
            "customer_name": matched_invoice.customer.name if matched_invoice else None,
            "confidence": confidence if matched_invoice else "NONE",
            "match_rule": match_rule if matched_invoice else "No match found"
        }

        if matched_invoice:
            matches.append(item)
        else:
            unmatched.append(item)

    return {
        "total_rows_parsed": len(matches) + len(unmatched),
        "matched_count": len(matches),
        "unmatched_count": len(unmatched),
        "suggested_matches": matches,
        "unmatched_rows": unmatched
    }

@router.post("/confirm-match")
def confirm_reconciliation_match(
    payload: ConfirmMatchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    inv = db.query(Invoice).filter(Invoice.id == payload.invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    payment_amount = quantize_money(payload.amount)
    outstanding = max(Decimal("0.00"), inv.total - inv.amount_paid)
    if payment_amount > outstanding:
        raise HTTPException(status_code=400, detail=f"Amount {payment_amount} exceeds outstanding {outstanding}.")

    payment = Payment(
        invoice_id=inv.id,
        method=payload.method,
        amount=payment_amount,
        paid_on=payload.paid_on,
        note=f"Reconciled via Bank CSV import (Ref: {payload.reference or 'N/A'})",
        recorded_by=user.email,
        source="reconciliation"
    )
    db.add(payment)

    inv.amount_paid = quantize_money(inv.amount_paid + payment_amount)
    if inv.amount_paid >= inv.total:
        inv.state = InvoiceState.PAID.value

    db.commit()
    db.refresh(payment)

    return {
        "message": f"Payment of ₹{payment_amount} recorded for {inv.number}. Status: {inv.state}",
        "invoice_id": inv.id,
        "invoice_number": inv.number,
        "invoice_state": inv.state,
        "amount_paid": str(inv.amount_paid),
        "amount_due": str(max(Decimal("0.00"), inv.total - inv.amount_paid))
    }
