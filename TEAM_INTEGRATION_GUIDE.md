# RecurOS — Team Integration Guide (Person 3 Deliverables)

This guide explains how **Person 1 (Frontend)**, **Person 2 (Subscriptions)**, and **Person 4 (Integration/Demo)** connect to and use the **Person 3 (Billing / Invoices)** engine.

---

## 1. Responsibilities of Person 3 (Billing / Invoices)
- ✅ Auto-generate invoices from due subscriptions.
- ✅ Idempotent **Billing Run with Proof**: never generate duplicate invoices, prove why any subscription was skipped.
- ✅ **Explainable Invoice Breakdown**: Base Price + Variants − Discounts + Taxes = Total.
- ✅ **Payment Recording & Lifecycle**: Draft → Confirmed → Partially Paid → Paid / Overdue.
- ✅ **Time Machine Support**: Advance simulated dates to demonstrate recurring billing.

---

## 2. Python Module Integration (For Person 2 & Person 4)

If importing directly in Python:
```python
from billing.billing_engine import (
    execute_billing_run,
    preview_billing_run,
    generate_single_invoice_for_sub,
    get_simulated_date,
    set_simulated_date
)
from billing.payment_service import (
    record_invoice_payment,
    get_invoice_details,
    get_invoices
)

# 1. Preview what will be billed today without database changes
preview = preview_billing_run(target_date="2026-10-31")
print(f"Will generate {preview['will_generate']} invoices, skipping {preview['will_skip']}")

# 2. Execute billing run with proof
result = execute_billing_run(target_date="2026-10-31")
print(f"Invoices generated: {result['invoices_generated']}")
for log in result['proof_logs']:
    print(f"[{log['action']}] {log['subscription_id']} - {log['reason']}")

# 3. Record a payment
success, payment, msg = record_invoice_payment(
    invoice_id="INV-202610-0001",
    amount=1000.0,
    payment_method="UPI / GPay",
    reference_no="UPI-992810"
)
```

---

## 3. REST API Contract (For Person 1 — Frontend)

All endpoints return JSON and support CORS:

### Billing Runs
- `GET /api/billing/preview`: Dry run preview of subscriptions due on the simulated date.
- `POST /api/billing/run`: Executes the billing run, returns the proof log with generated & skipped lists.
- `GET /api/billing/runs`: Historical billing runs.

### Invoices
- `GET /api/invoices`: List all invoices. Query parameter `?status=Confirmed|Paid|Partially Paid|Draft|Overdue`.
- `GET /api/invoices/<invoice_id>`: Get full invoice details, line items, and mathematical calculation breakdown.
- `POST /api/invoices/<invoice_id>/confirm`: Move draft invoice to Confirmed.
- `POST /api/invoices/<invoice_id>/cancel`: Cancel an unpaid invoice.

### Payments
- `POST /api/invoices/<invoice_id>/payments`:
  ```json
  {
    "amount": 1722.80,
    "payment_method": "UPI / GPay",
    "reference_no": "UPI-829102",
    "notes": "Payment received via HDFC UPI"
  }
  ```

### Time Machine & Demo
- `GET /api/time-machine`: Get current simulated date (`YYYY-MM-DD`).
- `POST /api/time-machine/advance`: Jump forward in time:
  ```json
  { "months": 1 }  // or { "days": 7 } or { "date": "2026-11-30" }
  ```
- `POST /api/time-machine/reset`: Reset simulated date to `2026-10-31`.
- `POST /api/seed`: Re-seed database with fresh demo data.

---

## 4. Database Schema Compatibility

The shared SQLite database is located at `./database.db`.
All foreign keys and indexes are maintained:
- `invoices.subscription_id` → `subscriptions.id`
- `invoices.customer_id` → `customers.id`
- `invoice_lines.invoice_id` → `invoices.id`
- `payments.invoice_id` → `invoices.id`
- `billing_runs.id` → stores audit logs as JSON in `proof_log_json`
