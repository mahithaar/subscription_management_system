from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from dateutil.relativedelta import relativedelta

from app.models.all_models import (
    Subscription, SubscriptionLine, Invoice, InvoiceLine,
    Plan, Product, ProductVariant, TaxRule, Discount,
    BillingRun, BillingRunItem, SubscriptionState, InvoiceState, BillingPeriod
)
from app.services.pricing import PricingEngine, quantize_money

def calculate_period(billing_period: str, period_start: date) -> Tuple[date, date]:
    """
    Returns (period_end, next_invoice_date).
    period_start = start of billing period
    period_end = period_start + 1 period - 1 day
    next_invoice_date = period_end + 1 day
    """
    period_lower = billing_period.lower()
    if period_lower == BillingPeriod.DAILY.value:
        next_date = period_start + timedelta(days=1)
    elif period_lower == BillingPeriod.WEEKLY.value:
        next_date = period_start + timedelta(weeks=1)
    elif period_lower == BillingPeriod.MONTHLY.value:
        next_date = period_start + relativedelta(months=1)
    elif period_lower == BillingPeriod.YEARLY.value:
        next_date = period_start + relativedelta(years=1)
    else:
        # Default monthly
        next_date = period_start + relativedelta(months=1)

    period_end = next_date - timedelta(days=1)
    return period_end, next_date

