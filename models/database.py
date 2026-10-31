"""
Database schema and initialization for RecurOS / Brightloop Subscription Management.
Designed for Person 3 (Billing & Invoicing) and shared across the team.
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database.db")

def get_connection(db_path=None):
    """Returns a SQLite connection with row factory configured."""
    target_path = db_path or DB_PATH
    conn = sqlite3.connect(target_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path=None):
    """Creates all tables if they do not exist."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # System Settings (stores simulated date for Time Machine)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    # Products table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'software', -- software, service, add_on
        sales_price REAL NOT NULL DEFAULT 0.0,
        cost_price REAL NOT NULL DEFAULT 0.0,
        description TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # Plans table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id),
        name TEXT NOT NULL,
        billing_interval TEXT NOT NULL DEFAULT 'monthly', -- monthly, yearly, weekly
        price REAL NOT NULL DEFAULT 0.0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );
    """)

    # Customers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        company TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # Tax rules
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tax_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rate_percentage REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
    );
    """)

    # Discount rules
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS discount_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        discount_type TEXT NOT NULL, -- 'fixed' or 'percentage'
        discount_value REAL NOT NULL,
        min_quantity INTEGER DEFAULT 1,
        min_amount REAL DEFAULT 0.0,
        start_date TEXT,
        end_date TEXT,
        usage_limit INTEGER DEFAULT 9999,
        times_used INTEGER DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1
    );
    """)

    # Subscriptions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES customers(id),
        plan_id TEXT NOT NULL REFERENCES plans(id),
        status TEXT NOT NULL DEFAULT 'Active', -- Draft, Quotation, Confirmed, Active, Closed, Paused
        start_date TEXT NOT NULL,
        expiry_date TEXT,
        next_billing_date TEXT NOT NULL,
        billing_interval TEXT NOT NULL DEFAULT 'monthly',
        payment_terms_days INTEGER NOT NULL DEFAULT 15,
        discount_id TEXT REFERENCES discount_rules(id),
        tax_id TEXT REFERENCES tax_rules(id),
        created_at TEXT NOT NULL
    );
    """)

    # Subscription Lines (base product + variants/add-ons)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subscription_lines (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        variant_name TEXT DEFAULT 'Standard',
        variant_extra_price REAL DEFAULT 0.0,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0.0
    );
    """)

    # Invoices table (Main deliverable for Person 3)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
        customer_id TEXT NOT NULL REFERENCES customers(id),
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Confirmed, Paid, Partially Paid, Overdue, Cancelled
        base_amount REAL NOT NULL DEFAULT 0.0,
        variants_amount REAL NOT NULL DEFAULT 0.0,
        discount_amount REAL NOT NULL DEFAULT 0.0,
        taxable_amount REAL NOT NULL DEFAULT 0.0,
        tax_amount REAL NOT NULL DEFAULT 0.0,
        total_amount REAL NOT NULL DEFAULT 0.0,
        amount_paid REAL NOT NULL DEFAULT 0.0,
        amount_due REAL NOT NULL DEFAULT 0.0,
        calculation_breakdown_json TEXT NOT NULL,
        idempotency_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    );
    """)

    # Invoice line items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invoice_lines (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0.0,
        variant_extra_price REAL NOT NULL DEFAULT 0.0,
        subtotal REAL NOT NULL DEFAULT 0.0
    );
    """)

    # Payments table (Main deliverable for Person 3)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL, -- Credit Card, UPI / GPay, Bank Transfer, Net Banking, Cash
        reference_no TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # Billing Runs with Proof audit table (Signature feature)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS billing_runs (
        id TEXT PRIMARY KEY,
        run_timestamp TEXT NOT NULL,
        target_date TEXT NOT NULL,
        total_examined INTEGER NOT NULL DEFAULT 0,
        invoices_generated INTEGER NOT NULL DEFAULT 0,
        subscriptions_skipped INTEGER NOT NULL DEFAULT 0,
        total_amount_invoiced REAL NOT NULL DEFAULT 0.0,
        proof_log_json TEXT NOT NULL
    );
    """)

    # Default simulated date if not set
    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('simulated_date', ?);", (today_str,))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database schema successfully initialized.")
