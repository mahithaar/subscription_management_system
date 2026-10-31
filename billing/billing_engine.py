"""
Core Billing and Invoicing Engine for RecurOS / Brightloop Software.
Person 3 Deliverable:
- Generates invoices from subscriptions
- Calculates explainable breakdowns (base, variants, discounts, taxes, totals)
- Prevents duplicate invoices via deterministic idempotency keys
- Implements Billing Run with Proof (audit logs explaining every generated or skipped subscription)
- Billing preview (dry run) and execute modes
"""
import json
import uuid
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from models.database import get_connection

def get_simulated_date(conn):
    """Retrieves current simulated date from settings, or system date."""
    cur = conn.cursor()
    cur.execute("SELECT value FROM system_settings WHERE key = 'simulated_date';")
    row = cur.fetchone()
    if row and row['value']:
        return row['value']
    return datetime.now().strftime("%Y-%m-%d")

def set_simulated_date(date_str, conn=None):
    """Updates simulated date for Time Machine demo."""
    close_at_end = False
    if conn is None:
        conn = get_connection()
        close_at_end = True
    cur = conn.cursor()
    cur.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('simulated_date', ?);", (date_str,))
    conn.commit()
    if close_at_end:
        conn.close()

def compute_billing_period(start_date_str, interval="monthly"):
    """
    Computes (period_start, period_end) and next billing date based on interval.
    """
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
    if interval == "yearly":
        end_dt = start_dt + relativedelta(years=1)
    elif interval == "weekly":
        end_dt = start_dt + timedelta(days=7)
    else:  # monthly default
        end_dt = start_dt + relativedelta(months=1)
    
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

def generate_idempotency_hash(subscription_id, period_start, period_end):
    """
    Creates a deterministic idempotency key for subscription billing periods.
    Prevents duplicate invoice generation for the same billing window.
    """
    return f"IDEMP:{subscription_id}:{period_start}:{period_end}"

def calculate_subscription_breakdown(sub, lines, discount_rule=None, tax_rule=None):
    """
    Computes an Explainable Invoice breakdown:
    - Base price
    - Variant / extra feature add-ons
    - Applicable discounts (fixed or percentage)
    - Configured tax rules
    - Final total amount
    """
    base_subtotal = 0.0
    variants_subtotal = 0.0
    line_items_data = []

    for line in lines:
        qty = int(line['quantity'])
        u_price = float(line['unit_price'])
        v_extra = float(line['variant_extra_price']) if line['variant_extra_price'] else 0.0
        
        line_base = qty * u_price
        line_variant = qty * v_extra
        line_total = line_base + line_variant

        base_subtotal += line_base
        variants_subtotal += line_variant

        line_items_data.append({
            "product_id": line['product_id'],
            "product_name": line.get('product_name', 'Software Product'),
            "variant_name": line.get('variant_name', 'Standard'),
            "quantity": qty,
            "unit_price": u_price,
            "variant_extra_price": v_extra,
            "subtotal": round(line_total, 2)
        })

    gross_subtotal = base_subtotal + variants_subtotal

    # Discount calculation
    discount_amount = 0.0
    discount_name = None
    if discount_rule and discount_rule.get('is_active', 1):
        d_type = discount_rule.get('discount_type', 'fixed')
        d_val = float(discount_rule.get('discount_value', 0.0))
        min_qty = int(discount_rule.get('min_quantity', 1))
        min_amt = float(discount_rule.get('min_amount', 0.0))

        # Check eligibility criteria
        total_qty = sum(item['quantity'] for item in line_items_data)
        if total_qty >= min_qty and gross_subtotal >= min_amt:
            discount_name = discount_rule.get('name', 'Applied Discount')
            if d_type == 'percentage':
                discount_amount = (d_val / 100.0) * gross_subtotal
            else:
                discount_amount = min(d_val, gross_subtotal)

    discount_amount = round(discount_amount, 2)
    taxable_amount = max(0.0, round(gross_subtotal - discount_amount, 2))

    # Tax calculation
    tax_amount = 0.0
    tax_rate = 0.0
    tax_name = None
    if tax_rule and tax_rule.get('is_active', 1):
        tax_name = tax_rule.get('name', 'Standard Tax')
        tax_rate = float(tax_rule.get('rate_percentage', 0.0))
        tax_amount = round((tax_rate / 100.0) * taxable_amount, 2)

    total_amount = round(taxable_amount + tax_amount, 2)

    breakdown = {
        "base_price": round(base_subtotal, 2),
        "variants_price": round(variants_subtotal, 2),
        "gross_subtotal": round(gross_subtotal, 2),
        "discount_name": discount_name,
        "discount_amount": discount_amount,
        "taxable_amount": taxable_amount,
        "tax_name": tax_name,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "line_items": line_items_data
    }
    return breakdown

