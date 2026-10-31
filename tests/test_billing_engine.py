import unittest
from decimal import Decimal
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.all_models import (
    Customer, Product, ProductVariant, Plan, Subscription, SubscriptionLine,
    TaxRule, Discount, SubscriptionState, BillingPeriod
)
from app.services.billing import BillingEngine

class TestBillingEngine(unittest.TestCase):
    def setUp(self):
        # In-memory SQLite for testing
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

        # Seed minimal baseline
        self.customer = Customer(name="Brightloop Client", email="client@brightloop.io")
        self.db.add(self.customer)

        self.plan = Plan(
            name="Cloud ERP Monthly",
            price=Decimal("1000.00"),
            billing_period=BillingPeriod.MONTHLY.value,
            auto_close=True,
            pausable=True,
            closable=True
        )
        self.db.add(self.plan)

        self.product = Product(
            name="Base Cloud License",
            type="software",
            sales_price=Decimal("1000.00")
        )
        self.db.add(self.product)
        self.db.commit()

        self.variant = ProductVariant(
            product_id=self.product.id,
            attribute="Brand",
            value="Odoo",
            extra_price=Decimal("560.00")
        )
        self.db.add(self.variant)

        self.tax1 = TaxRule(name="CGST 9%", rate_percent=Decimal("9.00"))
        self.tax2 = TaxRule(name="SGST 9%", rate_percent=Decimal("9.00"))
        self.db.add_all([self.tax1, self.tax2])

        self.discount = Discount(
            name="Startup Offer",
            kind="fixed",
            value=Decimal("100.00"),
            usage_limit=10
        )
        self.db.add(self.discount)
        self.db.commit()

        # Create active subscription due on 2026-11-01
        self.subscription = Subscription(
            number="SUB-2026-0001",
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            start_date=date(2026, 11, 1),
            next_invoice_date=date(2026, 11, 1),
            state=SubscriptionState.ACTIVE.value,
            discount_id=self.discount.id
        )
        self.db.add(self.subscription)
        self.db.commit()

        self.sub_line = SubscriptionLine(
            subscription_id=self.subscription.id,
            product_id=self.product.id,
            variant_id=self.variant.id,
            quantity=1,
            unit_price=Decimal("1000.00"),
            tax_ids=[self.tax1.id, self.tax2.id]
        )
        self.db.add(self.sub_line)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_preview_mode_does_not_mutate_db(self):
        result = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="preview")
        self.assertEqual(result["proof_panel"]["due_count"], 1)
        self.assertEqual(result["proof_panel"]["invoiced_count"], 1)
        self.assertTrue(result["proof_panel"]["is_balanced"])

        # Check DB: next_invoice_date still 2026-11-01
        self.db.refresh(self.subscription)
        self.assertEqual(self.subscription.next_invoice_date, date(2026, 11, 1))

    def test_execute_creates_invoice_and_subsequent_run_blocks_duplicates(self):
        """
        THE HACKATHON WOW MOMENT:
        Run 1: Creates invoice INV-2026-0001
        Run 2: Returns 0 created, 1 duplicate blocked by idempotency constraint!
        """
        # Run 1: Execute
        run1 = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        self.assertEqual(run1["proof_panel"]["invoiced_count"], 1)
        self.assertEqual(run1["proof_panel"]["duplicate_blocked_count"], 0)
        self.assertEqual(len(run1["invoices"]), 1)
        self.assertEqual(run1["invoices"][0]["total"], "1722.80")

        # Verify discount used_count incremented
        self.db.refresh(self.discount)
        self.assertEqual(self.discount.used_count, 1)

        # Manually reset subscription.next_invoice_date back to 2026-11-01 to simulate duplicate run attempt
        self.subscription.next_invoice_date = date(2026, 11, 1)
        self.db.commit()

        # Run 2: Re-run for the same period
        run2 = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        self.assertEqual(run2["proof_panel"]["invoiced_count"], 0)
        self.assertEqual(run2["proof_panel"]["duplicate_blocked_count"], 1)
        self.assertTrue(run2["proof_panel"]["is_balanced"])
        self.assertIn("already exists", run2["items"][0]["reason"])

    def test_paused_subscription_is_skipped(self):
        self.subscription.is_paused = True
        self.db.commit()

        run = BillingEngine.run_billing(self.db, as_of_date=date(2026, 11, 1), mode="execute")
        self.assertEqual(run["proof_panel"]["invoiced_count"], 0)
        self.assertEqual(run["proof_panel"]["skipped_count"], 1)
        self.assertIn("paused", run["items"][0]["reason"])

if __name__ == "__main__":
    unittest.main()

