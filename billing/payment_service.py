"""
Payment recording and invoice management service for RecurOS.
Person 3 Deliverable:
- Records payments against invoices (methods, reference, notes, amounts)
- Updates invoice status (Draft -> Confirmed -> Partially Paid -> Paid / Overdue)
- Supports partial payments and keeps exact track of outstanding amounts
- Retrieves full explainable invoice details and payment histories
"""
import uuid
import json
from datetime import datetime
from models.database import get_connection

def record_invoice_payment(invoice_id, amount, payment_method, reference_no=None, notes=None, payment_date=None, db_path=None):
    """
    Records a payment against an invoice and updates its paid/due status.
    Returns (success: bool, payment_dict or None, message: str)
    """
    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return False, None, "Invalid payment amount specified"

    if amount <= 0:
        return False, None, "Payment amount must be greater than zero"

    conn = get_connection(db_path)
    cur = conn.cursor()

    # Fetch invoice
    cur.execute("SELECT * FROM invoices WHERE id = ?;", (invoice_id,))
    inv = cur.fetchone()
    if not inv:
        conn.close()
        return False, None, f"Invoice {invoice_id} not found"

    inv = dict(inv)

    if inv['status'] == 'Cancelled':
        conn.close()
        return False, None, "Cannot record payment on a cancelled invoice"

    if inv['amount_due'] <= 0.001:
        conn.close()
        return False, None, f"Invoice {inv['invoice_number']} is already fully paid"

    if amount > (inv['amount_due'] + 0.01):
        conn.close()
        return False, None, f"Payment amount (₹{amount:,.2f}) exceeds outstanding amount due (₹{inv['amount_due']:,.2f})"

    # Simulated date fallback
    if not payment_date:
        cur.execute("SELECT value FROM system_settings WHERE key = 'simulated_date';")
        row = cur.fetchone()
        payment_date = row['value'] if row and row['value'] else datetime.now().strftime("%Y-%m-%d")

    payment_id = f"PAY-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
    reference_no = reference_no or f"REF-{uuid.uuid4().hex[:8].upper()}"

    # 1. Insert Payment
    cur.execute("""
        INSERT INTO payments (id, invoice_id, payment_date, amount, payment_method, reference_no, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        payment_id, invoice_id, payment_date, amount,
        payment_method, reference_no, notes, datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ))

    # 2. Update Invoice
    new_paid = round(inv['amount_paid'] + amount, 2)
    new_due = max(0.0, round(inv['total_amount'] - new_paid, 2))

    if new_due <= 0.009:
        new_status = 'Paid'
    elif new_paid > 0:
        new_status = 'Partially Paid'
    else:
        new_status = 'Confirmed'

    cur.execute("""
        UPDATE invoices
        SET amount_paid = ?, amount_due = ?, status = ?
        WHERE id = ?;
    """, (new_paid, new_due, new_status, invoice_id))

    conn.commit()
    conn.close()

    payment_data = {
        "id": payment_id,
        "invoice_id": invoice_id,
        "invoice_number": inv['invoice_number'],
        "payment_date": payment_date,
        "amount": amount,
        "payment_method": payment_method,
        "reference_no": reference_no,
        "notes": notes,
        "new_amount_paid": new_paid,
        "new_amount_due": new_due,
        "new_status": new_status
    }

    return True, payment_data, f"Payment of ₹{amount:,.2f} recorded via {payment_method}. Invoice status: {new_status}"

def get_invoice_details(invoice_id, db_path=None):
    """
    Returns complete invoice details including customer, lines, calculation breakdown, and payments.
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
        SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
               s.plan_id, s.billing_interval, p.name as plan_name
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        JOIN subscriptions s ON i.subscription_id = s.id
        JOIN plans p ON s.plan_id = p.id
        WHERE i.id = ?;
    """, (invoice_id,))
    inv = cur.fetchone()
    if not inv:
        conn.close()
        return None

    inv_data = dict(inv)

    # Parse calculation breakdown
    try:
        inv_data['calculation_breakdown'] = json.loads(inv_data['calculation_breakdown_json'])
    except Exception:
        inv_data['calculation_breakdown'] = {}

    # Line items
    cur.execute("SELECT * FROM invoice_lines WHERE invoice_id = ?;", (invoice_id,))
    inv_data['lines'] = [dict(r) for r in cur.fetchall()]

    # Payments
    cur.execute("SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC, created_at DESC;", (invoice_id,))
    inv_data['payments'] = [dict(r) for r in cur.fetchall()]

    conn.close()
    return inv_data

def get_invoices(status_filter=None, db_path=None):
    """
    Lists invoices with optional status filtering (Draft, Confirmed, Paid, Partially Paid, Overdue, Cancelled).
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    query = """
        SELECT i.*, c.name as customer_name, c.email as customer_email, p.name as plan_name
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        JOIN subscriptions s ON i.subscription_id = s.id
        JOIN plans p ON s.plan_id = p.id
    """
    params = []
    if status_filter and status_filter.lower() != 'all':
        query += " WHERE LOWER(i.status) = LOWER(?)"
        params.append(status_filter)

    query += " ORDER BY i.created_at DESC, i.id DESC;"
    cur.execute(query, params)
    invoices = [dict(r) for r in cur.fetchall()]

    for inv in invoices:
        try:
            inv['calculation_breakdown'] = json.loads(inv['calculation_breakdown_json'])
        except Exception:
            inv['calculation_breakdown'] = {}

    conn.close()
    return invoices

def confirm_invoice(invoice_id, db_path=None):
    """Transitions invoice from Draft to Confirmed."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE invoices SET status = 'Confirmed' WHERE id = ? AND status = 'Draft';", (invoice_id,))
    changed = cur.rowcount > 0
    conn.commit()
    conn.close()
    return changed

def cancel_invoice(invoice_id, db_path=None):
    """Cancels an unpaid or draft invoice."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE invoices SET status = 'Cancelled' WHERE id = ? AND amount_paid = 0.0;", (invoice_id,))
    changed = cur.rowcount > 0
    conn.commit()
    conn.close()
    return changed