def check_duplicate_invoice(conn, subscription_id, period_start, period_end):
    """
    Checks if an invoice already exists for this subscription and period.
    Returns existing invoice row if found, else None.
    """
    cur = conn.cursor()
    idemp_hash = generate_idempotency_hash(subscription_id, period_start, period_end)
    cur.execute(
        "SELECT id, invoice_number, status, total_amount, issue_date FROM invoices WHERE idempotency_hash = ? AND status != 'Cancelled';",
        (idemp_hash,)
    )
    return cur.fetchone()

def generate_single_invoice_for_sub(conn, sub_row, target_date=None, auto_confirm=True):
    """
    Generates an invoice for a specific subscription row.
    Returns (success: bool, invoice_data or None, message: str)
    """
    cur = conn.cursor()
    target_date = target_date or get_simulated_date(conn)
    sub_id = sub_row['id']

    # 1. Status Check
    if sub_row['status'] != 'Active':
        return False, None, f"Subscription status is '{sub_row['status']}' (Only 'Active' subscriptions can be billed)"

    # 2. Expiry Check
    if sub_row['expiry_date'] and target_date > sub_row['expiry_date']:
        return False, None, f"Subscription expired on {sub_row['expiry_date']}"

    # 3. Duplicate check for current target date / period
    cur.execute("""
        SELECT invoice_number, period_start, period_end
        FROM invoices
        WHERE subscription_id = ? 
          AND ((period_start <= ? AND period_end > ?) OR issue_date = ?)
          AND status != 'Cancelled';
    """, (sub_id, target_date, target_date, target_date))
    existing_cycle_inv = cur.fetchone()
    if existing_cycle_inv:
        return False, None, f"Duplicate blocked: Invoice {existing_cycle_inv['invoice_number']} already exists for period {existing_cycle_inv['period_start']} to {existing_cycle_inv['period_end']} (Prevented duplicate charge)"

    # 4. Next Billing Date Check
    next_bill = sub_row['next_billing_date']
    if next_bill > target_date:
        return False, None, f"Not due yet: Next billing date ({next_bill}) is in the future (target date: {target_date})"

    # 5. Period & Idempotency Check
    interval = sub_row['billing_interval'] or 'monthly'
    period_start, period_end, next_period_date = compute_billing_period(next_bill, interval)
    idemp_hash = generate_idempotency_hash(sub_id, period_start, period_end)

    existing = check_duplicate_invoice(conn, sub_id, period_start, period_end)
    if existing:
        return False, None, f"Duplicate blocked: Invoice {existing['invoice_number']} already exists for period {period_start} to {period_end}"

    # 5. Load subscription line items
    cur.execute("""
        SELECT sl.*, p.name as product_name
        FROM subscription_lines sl
        JOIN products p ON sl.product_id = p.id
        WHERE sl.subscription_id = ?;
    """, (sub_id,))
    lines = [dict(r) for r in cur.fetchall()]

    if not lines:
        return False, None, f"Subscription {sub_id} has no product line items configured"

    # 6. Load Discount & Tax rules
    discount_rule = None
    if sub_row['discount_id']:
        cur.execute("SELECT * FROM discount_rules WHERE id = ?;", (sub_row['discount_id'],))
        d_row = cur.fetchone()
        if d_row:
            discount_rule = dict(d_row)

    tax_rule = None
    if sub_row['tax_id']:
        cur.execute("SELECT * FROM tax_rules WHERE id = ?;", (sub_row['tax_id'],))
        t_row = cur.fetchone()
        if t_row:
            tax_rule = dict(t_row)

    # 7. Calculate Explainable Breakdown
    breakdown = calculate_subscription_breakdown(sub_row, lines, discount_rule, tax_rule)

    # 8. Invoice Number & Dates
    cur.execute("SELECT COUNT(*) as count FROM invoices;")
    inv_count = cur.fetchone()['count'] + 1
    invoice_id = f"INV-{datetime.now().strftime('%Y%m')}-{inv_count:04d}"
    invoice_number = f"INV-{sub_id.replace('SUB-', '')}-{datetime.now().strftime('%y%m%d')}-{inv_count:03d}"

    issue_date = target_date
    terms_days = int(sub_row['payment_terms_days'] or 15)
    due_dt = datetime.strptime(issue_date, "%Y-%m-%d") + timedelta(days=terms_days)
    due_date = due_dt.strftime("%Y-%m-%d")

    initial_status = "Confirmed" if auto_confirm else "Draft"

    # 9. Insert Invoice
    cur.execute("""
        INSERT INTO invoices (
            id, invoice_number, subscription_id, customer_id, period_start, period_end,
            issue_date, due_date, status, base_amount, variants_amount, discount_amount,
            taxable_amount, tax_amount, total_amount, amount_paid, amount_due,
            calculation_breakdown_json, idempotency_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?, ?);
    """, (
        invoice_id, invoice_number, sub_id, sub_row['customer_id'],
        period_start, period_end, issue_date, due_date, initial_status,
        breakdown['base_price'], breakdown['variants_price'], breakdown['discount_amount'],
        breakdown['taxable_amount'], breakdown['tax_amount'], breakdown['total_amount'],
        breakdown['total_amount'], json.dumps(breakdown), idemp_hash, target_date
    ))

    # 10. Insert Line Items
    for item in breakdown['line_items']:
        line_id = f"INVL-{uuid.uuid4().hex[:8]}"
        desc = f"{item['product_name']} ({item['variant_name']})" if item['variant_name'] != 'Standard' else item['product_name']
        cur.execute("""
            INSERT INTO invoice_lines (
                id, invoice_id, description, quantity, unit_price, variant_extra_price, subtotal
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (
            line_id, invoice_id, desc, item['quantity'],
            item['unit_price'], item['variant_extra_price'], item['subtotal']
        ))

    # 11. Update Subscription's next billing date
    cur.execute("UPDATE subscriptions SET next_billing_date = ? WHERE id = ?;", (next_period_date, sub_id))

    # 12. If discount used, increment times_used
    if discount_rule:
        cur.execute("UPDATE discount_rules SET times_used = times_used + 1 WHERE id = ?;", (discount_rule['id'],))

    invoice_data = {
        "id": invoice_id,
        "invoice_number": invoice_number,
        "subscription_id": sub_id,
        "customer_id": sub_row['customer_id'],
        "period_start": period_start,
        "period_end": period_end,
        "issue_date": issue_date,
        "due_date": due_date,
        "status": initial_status,
        "total_amount": breakdown['total_amount'],
        "breakdown": breakdown
    }
    return True, invoice_data, f"Invoice {invoice_number} successfully generated for ₹{breakdown['total_amount']:,.2f}"

def preview_billing_run(target_date=None, db_path=None):
    """
    Performs a dry-run billing analysis without making database changes.
    Shows which subscriptions will be billed, amounts, and which will be skipped with reasons.
    """
    conn = get_connection(db_path)
    cur = conn.cursor()
    target_date = target_date or get_simulated_date(conn)

    cur.execute("""
        SELECT s.*, c.name as customer_name, c.email as customer_email, p.name as plan_name
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN plans p ON s.plan_id = p.id
        ORDER BY s.id ASC;
    """)
    subscriptions = [dict(r) for r in cur.fetchall()]

    preview_items = []
    total_estim_amount = 0.0
    will_generate_count = 0
    will_skip_count = 0

    for sub in subscriptions:
        sub_id = sub['id']
        cust_name = sub['customer_name']
        
        # Check reasons
        if sub['status'] != 'Active':
            preview_items.append({
                "subscription_id": sub_id,
                "customer_name": cust_name,
                "plan_name": sub['plan_name'],
                "action": "SKIP",
                "reason": f"Subscription status is '{sub['status']}' (Inactive)",
                "estimated_amount": 0.0
            })
            will_skip_count += 1
            continue

        if sub['expiry_date'] and target_date > sub['expiry_date']:
            preview_items.append({
                "subscription_id": sub_id,
                "customer_name": cust_name,
                "plan_name": sub['plan_name'],
                "action": "SKIP",
                "reason": f"Subscription expired on {sub['expiry_date']}",
                "estimated_amount": 0.0
            })
            will_skip_count += 1
            continue

        # Check if already invoiced for this period/target date
        cur.execute("""
            SELECT invoice_number, period_start, period_end
            FROM invoices
            WHERE subscription_id = ? 
              AND ((period_start <= ? AND period_end > ?) OR issue_date = ?)
              AND status != 'Cancelled';
        """, (sub_id, target_date, target_date, target_date))
        existing_cycle_inv = cur.fetchone()
        if existing_cycle_inv:
            preview_items.append({
                "subscription_id": sub_id,
                "customer_name": cust_name,
                "plan_name": sub['plan_name'],
                "action": "SKIP",
                "reason": f"Duplicate blocked: Invoice {existing_cycle_inv['invoice_number']} already exists for this cycle",
                "estimated_amount": 0.0
            })
            will_skip_count += 1
            continue

        if sub['next_billing_date'] > target_date:
            preview_items.append({
                "subscription_id": sub_id,
                "customer_name": cust_name,
                "plan_name": sub['plan_name'],
                "action": "SKIP",
                "reason": f"Next billing date ({sub['next_billing_date']}) is in the future",
                "estimated_amount": 0.0
            })
            will_skip_count += 1
            continue

        interval = sub['billing_interval'] or 'monthly'
        p_start, p_end, _ = compute_billing_period(sub['next_billing_date'], interval)
        existing = check_duplicate_invoice(conn, sub_id, p_start, p_end)
        if existing:
            preview_items.append({
                "subscription_id": sub_id,
                "customer_name": cust_name,
                "plan_name": sub['plan_name'],
                "action": "SKIP",
                "reason": f"Duplicate blocked: Invoice {existing['invoice_number']} already exists for this cycle",
                "estimated_amount": 0.0
            })
            will_skip_count += 1
            continue

        # Load lines to calculate amount
        cur.execute("""
            SELECT sl.*, p.name as product_name
            FROM subscription_lines sl
            JOIN products p ON sl.product_id = p.id
            WHERE sl.subscription_id = ?;
        """, (sub_id,))
        lines = [dict(r) for r in cur.fetchall()]

        discount_rule = None
        if sub['discount_id']:
            cur.execute("SELECT * FROM discount_rules WHERE id = ?;", (sub['discount_id'],))
            d_row = cur.fetchone()
            if d_row:
                discount_rule = dict(d_row)

        tax_rule = None
        if sub['tax_id']:
            cur.execute("SELECT * FROM tax_rules WHERE id = ?;", (sub['tax_id'],))
            t_row = cur.fetchone()
            if t_row:
                tax_rule = dict(t_row)

        breakdown = calculate_subscription_breakdown(sub, lines, discount_rule, tax_rule)
        preview_items.append({
            "subscription_id": sub_id,
            "customer_name": cust_name,
            "plan_name": sub['plan_name'],
            "action": "GENERATE",
            "reason": f"Due on {sub['next_billing_date']} (Period: {p_start} to {p_end})",
            "estimated_amount": breakdown['total_amount'],
            "breakdown": breakdown
        })
        total_estim_amount += breakdown['total_amount']
        will_generate_count += 1

    conn.close()
    return {
        "target_date": target_date,
        "total_examined": len(subscriptions),
        "will_generate": will_generate_count,
        "will_skip": will_skip_count,
        "total_estimated_amount": round(total_estim_amount, 2),
        "items": preview_items
    }

def execute_billing_run(target_date=None, db_path=None):
    """
    Executes the Billing Run with Proof:
    - Examines every subscription
    - Generates invoices for due subscriptions
    - Blocks duplicate charges
    - Records comprehensive audit proof log
    """
    conn = get_connection(db_path)
    cur = conn.cursor()
    target_date = target_date or get_simulated_date(conn)

    cur.execute("""
        SELECT s.*, c.name as customer_name, c.email as customer_email, p.name as plan_name
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN plans p ON s.plan_id = p.id
        ORDER BY s.id ASC;
    """)
    subscriptions = [dict(r) for r in cur.fetchall()]

    run_id = f"RUN-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    proof_logs = []
    generated_count = 0
    skipped_count = 0
    total_amount_invoiced = 0.0

    for sub in subscriptions:
        success, inv_data, msg = generate_single_invoice_for_sub(conn, sub, target_date=target_date, auto_confirm=True)
        if success:
            generated_count += 1
            total_amount_invoiced += inv_data['total_amount']
            proof_logs.append({
                "subscription_id": sub['id'],
                "customer_name": sub['customer_name'],
                "action": "GENERATED",
                "invoice_number": inv_data['invoice_number'],
                "amount": inv_data['total_amount'],
                "reason": msg,
                "breakdown": inv_data['breakdown']
            })
        else:
            skipped_count += 1
            proof_logs.append({
                "subscription_id": sub['id'],
                "customer_name": sub['customer_name'],
                "action": "SKIPPED",
                "invoice_number": None,
                "amount": 0.0,
                "reason": msg
            })

    # Save Billing Run Record to DB
    cur.execute("""
        INSERT INTO billing_runs (
            id, run_timestamp, target_date, total_examined, invoices_generated,
            subscriptions_skipped, total_amount_invoiced, proof_log_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        run_id, timestamp, target_date, len(subscriptions),
        generated_count, skipped_count, round(total_amount_invoiced, 2),
        json.dumps(proof_logs)
    ))

    conn.commit()
    conn.close()

    return {
        "run_id": run_id,
        "run_timestamp": timestamp,
        "target_date": target_date,
        "total_examined": len(subscriptions),
        "invoices_generated": generated_count,
        "subscriptions_skipped": skipped_count,
        "total_amount_invoiced": round(total_amount_invoiced, 2),
        "proof_logs": proof_logs
    }

def get_billing_runs(limit=10, db_path=None):
    """Retrieves previous billing runs and their proof logs."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM billing_runs ORDER BY run_timestamp DESC LIMIT ?;", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        try:
            r['proof_logs'] = json.loads(r['proof_log_json'])
        except Exception:
            r['proof_logs'] = []
    conn.close()
    return rows
