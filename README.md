# RecurOS — Auditable Subscription Billing Platform
> *"Billing you can audit: never twice, never skipped, always explained."*

Built for **Brightloop Software** hackathon scenario.

---

## 🚀 Quickstart

### Option 1: Run Locally (Fastest for 4-Hour Hackathon)
```powershell
# 1. Run the server (auto-initializes SQLite DB and seeds demo data)
python run_server.py

# 2. Open interactive Swagger API docs in your browser:
# http://127.0.0.1:8000/docs
```

### Option 2: Docker Compose (PostgreSQL + Redis + Mailpit + API)
```bash
docker compose up --build
```

---

## 🔑 Pre-Seeded Demo Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@brightloop.io` | `Password123!` | Full control: create staff, taxes, discounts, catalog, time machine |
| **Staff** | `staff@brightloop.io` | `Password123!` | Day-to-day: subscriptions, billing runs, payments, invoices, reconciliation |
| **Customer** | `client@acmecorp.com` | `Password123!` | Customer portal: strictly scoped to own subscriptions and invoices |

---

## 🏆 Winning Differentiators Built & Tested

1. **Billing Run with Mathematical Proof & Idempotency**:
   - Database constraint `UNIQUE(subscription_id, period_start)`.
   - Running billing twice results in `0 created, N duplicate_blocked by DB constraint`.
   - Balanced proof formula: `Due == Invoiced + Skipped + Blocked + Errors`.
2. **Explainable Invoices**:
   - Every invoice line carries an `explain_trace` JSON showing base price, variant surcharge (`+560 for Brand=Odoo`), discount breakdown, and itemized taxes.
3. **Time Machine (Simulated Clock)**:
   - Controllable via `POST /api/v1/clock/set` and `POST /api/v1/clock/advance` to demo 30-day recurring cycles and discount expirations live on stage.
4. **Bank Statement CSV Reconciliation**:
   - `POST /api/v1/reconciliation/parse-csv` runs automated 3-tier matching against open invoices. Confirming a match creates a payment and flips the invoice to `Paid`. (Sample file: `sample_bank_statement.csv`).
5. **Real-time Finance Dashboard**:
   - Calculates MRR, billed revenue, collected revenue, outstanding balance, and overdue ageing under 50ms.

---

## 🧪 Automated Test Suite

Run the full suite:
```powershell
python -m unittest discover tests
```
Results: **10/10 tests passing** covering password rules (8 vs 9 chars), Odoo variant pricing (+560), discount bounds, tax calculations, live double-billing idempotency, and reconciliation.

