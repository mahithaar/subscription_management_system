import enum
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Date, DateTime, Numeric,
    ForeignKey, UniqueConstraint, CheckConstraint, JSON, Enum
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    STAFF = "staff"
    CUSTOMER = "customer"

class SubscriptionState(str, enum.Enum):
    DRAFT = "Draft"
    QUOTATION = "Quotation"
    CONFIRMED = "Confirmed"
    ACTIVE = "Active"
    CLOSED = "Closed"

class InvoiceState(str, enum.Enum):
    DRAFT = "Draft"
    CONFIRMED = "Confirmed"
    PAID = "Paid"
    CANCELLED = "Cancelled"

class BillingPeriod(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class ProductType(str, enum.Enum):
    SERVICE = "service"
    SOFTWARE = "software"
    ADD_ON = "add-on"
    PHYSICAL = "physical"

class DiscountKind(str, enum.Enum):
    FIXED = "fixed"
    PERCENT = "percent"

class DiscountScope(str, enum.Enum):
    PRODUCT = "product"
    SUBSCRIPTION = "subscription"

# ----------------- Models ----------------- #

class AppClock(Base):
    __tablename__ = "app_clock"
    id = Column(Integer, primary_key=True)
    virtual_today = Column(Date, nullable=True)  # NULL means real time
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.CUSTOMER.value, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="user", uselist=False)

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    billing_address = Column(Text, nullable=True)
    tax_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="customer")
    subscriptions = relationship("Subscription", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default=ProductType.SOFTWARE.value, nullable=False)
    sales_price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    cost_price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")

class ProductVariant(Base):
    __tablename__ = "product_variants"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    attribute = Column(String(100), nullable=False)  # e.g. "Brand"
    value = Column(String(100), nullable=False)      # e.g. "Odoo"
    extra_price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00")) # e.g. 560.00

    __table_args__ = (
        UniqueConstraint("product_id", "attribute", "value", name="uq_product_variant"),
    )

    product = relationship("Product", back_populates="variants")

class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    billing_period = Column(String(50), default=BillingPeriod.MONTHLY.value, nullable=False)
    min_quantity = Column(Integer, default=1, nullable=False)
    available_from = Column(Date, nullable=True)
    available_to = Column(Date, nullable=True)
    auto_close = Column(Boolean, default=True, nullable=False)
    closable = Column(Boolean, default=True, nullable=False)
    pausable = Column(Boolean, default=True, nullable=False)
    renewable = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    subscriptions = relationship("Subscription", back_populates="plan")

class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    validity_days = Column(Integer, default=30, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("Plan")
    lines = relationship("QuotationTemplateLine", back_populates="template", cascade="all, delete-orphan")

class QuotationTemplateLine(Base):
    __tablename__ = "quotation_template_lines"
    id = Column(Integer, primary_key=True)
    template_id = Column(Integer, ForeignKey("quotation_templates.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)

    template = relationship("QuotationTemplate", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")

class TaxRule(Base):
    __tablename__ = "tax_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. "CGST 9%" or "SGST 9%" or "IGST 18%"
    rate_percent = Column(Numeric(5, 2), nullable=False) # e.g. 9.00
    applies_to = Column(String(50), default="all", nullable=False) # "all", "product_type", "product"
    target = Column(String(100), nullable=True) # e.g. "software" if product_type
    inclusive = Column(Boolean, default=False, nullable=False) # exclusive by default
    is_active = Column(Boolean, default=True, nullable=False)

class Discount(Base):
    __tablename__ = "discounts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=True)
    kind = Column(String(20), default=DiscountKind.PERCENT.value, nullable=False) # "fixed" or "percent"
    value = Column(Numeric(12, 2), nullable=False) # fixed amount or percentage
    min_purchase = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    min_quantity = Column(Integer, default=1, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    usage_limit = Column(Integer, default=100, nullable=False)
    used_count = Column(Integer, default=0, nullable=False)
    scope = Column(String(20), default=DiscountScope.SUBSCRIPTION.value, nullable=False) # "product" or "subscription"
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint("used_count <= usage_limit", name="chk_discount_usage_limit"),
    )

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), unique=True, index=True, nullable=False) # e.g. "SUB-2026-0001"
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    start_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    payment_term_days = Column(Integer, default=15, nullable=False)
    state = Column(String(50), default=SubscriptionState.DRAFT.value, nullable=False, index=True)
    is_paused = Column(Boolean, default=False, nullable=False)
    next_invoice_date = Column(Date, nullable=True, index=True)
    discount_id = Column(Integer, ForeignKey("discounts.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="subscriptions")
    plan = relationship("Plan", back_populates="subscriptions")
    discount = relationship("Discount")
    lines = relationship("SubscriptionLine", back_populates="subscription", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="subscription")

class SubscriptionLine(Base):
    __tablename__ = "subscription_lines"
    id = Column(Integer, primary_key=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False) # Base price snapshot
    tax_ids = Column(JSON, default=list, nullable=False) # List of TaxRule IDs to apply

    subscription = relationship("Subscription", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(50), unique=True, index=True, nullable=True) # e.g. "INV-2026-0001", set at Confirm
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    state = Column(String(50), default=InvoiceState.DRAFT.value, nullable=False, index=True)
    subtotal = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    discount_total = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    tax_total = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    total = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    amount_paid = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        # THE CORE USP CONSTRAINT: A subscription cannot be billed twice for the same period!
        UniqueConstraint("subscription_id", "period_start", name="uq_subscription_period"),
    )

    subscription = relationship("Subscription", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")

class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    discount_id = Column(Integer, ForeignKey("discounts.id", ondelete="SET NULL"), nullable=True)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_snapshot = Column(JSON, default=list, nullable=False) # List of {"id": 1, "name": "CGST 9%", "rate": 9.0, "amount": 90.00}
    line_total = Column(Numeric(12, 2), nullable=False)
    explain_trace = Column(JSON, nullable=False) # Detailed calculation breakdown

    invoice = relationship("Invoice", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    method = Column(String(50), nullable=False) # "bank_transfer", "card", "cash", "upi", "cheque"
    amount = Column(Numeric(12, 2), nullable=False)
    paid_on = Column(Date, nullable=False, index=True)
    note = Column(Text, nullable=True)
    recorded_by = Column(String(100), nullable=True)
    source = Column(String(50), default="manual", nullable=False) # "manual" or "reconciliation"
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_payment_amount_positive"),
    )

    invoice = relationship("Invoice", back_populates="payments")

class BillingRun(Base):
    __tablename__ = "billing_runs"
    id = Column(Integer, primary_key=True, index=True)
    run_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    as_of_date = Column(Date, nullable=False)
    mode = Column(String(20), default="execute", nullable=False) # "preview" or "execute"
    due_count = Column(Integer, default=0, nullable=False)
    invoiced_count = Column(Integer, default=0, nullable=False)
    skipped_count = Column(Integer, default=0, nullable=False)
    duplicate_blocked_count = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    summary_json = Column(JSON, default=dict, nullable=False)

    items = relationship("BillingRunItem", back_populates="run", cascade="all, delete-orphan")

class BillingRunItem(Base):
    __tablename__ = "billing_run_items"
    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("billing_runs.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    outcome = Column(String(50), nullable=False) # "created", "skipped", "duplicate_blocked", "error"
    reason = Column(Text, nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)

    run = relationship("BillingRun", back_populates="items")
    subscription = relationship("Subscription")

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True)
    actor = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    entity = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    before_json = Column(JSON, nullable=True)
    after_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

