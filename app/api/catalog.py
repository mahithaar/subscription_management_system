from typing import List, Optional
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import (
    Product, ProductVariant, Plan, TaxRule, Discount, Customer,
    BillingPeriod, ProductType, DiscountKind, DiscountScope
)
from app.api.deps import require_admin, require_staff_or_admin, get_current_user
from app.services.pricing import quantize_money

router = APIRouter(prefix="/catalog", tags=["Catalog: Products, Variants, Plans, Taxes & Discounts"])

# ----------------- Schemas ----------------- #

class ProductVariantCreate(BaseModel):
    attribute: str
    value: str
    extra_price: Decimal = Decimal("0.00")

class ProductCreate(BaseModel):
    name: str
    type: str = ProductType.SOFTWARE.value
    sales_price: Decimal
    cost_price: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    variants: Optional[List[ProductVariantCreate]] = []

class PlanCreate(BaseModel):
    name: str
    price: Decimal
    billing_period: str = BillingPeriod.MONTHLY.value
    min_quantity: int = 1
    available_from: Optional[date] = None
    available_to: Optional[date] = None
    auto_close: bool = True
    closable: bool = True
    pausable: bool = True
    renewable: bool = True

class TaxRuleCreate(BaseModel):
    name: str
    rate_percent: Decimal
    applies_to: str = "all"
    target: Optional[str] = None
    inclusive: bool = False

class DiscountCreate(BaseModel):
    name: str
    code: Optional[str] = None
    kind: str = DiscountKind.PERCENT.value
    value: Decimal
    min_purchase: Decimal = Decimal("0.00")
    min_quantity: int = 1
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    usage_limit: int = 100
    scope: str = DiscountScope.SUBSCRIPTION.value
    product_id: Optional[int] = None

class CustomerCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    billing_address: Optional[str] = None
    tax_id: Optional[str] = None

# ----------------- Products & Variants ----------------- #

@router.get("/products")
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.is_active == True).all()
    results = []
    for p in products:
        results.append({
            "id": p.id,
            "name": p.name,
            "type": p.type,
            "sales_price": str(p.sales_price),
            "cost_price": str(p.cost_price),
            "notes": p.notes,
            "variants": [
                {
                    "id": v.id,
                    "attribute": v.attribute,
                    "value": v.value,
                    "extra_price": str(v.extra_price)
                } for v in p.variants
            ]
        })
    return results

@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    product = Product(
        name=payload.name,
        type=payload.type,
        sales_price=quantize_money(payload.sales_price),
        cost_price=quantize_money(payload.cost_price),
        notes=payload.notes
    )
    db.add(product)
    db.flush()

    if payload.variants:
        for v in payload.variants:
            variant = ProductVariant(
                product_id=product.id,
                attribute=v.attribute,
                value=v.value,
                extra_price=quantize_money(v.extra_price)
            )
            db.add(variant)

    db.commit()
    db.refresh(product)
    return {"id": product.id, "name": product.name, "message": "Product created successfully."}

@router.post("/products/{product_id}/variants", status_code=status.HTTP_201_CREATED)
def add_product_variant(
    product_id: int,
    payload: ProductVariantCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    variant = ProductVariant(
        product_id=product.id,
        attribute=payload.attribute,
        value=payload.value,
        extra_price=quantize_money(payload.extra_price)
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return {
        "id": variant.id,
        "product_id": variant.product_id,
        "attribute": variant.attribute,
        "value": variant.value,
        "extra_price": str(variant.extra_price)
    }

# ----------------- Plans ----------------- #

@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(Plan).filter(Plan.is_active == True).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "price": str(p.price),
            "billing_period": p.billing_period,
            "min_quantity": p.min_quantity,
            "available_from": p.available_from.isoformat() if p.available_from else None,
            "available_to": p.available_to.isoformat() if p.available_to else None,
            "auto_close": p.auto_close,
            "closable": p.closable,
            "pausable": p.pausable,
            "renewable": p.renewable
        } for p in plans
    ]

@router.post("/plans", status_code=status.HTTP_201_CREATED)
def create_plan(
    payload: PlanCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    plan = Plan(
        name=payload.name,
        price=quantize_money(payload.price),
        billing_period=payload.billing_period,
        min_quantity=payload.min_quantity,
        available_from=payload.available_from,
        available_to=payload.available_to,
        auto_close=payload.auto_close,
        closable=payload.closable,
        pausable=payload.pausable,
        renewable=payload.renewable
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"id": plan.id, "name": plan.name, "message": "Plan created successfully."}

# ----------------- Taxes ----------------- #

@router.get("/taxes")
def list_tax_rules(db: Session = Depends(get_db)):
    taxes = db.query(TaxRule).filter(TaxRule.is_active == True).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "rate_percent": str(t.rate_percent),
            "applies_to": t.applies_to,
            "target": t.target,
            "inclusive": t.inclusive
        } for t in taxes
    ]

@router.post("/taxes", status_code=status.HTTP_201_CREATED)
def create_tax_rule(
    payload: TaxRuleCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    rule = TaxRule(
        name=payload.name,
        rate_percent=quantize_money(payload.rate_percent),
        applies_to=payload.applies_to,
        target=payload.target,
        inclusive=payload.inclusive
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "name": rule.name, "rate_percent": str(rule.rate_percent)}

# ----------------- Discounts ----------------- #

@router.get("/discounts")
def list_discounts(db: Session = Depends(get_db)):
    discounts = db.query(Discount).filter(Discount.is_active == True).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "kind": d.kind,
            "value": str(d.value),
            "min_purchase": str(d.min_purchase),
            "min_quantity": d.min_quantity,
            "start_date": d.start_date.isoformat() if d.start_date else None,
            "end_date": d.end_date.isoformat() if d.end_date else None,
            "usage_limit": d.usage_limit,
            "used_count": d.used_count,
            "scope": d.scope,
            "product_id": d.product_id
        } for d in discounts
    ]

@router.post("/discounts", status_code=status.HTTP_201_CREATED)
def create_discount(
    payload: DiscountCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    discount = Discount(
        name=payload.name,
        code=payload.code,
        kind=payload.kind,
        value=quantize_money(payload.value),
        min_purchase=quantize_money(payload.min_purchase),
        min_quantity=payload.min_quantity,
        start_date=payload.start_date,
        end_date=payload.end_date,
        usage_limit=payload.usage_limit,
        scope=payload.scope,
        product_id=payload.product_id
    )
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return {"id": discount.id, "name": discount.name, "message": "Discount created successfully."}

# ----------------- Customers ----------------- #

@router.get("/customers")
def list_customers(
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    customers = db.query(Customer).order_by(Customer.name.asc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "billing_address": c.billing_address,
            "tax_id": c.tax_id
        } for c in customers
    ]

@router.post("/customers", status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user=Depends(require_staff_or_admin)
):
    customer = Customer(
        name=payload.name,
        email=payload.email.lower().strip(),
        phone=payload.phone,
        billing_address=payload.billing_address,
        tax_id=payload.tax_id
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return {"id": customer.id, "name": customer.name, "email": customer.email}

