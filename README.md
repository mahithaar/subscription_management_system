# RecurOS — Subscription & Recurring Billing Management System
> Built for the Cochin Hackathon (Brightloop Software Challenge)

RecurOS is a robust subscription billing management platform engineered to eliminate duplicate billing, automate invoice generation, and manage customer recurring lifecycles.

---

## 👥 Team Work Division

| Member | Focus Area | Files / Modules |
|---|---|---|
| **Person 1** | Frontend / UI & Dashboard | `frontend/index.html`, `frontend/app.js`, `backend/routes/dashboard.js` |
| **Person 2** | Backend / Subscriptions | `backend/routes/subscriptions.js` (Plans, Customers, Subscriptions) |
| **Person 3** | Backend / Billing & Invoices | `backend/routes/billing.js` (Invoices, Taxes, Duplicate Prevention, Payments) |
| **Person 4** | Architecture, Integration & Demo | `supabase/schema.sql`, `backend/timeMachine.js`, `backend/seed.js`, Integration |

---

## ⚡ Quick Start (In Under 2 Minutes)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. (Optional) Connect Supabase Cloud Database
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** -> copy and paste `supabase/schema.sql` -> click **Run**.
3. Copy your project URL & Anon key to `backend/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
PORT=5000
```
*(Note: If no Supabase credentials are provided, RecurOS automatically runs in **Zero-Config In-Memory Mode** so your team can build and demo immediately!)*

### 3. Seed Sample Data
```bash
npm run seed
```

### 4. Start the Application
```bash
npm start
```
Open **http://localhost:5000** in your browser!

---

## 🌟 Hackathon Standout Features (How to Win Over Judges)

### 1. The Time Machine (Simulated Clock)
Because real recurring billing takes 30 days, Person 4 built a virtual clock engine.
* Hit **"+30 Days"** on the top toolbar to jump forward by 1 month.
* Watch recurring subscriptions become due instantly!

### 2. Billing Run with Proof (Zero-Duplicate Idempotency)
* Click **"Run Billing Run"** -> All due subscriptions receive clean, line-item itemized invoices.
* Click **"Run Billing Run"** again immediately -> The system proves that **0 duplicate invoices** were generated and displays the mathematical idempotency shield audit log.

### 3. Explainable Invoices
Invoices clearly show:
- Base Plan Amount
- Discounts
- GST (18%)
- Total Payable
