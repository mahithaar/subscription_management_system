"""
Automated Unit and Integration Tests for Person 3 Deliverables (Billing & Invoices).
Tests calculations, explainable breakdown, duplicate prevention, idempotency, and payment flows.
"""
import unittest
import os
import tempfile
import json
import gc
from datetime import datetime
from models.database import init_db, get_connection
from models.seed_data import seed_demo_data
from billing.billing_engine import (
    calculate_subscription_breakdown,
    preview_billing_run,
    execute_billing_run,
    get_simulated_date,
    set_simulated_date
)
from billing.payment_service import (
    record_invoice_payment,
    get_invoice_details,
    get_invoices
)

class TestBillingAndInvoicing(unittest.TestCase):
    def setUp(self):
        # Create an isolated temporary SQLite database for tests
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        os.close(self.temp_db_fd)
        init_db(self.temp_db_path)
        seed_demo_data(self.temp_db_path, simulated_date_str="2026-10-31")

    def tearDown(self):
        gc.collect()
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

    def test_explainable_invoice_calculation(self):
        """
        Tests the exact challenge calculation:
        Base price:    ₹1,000.00
        Extra feature: ₹560.00
        Discount:     -₹100.00
        Tax (18%):    +₹262.80
        Total:        ₹1,722.80
        """
        sub = {"id": "SUB-TEST-1"}
        lines = [
            {"product_id": "PROD-1", "product_name": "Software Pro", "variant_name": "Odoo Brand Edition", "quantity": 1, "unit_price": 1000.0, "variant_extra_price": 560.0}
        ]
        discount_rule = {"id": "D1", "name": "Early Adopter Flat", "discount_type": "fixed", "discount_value": 100.0, "min_quantity": 1, "min_amount": 0.0, "is_active": 1}
        tax_rule = {"id": "T1", "name": "GST 18%", "rate_percentage": 18.0, "is_active": 1}

        breakdown = calculate_subscription_breakdown(sub, lines, discount_rule, tax_rule)

        self.assertEqual(breakdown["base_price"], 1000.0)
        self.assertEqual(breakdown["variants_price"], 560.0)
        self.assertEqual(breakdown["gross_subtotal"], 1560.0)
        self.assertEqual(breakdown["discount_amount"], 100.0)
        self.assertEqual(breakdown["taxable_amount"], 1460.0)
        self.assertEqual(breakdown["tax_amount"], 262.80)
        self.assertEqual(breakdown["total_amount"], 1722.80)

    def test_billing_run_first_pass_generates_and_skips_appropriately(self):
        """
        First billing run should generate invoices for due active subscriptions (SUB-001, SUB-002, SUB-003)
        and skip inactive (SUB-004) or future (SUB-005) subscriptions.
        """
        result = execute_billing_run(target_date="2026-10-31", db_path=self.temp_db_path)

        self.assertEqual(result["total_examined"], 5)
        self.assertEqual(result["invoices_generated"], 3)
        self.assertEqual(result["subscriptions_skipped"], 2)

        # Check proof logs
        proof_map = {item["subscription_id"]: item for item in result["proof_logs"]}
        self.assertEqual(proof_map["SUB-2026-001"]["action"], "GENERATED")
        self.assertEqual(proof_map["SUB-2026-002"]["action"], "GENERATED")
        self.assertEqual(proof_map["SUB-2026-003"]["action"], "GENERATED")
        self.assertEqual(proof_map["SUB-2026-004"]["action"], "SKIPPED")
        self.assertIn("Draft", proof_map["SUB-2026-004"]["reason"])
        self.assertEqual(proof_map["SUB-2026-005"]["action"], "SKIPPED")
        self.assertIn("future", proof_map["SUB-2026-005"]["reason"])

    def test_duplicate_prevention_on_second_run_the_wow_moment(self):
        """
        Clicking 'Run Billing' a second time MUST generate 0 invoices and block all duplicates!
        """
        # Run 1: Generates 3 invoices
        run1 = execute_billing_run(target_date="2026-10-31", db_path=self.temp_db_path)
        self.assertEqual(run1["invoices_generated"], 3)

        # Run 2: Same date -> MUST generate 0 invoices, 100% duplicate protection
        run2 = execute_billing_run(target_date="2026-10-31", db_path=self.temp_db_path)
        self.assertEqual(run2["invoices_generated"], 0)
        self.assertEqual(run2["subscriptions_skipped"], 5)

        # Confirm reasons in proof log
        proof_map = {item["subscription_id"]: item for item in run2["proof_logs"]}
        self.assertIn("Duplicate", proof_map["SUB-2026-001"]["reason"])
        self.assertEqual(proof_map["SUB-2026-001"]["action"], "SKIPPED")

    def test_payment_recording_partial_and_full(self):
        """
        Tests payment recording, balance reduction, and status transitions:
        Confirmed -> Partially Paid -> Paid
        """
        # Generate an invoice first
        run = execute_billing_run(target_date="2026-10-31", db_path=self.temp_db_path)
        invoices = get_invoices(db_path=self.temp_db_path)
        
        # Find invoice for SUB-2026-001 (which has ₹1,722.80)
        inv = next(i for i in invoices if i["subscription_id"] == "SUB-2026-001")
        total = inv["total_amount"]
        self.assertEqual(total, 1722.80)
        inv_id = inv["id"]

        # 1. Record Partial Payment (₹722.80)
        ok, pay1, msg = record_invoice_payment(
            invoice_id=inv_id,
            amount=722.80,
            payment_method="UPI / GPay",
            reference_no="UPI-REF-001",
            notes="First tranche",
            db_path=self.temp_db_path
        )
        self.assertTrue(ok)
        self.assertEqual(pay1["new_status"], "Partially Paid")
        self.assertEqual(pay1["new_amount_paid"], 722.80)
        self.assertEqual(pay1["new_amount_due"], 1000.0)

        # 2. Record Final Payment (₹1000.00)
        ok, pay2, msg = record_invoice_payment(
            invoice_id=inv_id,
            amount=1000.0,
            payment_method="Bank Transfer",
            reference_no="NEFT-REF-002",
            notes="Final settlement",
            db_path=self.temp_db_path
        )
        self.assertTrue(ok)
        self.assertEqual(pay2["new_status"], "Paid")
        self.assertEqual(pay2["new_amount_due"], 0.0)

        # 3. Test Overpayment rejection
        ok, pay3, msg = record_invoice_payment(
            invoice_id=inv_id,
            amount=50.0,
            payment_method="Cash",
            db_path=self.temp_db_path
        )
        self.assertFalse(ok)
        self.assertIn("already fully paid", msg)

    def test_time_machine_advancement_recurring_cycle(self):
        """
        Tests Time Machine: advancing time by 1 month triggers the next recurring billing cycle.
        """
        # Cycle 1: Oct 31 -> Invoices generated
        run1 = execute_billing_run(target_date="2026-10-31", db_path=self.temp_db_path)
        self.assertEqual(run1["invoices_generated"], 3)

        # Fast forward simulated date to Nov 30 (Next month)
        conn = get_connection(self.temp_db_path)
        set_simulated_date("2026-11-30", conn=conn)
        conn.close()

        # Preview should now show monthly subscriptions due for next cycle!
        preview = preview_billing_run(target_date="2026-11-30", db_path=self.temp_db_path)
        self.assertGreaterEqual(preview["will_generate"], 2)

if __name__ == "__main__":
    unittest.main()
