import unittest
from decimal import Decimal
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.all_models import (
    Customer, Product, ProductVariant, Plan, Subscription, SubscriptionLine,
    TaxRule, Discount, Invoice, Payment, SubscriptionState, InvoiceState, BillingPeriod, User
)
from app.services.billing import BillingEngine
from app.api.invoices import pay_invoice, PayInvoiceRequest
from fastapi import HTTPException

class TestPerson3BillingInvoicesFlow(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

        self.user = User(id=1, email="staff@brightloop.io", password_hash="hash", role="staff")
        self.db.add(self.user)

        self.customer = Customer(
            name="Alpha Corp",
            email="billing@alphacorp.com",
            billing_address="100 Silicon Blvd, Bangalore, KA"
        )
        self.db.add(self.customer)

        self.plan = Plan(
            name="Enterprise Cloud",
            price=Decimal("2000.00"),
            billing_period=BillingPeriod.MONTHLY.value,
            auto_close=True,
            pausable=True,
            closable=True
        )
        self.db.add(self.plan)

        self.product = Product(
            name="ERP Core License",
            type="software",
            sales_price=Decimal("2000.00")
        )
        self.db.add(self.product)
        self.db.commit()

        # Variant surcharge: +500
        self.variant = ProductVariant(
            product_id=self.product.id,
            attribute="Tier",
            value="Dedicated Cluster",
            extra_price=Decimal("500.00")
        )
        self.db.add(self.variant)

        # 18% GST (9% CGST + 9% SGST)
        self.cgst = TaxRule(name="CGST 9%", rate_percent=Decimal("9.00"))
        self.sgst = TaxRule(name="SGST 9%", rate_percent=Decimal("9.00"))
        self.db.add_all([self.cgst, self.sgst])

        # Discount: 200 Fixed
        self.discount = Discount(
            name="Early Bird Deal",
            kind="fixed",
            value=Decimal("200.00"),
            usage_limit=5
        )
        self.db.add(self.discount)
        self.db.commit()

        # Active Subscription due 2026-11-01
        self.sub = Subscription(
            number="SUB-2026-ALPHA",
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            start_date=date(2026, 11, 1),
            next_invoice_date=date(2026, 11, 1),
            state=SubscriptionState.ACTIVE.value,
            discount_id=self.discount.id,
            payment_term_days=14
        )
        self.db.add(self.sub)
        self.db.commit()

        self.sub_line = SubscriptionLine(
            subscription_id=self.sub.id,
            product_id=self.product.id,
            variant_id=self.variant.id,
            quantity=1,
            unit_price=Decimal("2000.00"),
            tax_ids=[self.cgst.id, self.sgst.id]
        )
        self.db.add(self.sub_line)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_task1_generate_invoices_from_subscription(self):
        """Task 1: Generate invoices from subscriptions and advance renewal cycle."""
        result = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        self.assertEqual(result["proof_panel"]["invoiced_count"], 1)
        self.assertEqual(len(result["invoices"]), 1)

        inv = self.db.query(Invoice).first()
        self.assertIsNotNone(inv)
        self.assertEqual(inv.subscription_id, self.sub.id)
        self.assertEqual(inv.customer_id, self.customer.id)
        self.assertEqual(inv.state, InvoiceState.CONFIRMED.value)

        # Check subscription next_invoice_date advanced by 1 month
        self.db.refresh(self.sub)
        self.assertEqual(self.sub.next_invoice_date, date(2026, 12, 1))

    def test_task2_calculate_totals_taxes_and_discounts_with_explain_trace(self):
        """
        Task 2: Calculate totals, taxes (18% GST), and discounts.
        Base: 2000
        Variant: +500 -> 2500
        Discount: -200 -> 2300 (Taxable)
        CGST 9%: 207.00
        SGST 9%: 207.00
        Total: 2714.00
        """
        result = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        inv = self.db.query(Invoice).first()

        self.assertEqual(inv.subtotal, Decimal("2500.00"))
        self.assertEqual(inv.discount_total, Decimal("200.00"))
        self.assertEqual(inv.tax_total, Decimal("414.00"))
        self.assertEqual(inv.total, Decimal("2714.00"))

        # Verify explainable audit trace
        line = inv.lines[0]
        trace = line.explain_trace
        self.assertIsNotNone(trace)
        self.assertEqual(trace["base_price"], "2000.00")
        self.assertEqual(trace["variant"]["extra_price"], "500.00")
        self.assertEqual(trace["effective_unit_price"], "2500.00")
        self.assertEqual(trace["taxable_amount"], "2300.00")
        self.assertEqual(trace["line_total"], "2714.00")

    def test_task3_record_payments_and_prevent_overpayments(self):
        """Task 3: Record payments, validate amounts, and update invoice status."""
        # First generate invoice
        BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        inv = self.db.query(Invoice).first()
        self.assertEqual(inv.state, InvoiceState.CONFIRMED.value)
        self.assertEqual(inv.amount_paid, Decimal("0.00"))

        # Overpayment should raise 400
        with self.assertRaises(HTTPException) as cm:
            pay_invoice(
                invoice_id=inv.id,
                payload=PayInvoiceRequest(method="card", amount=Decimal("3000.00")),
                db=self.db,
                user=self.user
            )
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("exceeds outstanding balance", cm.exception.detail)

        # Zero or negative payment should raise 400
        with self.assertRaises(HTTPException) as cm2:
            pay_invoice(
                invoice_id=inv.id,
                payload=PayInvoiceRequest(method="card", amount=Decimal("0.00")),
                db=self.db,
                user=self.user
            )
        self.assertEqual(cm2.exception.status_code, 400)

        # Record Partial Payment: 1000.00
        res_partial = pay_invoice(
            invoice_id=inv.id,
            payload=PayInvoiceRequest(method="card", amount=Decimal("1000.00"), note="Partial payment"),
            db=self.db,
            user=self.user
        )
        self.assertTrue(res_partial["success"])
        self.assertEqual(res_partial["amount_paid"], "1000.00")
        self.assertEqual(res_partial["amount_due"], "1714.00")

        # Record Full Remaining Payment: 1714.00
        res_full = pay_invoice(
            invoice_id=inv.id,
            payload=PayInvoiceRequest(method="UPI", amount=Decimal("1714.00"), note="Final settlement"),
            db=self.db,
            user=self.user
        )
        self.assertTrue(res_full["success"])
        self.assertEqual(res_full["invoice_state"], InvoiceState.PAID.value)
        self.assertEqual(res_full["amount_paid"], "2714.00")
        self.assertEqual(res_full["amount_due"], "0.00")

        # Verify Payment records created in audit log
        payments = self.db.query(Payment).filter(Payment.invoice_id == inv.id).all()
        self.assertEqual(len(payments), 2)
        self.assertEqual(payments[0].amount, Decimal("1000.00"))
        self.assertEqual(payments[1].amount, Decimal("1714.00"))

    def test_task4_prevent_duplicate_invoices_idempotency_shield(self):
        """
        Task 4: Prevent duplicate invoices.
        Re-running billing run on the same period must block duplicate generation.
        """
        # Run 1: Generates 1 invoice
        run1 = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        self.assertEqual(run1["proof_panel"]["invoiced_count"], 1)
        self.assertEqual(run1["proof_panel"]["duplicate_blocked_count"], 0)

        # Simulate attempting to run again for the same period
        self.sub.next_invoice_date = date(2026, 11, 1)
        self.db.commit()

        # Run 2: Blocks duplicate invoice
        run2 = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        self.assertEqual(run2["proof_panel"]["invoiced_count"], 0)
        self.assertEqual(run2["proof_panel"]["duplicate_blocked_count"], 1)
        self.assertTrue(run2["proof_panel"]["is_balanced"])
        self.assertIn("already exists", run2["items"][0]["reason"])

        # Check DB only has 1 invoice total
        total_invoices = self.db.query(Invoice).count()
        self.assertEqual(total_invoices, 1)

    def test_task5_preview_mode_does_not_mutate_database(self):
        """
        Task 5: Implement billing preview and execute actions.
        Preview mode returns exact calculation without committing changes to DB.
        """
        # Run Preview
        preview = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="preview")
        self.assertEqual(preview["mode"], "preview")
        self.assertEqual(preview["proof_panel"]["due_count"], 1)
        self.assertEqual(preview["proof_panel"]["invoiced_count"], 1)
        self.assertTrue(preview["proof_panel"]["is_balanced"])

        # Check DB has 0 invoices
        inv_count = self.db.query(Invoice).count()
        self.assertEqual(inv_count, 0)

        # Check Subscription next_invoice_date was NOT advanced
        self.db.refresh(self.sub)
        self.assertEqual(self.sub.next_invoice_date, date(2026, 11, 1))

        # Check Discount usage_count was NOT incremented
        self.db.refresh(self.discount)
        self.assertEqual(self.discount.used_count, 0)

    def test_paused_subscription_skipped_in_billing_run(self):
        """Paused subscriptions must be skipped with explicit reason."""
        self.sub.is_paused = True
        self.db.commit()

        run = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        self.assertEqual(run["proof_panel"]["invoiced_count"], 0)
        self.assertEqual(run["proof_panel"]["skipped_count"], 1)
        self.assertIn("paused", run["items"][0]["reason"].lower())

if __name__ == "__main__":
    unittest.main()
