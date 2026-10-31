"""
RecurOS — Brightloop Software Subscription Management System
Main Application Server (Person 3 Deliverable: Billing & Invoicing Engine)
Serves Web UI and REST APIs for Billing Runs, Explainable Invoices, Payments, and Time Machine.
"""
import os
import json
from datetime import datetime
from dateutil.relativedelta import relativedelta
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

from models.database import init_db, get_connection
from models.seed_data import seed_demo_data
from billing.billing_engine import (
    calculate_subscription_breakdown,
    preview_billing_run,
    execute_billing_run,
    generate_single_invoice_for_sub,
    get_billing_runs,
    get_simulated_date,
    set_simulated_date
)
from billing.payment_service import (
    record_invoice_payment,
    get_invoice_details,
    get_invoices,
    confirm_invoice,
    cancel_invoice
)

app = Flask(__name__)
CORS(app)

# Ensure DB is ready on startup
init_db()

@app.route("/")
def index():
    """Serves the main RecurOS Billing & Invoice Dashboard."""
    return render_template("index.html")

# ----------------- SYSTEM & TIME MACHINE APIS -----------------

@app.route("/api/status", methods=["GET"])
def get_system_status():
    """Returns top-level metrics for dashboard cards."""
    conn = get_connection()
    cur = conn.cursor()
    sim_date = get_simulated_date(conn)

    # Invoices metrics
    cur.execute("""
        SELECT 
            COUNT(*) as total_invoices,
            COALESCE(SUM(total_amount), 0.0) as total_invoiced,
            COALESCE(SUM(amount_paid), 0.0) as total_paid,
            COALESCE(SUM(amount_due), 0.0) as total_due
        FROM invoices WHERE status != 'Cancelled';
    """)
    inv_stats = dict(cur.fetchone())

    # Overdue count
    cur.execute("""
        SELECT COUNT(*) as overdue_count
        FROM invoices
        WHERE status NOT IN ('Paid', 'Cancelled') AND due_date < ?;
    """, (sim_date,))
    overdue_stats = dict(cur.fetchone())

    # Subscriptions count
    cur.execute("""
        SELECT 
            COUNT(*) as total_subscriptions,
            SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_subscriptions
        FROM subscriptions;
    """)
    sub_stats = dict(cur.fetchone())

    # Last billing run
    cur.execute("SELECT * FROM billing_runs ORDER BY run_timestamp DESC LIMIT 1;")
    last_run = cur.fetchone()

    conn.close()
    return jsonify({
        "simulated_date": sim_date,
        "total_revenue": round(inv_stats["total_paid"], 2),
        "total_invoiced": round(inv_stats["total_invoiced"], 2),
        "total_due": round(inv_stats["total_due"], 2),
        "total_invoices": inv_stats["total_invoices"],
        "overdue_invoices": overdue_stats["overdue_count"],
        "total_subscriptions": sub_stats["total_subscriptions"] or 0,
        "active_subscriptions": sub_stats["active_subscriptions"] or 0,
        "last_billing_run": dict(last_run) if last_run else None
    })

@app.route("/api/time-machine", methods=["GET"])
def api_get_time():
    """Gets current simulated date."""
    conn = get_connection()
    date_val = get_simulated_date(conn)
    conn.close()
    return jsonify({"simulated_date": date_val})

@app.route("/api/time-machine/advance", methods=["POST"])
def api_advance_time():
    """
    Advances simulated date:
    - days: number of days to jump
    - months: number of months to jump
    - date: explicit target date (YYYY-MM-DD)
    """
    data = request.get_json() or {}
    conn = get_connection()
    current_str = get_simulated_date(conn)
    curr_dt = datetime.strptime(current_str, "%Y-%m-%d")

    if "date" in data and data["date"]:
        new_date_str = data["date"]
    elif "months" in data:
        new_dt = curr_dt + relativedelta(months=int(data["months"]))
        new_date_str = new_dt.strftime("%Y-%m-%d")
    elif "days" in data:
        new_dt = curr_dt + relativedelta(days=int(data["days"]))
        new_date_str = new_dt.strftime("%Y-%m-%d")
    else:
        new_dt = curr_dt + relativedelta(months=1)
        new_date_str = new_dt.strftime("%Y-%m-%d")

    set_simulated_date(new_date_str, conn=conn)
    conn.close()
    return jsonify({
        "success": True,
        "previous_date": current_str,
        "simulated_date": new_date_str,
        "message": f"Time machine advanced to {new_date_str}"
    })

@app.route("/api/time-machine/reset", methods=["POST"])
def api_reset_time():
    """Resets simulated date to today or initial demo date (2026-10-31)."""
    default_date = "2026-10-31"
    conn = get_connection()
    set_simulated_date(default_date, conn=conn)
    conn.close()
    return jsonify({
        "success": True,
        "simulated_date": default_date,
        "message": f"Simulated date reset to {default_date}"
    })

@app.route("/api/seed", methods=["POST"])
def api_seed_data():
    """Re-seeds demo data for a fresh hackathon demo presentation."""
    conn = get_connection()
    sim_date = get_simulated_date(conn)
    conn.close()
    seed_demo_data(simulated_date_str=sim_date)
    return jsonify({
        "success": True,
        "message": "Demo data successfully seeded with products, plans, customers, and subscriptions."
    })

# ----------------- BILLING RUN APIS (SIGNATURE FEATURE) -----------------

