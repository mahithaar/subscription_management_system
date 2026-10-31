import unittest
from decimal import Decimal
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.security import validate_password_complexity, hash_password, verify_password
from app.models.all_models import (
    User, Customer, Product, ProductVariant, Plan, TaxRule, Discount,
    Subscription, SubscriptionLine, Invoice, Payment,
    UserRole, SubscriptionState, InvoiceState, BillingPeriod
)
from app.services.pricing import PricingEngine
from app.services.billing import BillingEngine
from app.services.clock import ClockService
from app.api.auth import SignupRequest, signup, LoginRequest, login
from app.api.catalog import ProductCreate, ProductVariantCreate, create_product, list_products
from app.api.reconciliation import ParseCsvRequest, parse_and_match_csv, ConfirmMatchRequest, confirm_reconciliation_match
from app.api.dashboard import get_dashboard_metrics

class TestCompleteBackendFlow(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_password_policy_boundary_8_vs_9_chars(self):
        """
        Blueprint rule S1 & G1: 'More than 8 characters', >=1 upper, >=1 lower, >=1 special.
        8 characters must fail. 9 characters must succeed.
        """
        # 8 chars (has upper, lower, special, number): 'Pass12!a' (len 8)
        valid_8, msg_8 = validate_password_complexity("Pass12!a")
        self.assertFalse(valid_8)
        self.assertIn("more than 8 characters", msg_8.lower())

        # 9 chars: 'Pass123!a' (len 9)
        valid_9, msg_9 = validate_password_complexity("Pass123!a")
        self.assertTrue(valid_9)

        # Missing uppercase
        v_no_upper, m_no_upper = validate_password_complexity("pass1234!a")
        self.assertFalse(v_no_upper)

        # Missing special
        v_no_special, m_no_special = validate_password_complexity("Password123")
        self.assertFalse(v_no_special)

    def test_auth_signup_and_login(self):
        # 1. Signup
        signup_payload = SignupRequest(
            name="Alice Smith",
            email="alice@brightloop.io",
            password="SecurePassword2026!"
        )
        signup_res = signup(signup_payload, self.db)
        self.assertIn("access_token", signup_res)
        self.assertEqual(signup_res["user"]["email"], "alice@brightloop.io")

        # 2. Login
        login_payload = LoginRequest(
            email="alice@brightloop.io",
            password="SecurePassword2026!"
        )
        login_res = login(login_payload, self.db)
        self.assertIn("access_token", login_res)
        self.assertEqual(login_res["user"]["role"], "customer")

    def test_end_to_end_billing_proof_and_reconciliation(self):
        """
        Tests the entire pitch narrative in code:
        1. Create product + Brand=Odoo variant (+560).
        2. Create taxes and discount.
        3. Create active subscription.
        4. Run Billing -> Invoice created (Total = 1722.80).
        5. Run Billing AGAIN -> 0 created, 1 duplicate blocked by idempotency constraint.
        6. Advance Time Machine.
        7. Reconcile Bank CSV -> Auto-match invoice -> Confirm -> Invoices flips to Paid!
        8. Verify Dashboard metrics and MRR.
        """
        # 1. Products & Variants
        admin_user = User(id=1, email="admin@brightloop.io", password_hash="x", role="admin")
        self.db.add(admin_user)
        self.db.commit()

        p_create = ProductCreate(
            name="Brightloop ERP Core",
            type="software",
            sales_price=Decimal("1000.00"),
            variants=[ProductVariantCreate(attribute="Brand", value="Odoo", extra_price=Decimal("560.00"))]
        )
        create_product(p_create, self.db, admin=admin_user)
        prod = self.db.query(Product).first()
        var = prod.variants[0]
        self.assertEqual(var.extra_price, Decimal("560.00"))

        # 2. Customer, Plan, Taxes, Discounts
        cust = Customer(name="Acme Corp", email="acme@corp.com")
        self.db.add(cust)
        plan = Plan(name="Monthly Pro", price=Decimal("1000.00"), billing_period=BillingPeriod.MONTHLY.value)
        self.db.add(plan)
        cgst = TaxRule(name="CGST 9%", rate_percent=Decimal("9.00"))
        sgst = TaxRule(name="SGST 9%", rate_percent=Decimal("9.00"))
        self.db.add_all([cgst, sgst])
        disc = Discount(name="Early Bird", kind="fixed", value=Decimal("100.00"), usage_limit=5)
        self.db.add(disc)
        self.db.commit()

        # 3. Active Subscription
        today = date(2026, 11, 1)
        sub = Subscription(
            number="SUB-2026-0001",
            customer_id=cust.id,
            plan_id=plan.id,
            start_date=today,
            next_invoice_date=today,
            state=SubscriptionState.ACTIVE.value,
            discount_id=disc.id
        )
        self.db.add(sub)
        self.db.commit()

        sub_line = SubscriptionLine(
            subscription_id=sub.id,
            product_id=prod.id,
            variant_id=var.id,
            quantity=1,
            unit_price=prod.sales_price,
            tax_ids=[cgst.id, sgst.id]
        )
        self.db.add(sub_line)
        self.db.commit()

        # 4. Billing Run (Execute)
        run1 = BillingEngine.run_billing(self.db, as_of_date=today, mode="execute")
        self.assertEqual(run1["proof_panel"]["invoiced_count"], 1)
        self.assertEqual(run1["invoices"][0]["total"], "1722.80")

        # 5. Billing Run AGAIN for same date -> IDEMPOTENCY GUARD
        # Reset sub.next_invoice_date to simulate race condition or re-run
        sub.next_invoice_date = today
        self.db.commit()

        run2 = BillingEngine.run_billing(self.db, as_of_date=today, mode="execute")
        self.assertEqual(run2["proof_panel"]["invoiced_count"], 0)
        self.assertEqual(run2["proof_panel"]["duplicate_blocked_count"], 1)
        self.assertTrue(run2["proof_panel"]["is_balanced"])

        # 6. CSV Reconciliation
        created_inv = self.db.query(Invoice).first()
        csv_sample = f"""Date,Description,Reference,Amount\n2026-11-01,NEFT Inward Acme Corp,{created_inv.number},1722.80\n"""
        reconcile_res = parse_and_match_csv(ParseCsvRequest(csv_content=csv_sample), self.db, user=admin_user)
        self.assertEqual(reconcile_res["matched_count"], 1)
        match_item = reconcile_res["suggested_matches"][0]
        self.assertEqual(match_item["confidence"], "HIGH")
        self.assertEqual(match_item["matched_invoice_id"], created_inv.id)

        # 7. Confirm Match -> Flips Invoice to PAID
        confirm_match_res = confirm_reconciliation_match(
            ConfirmMatchRequest(
                invoice_id=created_inv.id,
                amount=Decimal("1722.80"),
                paid_on=today,
                reference="NEFT-ACME-123"
            ),
            self.db,
            user=admin_user
        )
        self.assertEqual(confirm_match_res["invoice_state"], "Paid")
        self.assertEqual(confirm_match_res["amount_due"], "0.00")

        # 8. Finance Dashboard Metrics & MRR
        metrics = get_dashboard_metrics(self.db, user=admin_user)
        self.assertEqual(metrics["kpis"]["active_subscriptions"], 1)
        self.assertEqual(metrics["kpis"]["billed_revenue"], "1722.80")
        self.assertEqual(metrics["kpis"]["collected_revenue"], "1722.80")
        self.assertEqual(metrics["kpis"]["outstanding_revenue"], "0.00")
        self.assertLess(metrics["performance"]["query_time_ms"], 2000)

if __name__ == "__main__":
    unittest.main()
