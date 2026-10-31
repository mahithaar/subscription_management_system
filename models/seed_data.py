"""
Seed data generator for RecurOS / Brightloop Software Subscription Management.
Provides demo data tailored for the hackathon presentation.
"""
from datetime import datetime, timedelta
from .database import get_connection, init_db

def seed_demo_data(db_path=None, simulated_date_str="2026-10-31"):
    """Populates the database with realistic products, plans, customers, rules, and subscriptions."""
    init_db(db_path)
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Clear existing data for clean demo state
    tables = [
        "payments", "invoice_lines", "invoices", "subscription_lines",
        "subscriptions", "discount_rules", "tax_rules", "customers",
        "plans", "products", "billing_runs"
    ]
    for table in tables:
        cursor.execute(f"DELETE FROM {table};")

    # Set simulated date
    cursor.execute("UPDATE system_settings SET value = ? WHERE key = 'simulated_date';", (simulated_date_str,))

    # 1. Products
    products = [
        ("PROD-001", "Brightloop Software Pro", "software", 1000.0, 300.0, "Flagship SaaS platform license for business operations", simulated_date_str),
        ("PROD-002", "Brightloop ERP Enterprise", "software", 10000.0, 2500.0, "Annual enterprise ERP with priority support and unlimited workflows", simulated_date_str),
        ("PROD-003", "Odoo Brand Integration", "add_on", 560.0, 100.0, "Official Odoo ERP synchronization engine and brand bridge", simulated_date_str),
        ("PROD-004", "Additional Team Seat", "add_on", 250.0, 50.0, "Per-seat license for collaboration and staff access", simulated_date_str),
        ("PROD-005", "Starter Business Suite", "software", 500.0, 150.0, "Lightweight edition for small shops and freelancers", simulated_date_str),
    ]
    cursor.executemany(
        "INSERT INTO products (id, name, type, sales_price, cost_price, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
        products
    )

    # 2. Plans
    plans = [
        ("PLAN-PRO-M", "PROD-001", "Software Pro Monthly", "monthly", 1000.0, 1, simulated_date_str),
        ("PLAN-ENT-Y", "PROD-002", "Software Enterprise Yearly", "yearly", 10000.0, 1, simulated_date_str),
        ("PLAN-START-M", "PROD-005", "Starter Monthly", "monthly", 500.0, 1, simulated_date_str),
    ]
    cursor.executemany(
        "INSERT INTO plans (id, product_id, name, billing_interval, price, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
        plans
    )

    # 3. Tax Rules
    tax_rules = [
        ("TAX-GST-18", "GST 18% (Standard Software Tax)", 18.0, 1),
        ("TAX-ZERO", "Zero Tax / Export (0%)", 0.0, 1),
    ]
    cursor.executemany(
        "INSERT INTO tax_rules (id, name, rate_percentage, is_active) VALUES (?, ?, ?, ?);",
        tax_rules
    )

    # 4. Discount Rules
    discount_rules = [
        ("DISC-WELCOME", "Early Adopter Flat Discount", "fixed", 100.0, 1, 500.0, "2026-01-01", "2026-12-31", 100, 4, 1),
        ("DISC-VOL-10", "Volume Seats 10% Off", "percentage", 10.0, 3, 1000.0, "2026-01-01", "2026-12-31", 50, 1, 1),
    ]
    cursor.executemany(
        "INSERT INTO discount_rules (id, name, discount_type, discount_value, min_quantity, min_amount, start_date, end_date, usage_limit, times_used, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        discount_rules
    )

    # 5. Customers
    customers = [
        ("CUST-001", "Mahi Solutions", "mahi@brightloop.io", "+91 98765 43210", "Brightloop Partner Network", simulated_date_str),
        ("CUST-002", "Acme Industrial Corp", "billing@acme.com", "+91 98450 11223", "Acme Group", simulated_date_str),
        ("CUST-003", "Nexus Digital Labs", "accounts@nexuslabs.co", "+91 91234 56789", "Nexus Ventures", simulated_date_str),
        ("CUST-004", "Zen Retail Outlets", "owner@zenretail.in", "+91 90001 22334", "Zen Retailers", simulated_date_str),
        ("CUST-005", "Skylark Media Works", "finance@skylark.com", "+91 97766 55443", "Skylark Studio", simulated_date_str),
    ]
    cursor.executemany(
        "INSERT INTO customers (id, name, email, phone, company, created_at) VALUES (?, ?, ?, ?, ?, ?);",
        customers
    )

    # 6. Subscriptions
    # SUB-001: Mahi Solutions - Software Pro Monthly (₹1000) + Odoo Variant (+₹560) - ₹100 discount + 18% tax -> ₹1,722.80. DUE TODAY!
    # SUB-002: Acme Corp - Software Enterprise Yearly (₹10000) + 18% tax -> ₹11,800.00. DUE TODAY!
    # SUB-003: Nexus Labs - Software Pro Monthly (₹1000) + 4 extra seats @ ₹250 (₹1000) - 10% disc (-₹200) + 18% tax. DUE TODAY!
    # SUB-004: Zen Retail - In 'Draft' status (Shows skipping inactive).
    # SUB-005: Skylark Media - Active, but next billing date is in the FUTURE (Shows skipping non-due).
    future_date = (datetime.strptime(simulated_date_str, "%Y-%m-%d") + timedelta(days=20)).strftime("%Y-%m-%d")
    subscriptions = [
        ("SUB-2026-001", "CUST-001", "PLAN-PRO-M", "Active", "2026-10-01", "2027-10-01", simulated_date_str, "monthly", 15, "DISC-WELCOME", "TAX-GST-18", simulated_date_str),
        ("SUB-2026-002", "CUST-002", "PLAN-ENT-Y", "Active", "2026-10-01", "2027-10-01", simulated_date_str, "yearly", 30, None, "TAX-GST-18", simulated_date_str),
        ("SUB-2026-003", "CUST-003", "PLAN-PRO-M", "Active", "2026-10-01", "2027-10-01", simulated_date_str, "monthly", 15, "DISC-VOL-10", "TAX-GST-18", simulated_date_str),
        ("SUB-2026-004", "CUST-004", "PLAN-PRO-M", "Draft", "2026-10-15", "2027-10-15", simulated_date_str, "monthly", 15, None, "TAX-GST-18", simulated_date_str),
        ("SUB-2026-005", "CUST-005", "PLAN-START-M", "Active", "2026-10-20", "2027-10-20", future_date, "monthly", 15, None, "TAX-GST-18", simulated_date_str),
    ]
    cursor.executemany(
        """INSERT INTO subscriptions 
        (id, customer_id, plan_id, status, start_date, expiry_date, next_billing_date, billing_interval, payment_terms_days, discount_id, tax_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""",
        subscriptions
    )

    # 7. Subscription Lines
    # SUB-001 has base software (qty 1) + Odoo brand variant (+560)
    # SUB-002 has ERP software (qty 1)
    # SUB-003 has base software (qty 1) + 4 extra team seats (qty 4 @ 250)
    # SUB-004 has base software
    # SUB-005 has starter software
    sub_lines = [
        ("LINE-001", "SUB-2026-001", "PROD-001", "Odoo Brand Edition", 560.0, 1, 1000.0),
        ("LINE-002", "SUB-2026-002", "PROD-002", "Standard Enterprise", 0.0, 1, 10000.0),
        ("LINE-003", "SUB-2026-003", "PROD-001", "Standard Pro", 0.0, 1, 1000.0),
        ("LINE-004", "SUB-2026-003", "PROD-004", "Team Access Seat", 0.0, 4, 250.0),
        ("LINE-005", "SUB-2026-004", "PROD-001", "Standard Pro", 0.0, 1, 1000.0),
        ("LINE-006", "SUB-2026-005", "PROD-005", "Standard Starter", 0.0, 1, 500.0),
    ]
    cursor.executemany(
        """INSERT INTO subscription_lines 
        (id, subscription_id, product_id, variant_name, variant_extra_price, quantity, unit_price)
        VALUES (?, ?, ?, ?, ?, ?, ?);""",
        sub_lines
    )

    conn.commit()
    conn.close()
    print("Seed data loaded successfully!")

if __name__ == "__main__":
    seed_demo_data()