@app.route("/api/billing/preview", methods=["GET", "POST"])
def api_preview_billing():
    """Dry-run preview of what would be billed on the current simulated date."""
    target_date = request.args.get("target_date")
    if not target_date and request.is_json:
        target_date = request.get_json().get("target_date")
    preview = preview_billing_run(target_date=target_date)
    return jsonify(preview)

@app.route("/api/billing/run", methods=["POST"])
def api_run_billing():
    """Executes the Billing Run with Proof for the simulated date."""
    data = request.get_json() or {}
    target_date = data.get("target_date")
    result = execute_billing_run(target_date=target_date)
    return jsonify(result)

@app.route("/api/billing/runs", methods=["GET"])
def api_get_billing_runs():
    """Returns past billing run logs with detailed proof audits."""
    limit = int(request.args.get("limit", 10))
    runs = get_billing_runs(limit=limit)
    return jsonify({"billing_runs": runs})

# ----------------- INVOICE & PAYMENT APIS -----------------

@app.route("/api/invoices", methods=["GET"])
def api_list_invoices():
    """Lists invoices with optional status filter (?status=Paid|Draft|Confirmed|etc)."""
    status_filter = request.args.get("status")
    invoices = get_invoices(status_filter=status_filter)
    return jsonify({"invoices": invoices, "count": len(invoices)})

@app.route("/api/invoices/<invoice_id>", methods=["GET"])
def api_get_invoice(invoice_id):
    """Returns single invoice with explainable breakdown and payment history."""
    inv = get_invoice_details(invoice_id)
    if not inv:
        return jsonify({"error": "Invoice not found"}), 404
    return jsonify(inv)

@app.route("/api/invoices/<invoice_id>/confirm", methods=["POST"])
def api_confirm_invoice(invoice_id):
    """Moves invoice from Draft to Confirmed."""
    ok = confirm_invoice(invoice_id)
    if not ok:
        return jsonify({"error": "Invoice not in Draft status or not found"}), 400
    return jsonify({"success": True, "message": f"Invoice {invoice_id} confirmed"})

@app.route("/api/invoices/<invoice_id>/cancel", methods=["POST"])
def api_cancel_invoice(invoice_id):
    """Cancels an invoice if no payments have been applied."""
    ok = cancel_invoice(invoice_id)
    if not ok:
        return jsonify({"error": "Cannot cancel paid or non-existent invoice"}), 400
    return jsonify({"success": True, "message": f"Invoice {invoice_id} cancelled"})

@app.route("/api/invoices/<invoice_id>/payments", methods=["POST"])
def api_record_payment(invoice_id):
    """Records a payment against an invoice."""
    data = request.get_json() or {}
    amount = data.get("amount")
    method = data.get("payment_method", "Bank Transfer")
    ref = data.get("reference_no")
    notes = data.get("notes")
    pay_date = data.get("payment_date")

    success, payment_data, message = record_invoice_payment(
        invoice_id=invoice_id,
        amount=amount,
        payment_method=method,
        reference_no=ref,
        notes=notes,
        payment_date=pay_date
    )

    if not success:
        return jsonify({"success": False, "error": message}), 400

    return jsonify({"success": True, "payment": payment_data, "message": message})

# ----------------- SUBSCRIPTION APIS (FOR TEAM INTEGRATION) -----------------

@app.route("/api/subscriptions", methods=["GET"])
def api_list_subscriptions():
    """Lists subscriptions with billing readiness status."""
    conn = get_connection()
    cur = conn.cursor()
    sim_date = get_simulated_date(conn)

    cur.execute("""
        SELECT s.*, c.name as customer_name, c.email as customer_email, p.name as plan_name, p.price as plan_price
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN plans p ON s.plan_id = p.id
        ORDER BY s.id ASC;
    """)
    subs = [dict(r) for r in cur.fetchall()]

    for s in subs:
        cur.execute("""
            SELECT sl.*, p.name as product_name 
            FROM subscription_lines sl
            JOIN products p ON sl.product_id = p.id
            WHERE sl.subscription_id = ?;
        """, (s['id'],))
        s['lines'] = [dict(r) for r in cur.fetchall()]
        s['is_due'] = (s['status'] == 'Active' and s['next_billing_date'] <= sim_date)

    conn.close()
    return jsonify({"subscriptions": subs, "count": len(subs), "simulated_date": sim_date})

@app.route("/api/subscriptions/<sub_id>/bill-now", methods=["POST"])
def api_bill_subscription_now(sub_id):
    """Manually bills a single subscription immediately."""
    conn = get_connection()
    cur = conn.cursor()
    sim_date = get_simulated_date(conn)

    cur.execute("SELECT * FROM subscriptions WHERE id = ?;", (sub_id,))
    sub = cur.fetchone()
    if not sub:
        conn.close()
        return jsonify({"success": False, "error": "Subscription not found"}), 404

    success, inv_data, msg = generate_single_invoice_for_sub(conn, sub, target_date=sim_date, auto_confirm=True)
    conn.commit()
    conn.close()

    if not success:
        return jsonify({"success": False, "error": msg}), 400

    return jsonify({"success": True, "invoice": inv_data, "message": msg})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"=======================================================")
    print(f"  RecurOS — Brightloop Subscription Management System")
    print(f"  Person 3: Billing & Invoicing Engine")
    print(f"  Running on http://localhost:{port}")
    print(f"=======================================================")
    app.run(host="0.0.0.0", port=port, debug=True)
