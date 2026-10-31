from decimal import Decimal
from datetime import date, timedelta
from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.all_models import (
    User, Customer, Product, ProductVariant, Plan, TaxRule, Discount,
    Subscription, SubscriptionLine, Invoice, InvoiceLine, Payment,
    UserRole, SubscriptionState, InvoiceState, BillingPeriod, ProductType, AppClock
)
from app.services.pricing import PricingEngine, quantize_money

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Reset or verify AppClock
        clock = db.query(AppClock).filter(AppClock.id == 1).first()
        if not clock:
            clock = AppClock(id=1, virtual_today=None)
            db.add(clock)
            db.commit()

        # 1. Seed Users if not present
        admin = db.query(User).filter(User.email == "admin@brightloop.io").first()
        if not admin:
            admin = User(
                email="admin@brightloop.io",
                password_hash=hash_password("Password123!"),
                role=UserRole.ADMIN.value
            )
            staff = User(
                email="staff@brightloop.io",
                password_hash=hash_password("Password123!"),
                role=UserRole.STAFF.value
            )
            customer_user = User(
                email="client@acmecorp.com",
                password_hash=hash_password("Password123!"),
                role=UserRole.CUSTOMER.value
            )
            db.add_all([admin, staff, customer_user])
            db.commit()
            db.refresh(customer_user)

            # Create Customer record linked to customer_user
            acme_cust = Customer(
                user_id=customer_user.id,
                name="Acme Corporation",
                email="client@acmecorp.com",
                phone="+91 98765 43210",
                billing_address="Tower A, Tech Park, Bangalore, KA 560100",
                tax_id="GSTIN29AAACA1234A1Z5"
            )
            nexus_cust = Customer(
                name="Nexus Technologies",
                email="finance@nexustech.io",
                phone="+91 98765 11223",
                billing_address="Cyber City, Hyderabad, TS 500081",
                tax_id="GSTIN36AABCN5678B1Z2"
            )
            zenith_cust = Customer(
                name="Zenith Labs",
                email="ops@zenithlabs.org",
                phone="+91 91234 56789",
                billing_address="Indiranagar, Bangalore, KA 560038"
            )
            db.add_all([acme_cust, nexus_cust, zenith_cust])
            db.commit()

        # 2. Seed Tax Rules
        if db.query(TaxRule).count() == 0:
            cgst = TaxRule(name="CGST 9%", rate_percent=Decimal("9.00"), applies_to="all")
            sgst = TaxRule(name="SGST 9%", rate_percent=Decimal("9.00"), applies_to="all")
            igst = TaxRule(name="IGST 18%", rate_percent=Decimal("18.00"), applies_to="all")
            db.add_all([cgst, sgst, igst])
            db.commit()

        # 3. Seed Products & Variants
        if db.query(Product).count() == 0:
            prod1 = Product(
                name="Brightloop ERP Core",
                type=ProductType.SOFTWARE.value,
                sales_price=Decimal("1000.00"),
                cost_price=Decimal("200.00"),
                notes="Standard SaaS license per seat"
            )
            prod2 = Product(
                name="Dedicated High-Speed Database",
                type=ProductType.ADD_ON.value,
                sales_price=Decimal("500.00"),
                cost_price=Decimal("100.00")
            )
            prod3 = Product(
                name="24/7 Premium Enterprise SLA",
                type=ProductType.SERVICE.value,
                sales_price=Decimal("800.00"),
                cost_price=Decimal("150.00")
            )
            db.add_all([prod1, prod2, prod3])
            db.commit()
            db.refresh(prod1)

            # SPEC REQUIREMENT: Brand variant e.g. Odoo brand adds 560
            var_odoo = ProductVariant(
                product_id=prod1.id,
                attribute="Brand",
                value="Odoo",
                extra_price=Decimal("560.00")
            )
            var_brightloop = ProductVariant(
                product_id=prod1.id,
                attribute="Brand",
                value="Standard",
                extra_price=Decimal("0.00")
            )
            db.add_all([var_odoo, var_brightloop])
            db.commit()

        # 4. Seed Plans
        if db.query(Plan).count() == 0:
            plan_monthly = Plan(
                name="Cloud Monthly Professional",
                price=Decimal("1000.00"),
                billing_period=BillingPeriod.MONTHLY.value,
                min_quantity=1,
                auto_close=True,
                closable=True,
                pausable=True,
                renewable=True
            )
            plan_yearly = Plan(
                name="Enterprise Annual Tier",
                price=Decimal("10000.00"),
                billing_period=BillingPeriod.YEARLY.value,
                min_quantity=1,
                auto_close=True,
                closable=True,
                pausable=True,
                renewable=True
            )
            db.add_all([plan_monthly, plan_yearly])
            db.commit()

        # 5. Seed Discounts
        if db.query(Discount).count() == 0:
            disc1 = Discount(
                name="Early Bird ₹100 Off",
                code="EARLY100",
                kind="fixed",
                value=Decimal("100.00"),
                min_purchase=Decimal("1000.00"),
                min_quantity=1,
                usage_limit=5,
                used_count=0
            )
            disc_expired = Discount(
                name="Flash Deal Expired",
                code="FLASH50",
                kind="percent",
                value=Decimal("20.00"),
                end_date=date.today() - timedelta(days=2),
                usage_limit=10,
                used_count=0
            )
            db.add_all([disc1, disc_expired])
            db.commit()

        # 6. Seed Subscriptions
        if db.query(Subscription).count() == 0:
            acme = db.query(Customer).filter(Customer.email == "client@acmecorp.com").first()
            nexus = db.query(Customer).filter(Customer.email == "finance@nexustech.io").first()
            plan_m = db.query(Plan).filter(Plan.name == "Cloud Monthly Professional").first()
            prod = db.query(Product).filter(Product.name == "Brightloop ERP Core").first()
            var_od = db.query(ProductVariant).filter(ProductVariant.value == "Odoo").first()
            cgst_r = db.query(TaxRule).filter(TaxRule.name == "CGST 9%").first()
            sgst_r = db.query(TaxRule).filter(TaxRule.name == "SGST 9%").first()
            disc = db.query(Discount).filter(Discount.code == "EARLY100").first()

            # Subscription 1: Due today, with Odoo variant and Early Bird discount (Ready for live demo run!)
            sub1 = Subscription(
                number="SUB-2026-0001",
                customer_id=acme.id,
                plan_id=plan_m.id,
                start_date=date.today(),
                next_invoice_date=date.today(),
                state=SubscriptionState.ACTIVE.value,
                discount_id=disc.id
            )
            db.add(sub1)
            db.commit()

            sub1_line = SubscriptionLine(
                subscription_id=sub1.id,
                product_id=prod.id,
                variant_id=var_od.id,
                quantity=1,
                unit_price=prod.sales_price,
                tax_ids=[cgst_r.id, sgst_r.id]
            )
            db.add(sub1_line)

            # Subscription 2: Nexus Tech active
            sub2 = Subscription(
                number="SUB-2026-0002",
                customer_id=nexus.id,
                plan_id=plan_m.id,
                start_date=date.today(),
                next_invoice_date=date.today(),
                state=SubscriptionState.ACTIVE.value
            )
            db.add(sub2)
            db.commit()

            sub2_line = SubscriptionLine(
                subscription_id=sub2.id,
                product_id=prod.id,
                quantity=2,
                unit_price=prod.sales_price,
                tax_ids=[cgst_r.id, sgst_r.id]
            )
            db.add(sub2_line)
            db.commit()
    finally:
        db.close()

    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
