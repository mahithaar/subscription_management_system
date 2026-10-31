# RecurOS — Subscription & Billing Management System
> **Brightloop Software Hackathon Project**  
> **Team Module: Person 3 — Billing / Invoices (Main Functionality)**

RecurOS is a unified subscription management and recurring billing platform designed for SaaS businesses like Brightloop Software. It eliminates spreadsheet errors, missed renewals, double billing, and tax miscalculations with automated, idempotent invoice generation.

---

## 🌟 Person 3 Key Features & Deliverables

### 1. ⚡ Billing Run with Proof & 100% Duplicate Prevention
- **Batch Billing Engine**: Evaluates active subscriptions due on or before the billing date.
- **Idempotency Guarantee**: Uses deterministic composite hashing (`subscription_id` + `period_start` + `period_end`) to ensure **no customer is ever billed twice for the same cycle**.
- **Audit Proof Report**: Explains why any subscription was processed or skipped:
  - `GENERATED`: Due on current date, invoice created.
  - `DUPLICATE BLOCKED`: Invoice already issued for this cycle.
  - `SKIPPED (INACTIVE)`: Subscription in `Draft` or `Quotation` status.
  - `SKIPPED (NOT DUE)`: Next billing date is in the future.

### 2. 🧮 Explainable Invoice Breakdown
Rather than an unexplained lump sum, RecurOS provides a complete, auditable calculation breakdown matching the challenge specifications:
- **Base Software Price**: ₹1,000.00
- **Extra Feature / Variant Add-on**: + ₹560.00 *(Odoo Brand Edition)*
- **Gross Subtotal**: ₹1,560.00
- **Discount Applied**: - ₹100.00 *(Early Adopter Flat Coupon)*
- **Taxable Subtotal**: ₹1,460.00
- **Configured Tax (GST 18%)**: + ₹262.80
- **Total Payable Amount**: **₹1,722.80**

### 3. 💳 Payment Lifecycle & Partial Payments
- Support for multiple payment methods: `UPI / Google Pay`, `Credit Card`, `Bank Transfer (NEFT/RTGS)`, `Net Banking`, `Cash`.
- Dynamic status lifecycle:
  - `Draft` → `Confirmed` → `Partially Paid` → `Paid` (or `Overdue`).
- Automatic balance tracking (`amount_due = total_amount - amount_paid`).
- Overpayment protection.

### 4. ⏱️ Time Machine Simulated Date
- Accelerates time without waiting a calendar month.
- Demo controls: `+1 Day`, `+7 Days`, `+1 Month`, `Reset`.
- Test recurring renewal cycles in seconds in front of judges!

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Flask & dependencies:
  ```bash
  pip install -r requirements.txt
  ```

### Run the Application
```bash
python app.py
```
Open **`http://localhost:5000`** in your browser.

Or double-click **`run_billing.bat`** on Windows.

---

## 🧪 Run Automated Tests
```bash
python -m unittest discover tests
```
All 5 automated tests verify:
1. Explainable invoice mathematical breakdown (`1000 + 560 - 100 + 18% = ₹1,722.80`).
2. Billing run generation and status filtering.
3. Duplicate invoice prevention (second run generates 0 invoices).
4. Partial and full payment balance transitions.
5. Time machine cycle advancement.

---

## 🎬 3-Minute Hackathon Demo Script for Judges

1. **Open Dashboard**:
   - Point out the clean KPIs: Revenue Collected, Outstanding Receivables, Active Subscriptions.
   - Show the current simulated date (`2026-10-31`).

2. **Run Billing Run with Proof**:
   - Click **"Preview Billing Run"**: shows 3 subscriptions ready to bill, 2 skipped (1 Draft, 1 future).
   - Click **"Run Billing with Proof"**: watch invoices `INV-0001`, `INV-0002`, `INV-0003` generated live!
   - Highlight the Audit Proof table explaining every decision.

3. **The Wow Moment (Duplicate Prevention)**:
   - Click **"Run Billing with Proof" a second time** for the same date.
   - **Result**: `0 Invoices Generated`, `5 Subscriptions Skipped`.
   - Show the proof badge: `DUPLICATE BLOCKED: Invoice already exists for this cycle`.
   - Judges love seeing proof that double-charging is impossible!

4. **Show Explainable Invoice**:
   - In the Invoices table, click **"Breakdown"** on Mahi Solutions' invoice (`INV-001`).
   - Show the exact step-by-step math breakdown: Base ₹1,000 + Odoo Variant ₹560 - Discount ₹100 + GST 18% = ₹1,722.80.

5. **Record Payment**:
   - Click **"Record Payment"**.
   - Pay ₹722.80 via UPI $\rightarrow$ Status changes to `Partially Paid`, remaining due ₹1,000.
   - Record remaining ₹1,000 via Bank Transfer $\rightarrow$ Status changes to `Paid`, due ₹0.00.
   - Notice the Top KPI card for Total Revenue immediately updates!

6. **Demonstrate Recurring Cycle with Time Machine**:
   - In the top bar, click **"+1 Month"** (Simulated date jumps to `2026-11-30`).
   - Notice the subscriptions table now shows subscriptions due for November!
   - Click **"Run Billing with Proof"** again to generate next month's invoices.

---

## 📁 Project Architecture

```
subscription_management_system/
├── app.py                      # Flask REST API and Web Dashboard server
├── billing/
│   ├── __init__.py             # Billing package exports
│   ├── billing_engine.py       # Core invoice generation, calculations, duplicate protection
│   └── payment_service.py      # Payment recording, status transitions, balance tracking
├── models/
│   ├── __init__.py
│   ├── database.py             # SQLite schema and tables
│   └── seed_data.py            # Brightloop Software demo data
├── static/
│   ├── css/style.css           # Modern dark SaaS dashboard design
│   └── js/billing_app.js       # Real-time UI logic and Time Machine handler
├── templates/
│   └── index.html              # Responsive Web UI
├── tests/
│   ├── __init__.py
│   └── test_billing.py         # Automated unit test suite
├── requirements.txt            # Python dependencies
├── TEAM_INTEGRATION_GUIDE.md   # Integration specs for Persons 1, 2, and 4
├── run_billing.bat             # 1-click launcher
└── README.md
```
