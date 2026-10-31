# RecurOS — Auditable Subscription Billing Platform
> *"Billing you can audit: never twice, never skipped, always explained."*

Built for **Brightloop Software** hackathon scenario.

---

## 👥 Team Work Division

| Member | Focus Area | Files / Modules |
|---|---|---|
| **Person 1** | Frontend / UI & Dashboard | `frontend/index.html`, `frontend/app.js`, `backend/routes/dashboard.js` |
| **Person 2** | Backend / Subscriptions | `backend/routes/subscriptions.js` (Plans, Customers, Subscriptions) |
| **Person 3** | Backend / Billing & Invoices | `backend/routes/billing.js` (Invoices, Taxes, Duplicate Prevention, Payments) |
| **Person 4** | Architecture, Integration & Demo | `supabase/schema.sql`, `backend/timeMachine.js`, `backend/seed.js`, Integration |

---

## 🚀 Quickstart

### Option A: Python API (FastAPI + SQLite)
```powershell
# 1. Run the server (auto-initializes SQLite DB and seeds demo data)
python run_server.py

# 2. Open interactive Swagger API docs in your browser:
# http://127.0.0.1:8000/docs
```

### Option B: Node.js + Supabase
```bash
cd backend
npm install
npm run seed
npm start
```
Open **http://localhost:5000** in your browser!

#### (Optional) Connect Supabase Cloud Database
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** -> copy and paste `supabase/schema.sql` -> click **Run**.
3. Copy your project URL & Anon key to `backend/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
PORT=5000
```
*(Note: If no Supabase credentials are provided, RecurOS automatically runs in **Zero-Config In-Memory Mode** so your team can build and demo immediately!)*

### Option C: Docker Compose (PostgreSQL + Redis + Mailpit + API)
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