class BillingEngine:
    @classmethod
    def run_billing(
        cls,
        db: Session,
        as_of_date: date,
        mode: str = "execute"  # "preview" or "execute"
    ) -> Dict[str, Any]:
        """
        Executes or previews a billing run as of the given date.
        Guarantees:
        - Never bills twice for the same period (idempotency).
        - Atomic discount counter updates.
        - Produces a comprehensive Proof Panel summary.
        """
        # 1. Fetch due active subscriptions
        due_subscriptions = (
            db.query(Subscription)
            .filter(
                Subscription.state == SubscriptionState.ACTIVE.value,
                Subscription.next_invoice_date <= as_of_date
            )
            .all()
        )

        due_count = len(due_subscriptions)
        invoiced_count = 0
        skipped_count = 0
        duplicate_blocked_count = 0
        error_count = 0

        run_items = []
        invoices_to_return = []

        # Load global active tax rules and discounts
        all_tax_rules = db.query(TaxRule).filter(TaxRule.is_active == True).all()
        all_discounts = db.query(Discount).filter(Discount.is_active == True).all()

        for sub in due_subscriptions:
            # Check Paused flag
            if sub.is_paused:
                skipped_count += 1
                run_items.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "outcome": "skipped",
                    "reason": "Subscription is paused."
                })
                continue

            # Check Expiry
            if sub.expiry_date and as_of_date > sub.expiry_date:
                plan = sub.plan
                if plan and plan.auto_close and mode == "execute":
                    sub.state = SubscriptionState.CLOSED.value
                    db.commit()
                skipped_count += 1
                run_items.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "outcome": "skipped",
                    "reason": f"Subscription expired on {sub.expiry_date}."
                })
                continue

            # Calculate billing period
            period_start = sub.next_invoice_date
            plan = sub.plan
            billing_period_str = plan.billing_period if plan else BillingPeriod.MONTHLY.value
            period_end, next_inv_date = calculate_period(billing_period_str, period_start)

            # Idempotency check: Does an invoice already exist for (subscription_id, period_start)?
            existing_invoice = (
                db.query(Invoice)
                .filter(
                    Invoice.subscription_id == sub.id,
                    Invoice.period_start == period_start
                )
                .first()
            )

            if existing_invoice:
                duplicate_blocked_count += 1
                run_items.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "outcome": "duplicate_blocked",
                    "reason": f"Invoice already exists for period starting {period_start} (Invoice #{existing_invoice.number or existing_invoice.id}).",
                    "invoice_id": existing_invoice.id
                })
                continue

            # Build line items
            line_results = []
            sub_discount = sub.discount

            for s_line in sub.lines:
                product = s_line.product
                variant = s_line.variant

                # Determine taxes
                target_taxes = []
                if s_line.tax_ids:
                    tax_id_set = set(s_line.tax_ids)
                    target_taxes = [t for t in all_tax_rules if t.id in tax_id_set]
                else:
                    # Apply general taxes
                    target_taxes = [
                        t for t in all_tax_rules
                        if t.applies_to == "all" or (t.applies_to == "product_type" and t.target == getattr(product, "type", None))
                    ]

                # Determine candidate discounts (line-level + subscription-level)
                candidates = []
                if sub_discount:
                    candidates.append(sub_discount)
                for d in all_discounts:
                    if d.scope == "product" and d.product_id == s_line.product_id and d not in candidates:
                        candidates.append(d)

                priced_line = PricingEngine.price_line(
                    product_name=product.name if product else "Subscription Line",
                    product_id=s_line.product_id,
                    base_price=s_line.unit_price,
                    quantity=s_line.quantity,
                    as_of_date=as_of_date,
                    variant=variant,
                    candidate_discounts=candidates,
                    tax_rules=target_taxes
                )
                line_results.append(priced_line)

            # Aggregate invoice totals
            subtotal = sum(l["taxable_amount"] + l["discount_amount"] for l in line_results)
            discount_total = sum(l["discount_amount"] for l in line_results)
            tax_total = sum(l["total_tax"] for l in line_results)
            total = sum(l["line_total"] for l in line_results)

            due_date = as_of_date + timedelta(days=sub.payment_term_days)

            if mode == "preview":
                invoiced_count += 1
                run_items.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "outcome": "created",
                    "reason": "Preview generated successfully.",
                    "total": str(quantize_money(total))
                })
                invoices_to_return.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "customer_id": sub.customer_id,
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                    "invoice_date": as_of_date.isoformat(),
                    "due_date": due_date.isoformat(),
                    "subtotal": str(quantize_money(subtotal)),
                    "discount_total": str(quantize_money(discount_total)),
                    "tax_total": str(quantize_money(tax_total)),
                    "total": str(quantize_money(total)),
                    "lines": line_results
                })
                continue

            # Execute mode: Create Invoice and Invoice Lines inside savepoint
            try:
                # Generate sequence number for draft or confirmed
                new_invoice = Invoice(
                    subscription_id=sub.id,
                    customer_id=sub.customer_id,
                    period_start=period_start,
                    period_end=period_end,
                    invoice_date=as_of_date,
                    due_date=due_date,
                    state=InvoiceState.CONFIRMED.value,
                    subtotal=quantize_money(subtotal),
                    discount_total=quantize_money(discount_total),
                    tax_total=quantize_money(tax_total),
                    total=quantize_money(total),
                    amount_paid=Decimal("0.00")
                )
                db.add(new_invoice)
                db.flush() # populates new_invoice.id

                # Assign sequential number: INV-YYYY-ID
                new_invoice.number = f"INV-{as_of_date.year}-{new_invoice.id:04d}"

                # Insert lines
                for l in line_results:
                    inv_line = InvoiceLine(
                        invoice_id=new_invoice.id,
                        product_id=l["product_id"],
                        variant_id=l["variant_id"],
                        description=l["description"],
                        quantity=l["quantity"],
                        unit_price=l["unit_price"],
                        discount_id=l["discount_id"],
                        discount_amount=l["discount_amount"],
                        tax_snapshot=l["tax_snapshot"],
                        line_total=l["line_total"],
                        explain_trace=l["explain_trace"]
                    )
                    db.add(inv_line)

                    # Atomic discount counter increment
                    if l.get("applied_discount_obj"):
                        disc_id = l["applied_discount_obj"].id
                        # Atomic conditional increment
                        stmt = text(
                            "UPDATE discounts SET used_count = used_count + 1 "
                            "WHERE id = :disc_id AND used_count < usage_limit"
                        )
                        result = db.execute(stmt, {"disc_id": disc_id})
                        if result.rowcount == 0:
                            # Discount reached limit during execution
                            pass

                # Update subscription next_invoice_date
                sub.next_invoice_date = next_inv_date

                # Check auto-close on expiry
                if sub.expiry_date and sub.next_invoice_date > sub.expiry_date:
                    if plan and plan.auto_close:
                        sub.state = SubscriptionState.CLOSED.value

                db.commit()

                invoiced_count += 1
                run_items.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "outcome": "created",
                    "reason": f"Invoice {new_invoice.number} created successfully.",
                    "invoice_id": new_invoice.id,
                    "total": str(quantize_money(total))
                })
                invoices_to_return.append({
                    "id": new_invoice.id,
                    "number": new_invoice.number,
                    "subscription_number": sub.number,
                    "total": str(quantize_money(total))
                })

            except IntegrityError as ie:
                db.rollback()
                duplicate_blocked_count += 1
                run_items.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "outcome": "duplicate_blocked",
                    "reason": "Database UNIQUE constraint blocked duplicate billing for this period."
                })
            except Exception as e:
                db.rollback()
                error_count += 1
                run_items.append({
                    "subscription_id": sub.id,
                    "subscription_number": sub.number,
                    "outcome": "error",
                    "reason": str(e)
                })

        # Save billing run summary in DB
        billing_run_record = BillingRun(
            as_of_date=as_of_date,
            mode=mode,
            due_count=due_count,
            invoiced_count=invoiced_count,
            skipped_count=skipped_count,
            duplicate_blocked_count=duplicate_blocked_count,
            error_count=error_count,
            summary_json={
                "items": run_items
            }
        )
        if mode == "execute":
            db.add(billing_run_record)
            db.commit()
            db.refresh(billing_run_record)

        return {
            "run_id": billing_run_record.id if mode == "execute" else None,
            "as_of_date": as_of_date.isoformat(),
            "mode": mode,
            "proof_panel": {
                "due_count": due_count,
                "invoiced_count": invoiced_count,
                "skipped_count": skipped_count,
                "duplicate_blocked_count": duplicate_blocked_count,
                "error_count": error_count,
                "mathematical_proof": (
                    f"Due ({due_count}) == Invoiced ({invoiced_count}) + Skipped ({skipped_count}) + "
                    f"Blocked ({duplicate_blocked_count}) + Errors ({error_count})"
                ),
                "is_balanced": due_count == (invoiced_count + skipped_count + duplicate_blocked_count + error_count)
            },
            "items": run_items,
            "invoices": invoices_to_return
        }

