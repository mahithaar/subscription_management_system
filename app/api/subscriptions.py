from typing import List, Optional
from decimal import Decimal
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import (
    Subscription, SubscriptionLine, Plan, Product, ProductVariant, Customer,
    QuotationTemplate, QuotationTemplateLine, SubscriptionState, User, UserRole
)
from app.api.deps import get_current_user, require_staff_or_admin
from app.services.clock import ClockService
from app.services.pricing import quantize_money

router = APIRouter(prefix="/subscriptions", tags=["Quotation Templates & Subscriptions"])

class SubscriptionLineCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = 1
    unit_price: Optional[Decimal] = None
    tax_ids: Optional[List[int]] = []

class SubscriptionCreate(BaseModel):
    customer_id: int
    plan_id: int
    start_date: date
    expiry_date: Optional[date] = None
    payment_term_days: int = 15
    discount_id: Optional[int] = None
    lines: List[SubscriptionLineCreate]

class QuotationTemplateCreate(BaseModel):
    name: str
    plan_id: int
    validity_days: int = 30
    lines: List[SubscriptionLineCreate]

# ----------------- Quotation Templates ----------------- #

@router.get("/templates")
def list_quotation_templates(db: Session = Depends(get_db)):
    templates = db.query(QuotationTemplate).all()
    results = []
    for t in templates:
        results.append({
            "id": t.id,
            "name": t.name,
            "plan_id": t.plan_id,
            "plan_name": t.plan.name if t.plan else "",
            "validity_days": t.validity_days,
            "lines": [
                {
                    "product_id": l.product_id,
                    "product_name": l.product.name if l.product else "",
                    "variant_id": l.variant_id,
                    "variant_name": f"{l.variant.attribute}: {l.variant.value}" if l.variant else None,
                    "quantity": l.quantity
                } for l in t.lines
            ]
        })
    return results

@router.post("/templates", status_code=status.HTTP_201_CREATED)
def create_quotation_template(
    payload: QuotationTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")

    template = QuotationTemplate(
        name=payload.name,
        plan_id=payload.plan_id,
        validity_days=payload.validity_days
    )
    db.add(template)
    db.flush()

    for l in payload.lines:
        t_line = QuotationTemplateLine(
            template_id=template.id,
            product_id=l.product_id,
            variant_id=l.variant_id,
            quantity=l.quantity
        )
        db.add(t_line)

    db.commit()
    db.refresh(template)
    return {"id": template.id, "name": template.name, "message": "Quotation template created."}

# ----------------- Subscriptions ----------------- #

@router.get("")
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Subscription)
    # Server-side customer data scoping
    if current_user.role == UserRole.CUSTOMER.value:
        if not current_user.customer:
            return []
        query = query.filter(Subscription.customer_id == current_user.customer.id)

    subs = query.order_by(Subscription.id.desc()).all()
    results = []
    for s in subs:
        results.append({
            "id": s.id,
            "number": s.number,
            "customer_id": s.customer_id,
            "customer_name": s.customer.name if s.customer else "",
            "customer_email": s.customer.email if s.customer else "",
            "plan_id": s.plan_id,
            "plan_name": s.plan.name if s.plan else "",
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "expiry_date": s.expiry_date.isoformat() if s.expiry_date else None,
            "payment_term_days": s.payment_term_days,
            "state": s.state,
            "is_paused": s.is_paused,
            "next_invoice_date": s.next_invoice_date.isoformat() if s.next_invoice_date else None,
            "lines_count": len(s.lines)
        })
    return results

@router.get("/{subscription_id}")
def get_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    if current_user.role == UserRole.CUSTOMER.value:
        if not current_user.customer or sub.customer_id != current_user.customer.id:
            raise HTTPException(status_code=403, detail="Access denied.")

    return {
        "id": sub.id,
        "number": sub.number,
        "customer": {
            "id": sub.customer.id,
            "name": sub.customer.name,
            "email": sub.customer.email
        },
        "plan": {
            "id": sub.plan.id,
            "name": sub.plan.name,
            "billing_period": sub.plan.billing_period,
            "auto_close": sub.plan.auto_close,
            "closable": sub.plan.closable,
            "pausable": sub.plan.pausable,
            "renewable": sub.plan.renewable
        },
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "expiry_date": sub.expiry_date.isoformat() if sub.expiry_date else None,
        "payment_term_days": sub.payment_term_days,
        "state": sub.state,
        "is_paused": sub.is_paused,
        "next_invoice_date": sub.next_invoice_date.isoformat() if sub.next_invoice_date else None,
        "lines": [
            {
                "id": l.id,
                "product_id": l.product_id,
                "product_name": l.product.name if l.product else "",
                "variant_id": l.variant_id,
                "variant_name": f"{l.variant.attribute}: {l.variant.value}" if l.variant else None,
                "quantity": l.quantity,
                "unit_price": str(l.unit_price),
                "tax_ids": l.tax_ids
            } for l in sub.lines
        ]
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")

    # Unique sequential number
    count = db.query(Subscription).count() + 1
    today = ClockService.get_today(db)
    sub_number = f"SUB-{today.year}-{count:04d}"

    subscription = Subscription(
        number=sub_number,
        customer_id=payload.customer_id,
        plan_id=payload.plan_id,
        start_date=payload.start_date,
        expiry_date=payload.expiry_date,
        payment_term_days=payload.payment_term_days,
        state=SubscriptionState.DRAFT.value,
        is_paused=False,
        next_invoice_date=payload.start_date,
        discount_id=payload.discount_id
    )
    db.add(subscription)
    db.flush()

    for line_in in payload.lines:
        product = db.query(Product).filter(Product.id == line_in.product_id).first()
        if not product:
            continue
        unit_price = line_in.unit_price if line_in.unit_price is not None else product.sales_price
        sub_line = SubscriptionLine(
            subscription_id=subscription.id,
            product_id=line_in.product_id,
            variant_id=line_in.variant_id,
            quantity=line_in.quantity,
            unit_price=quantize_money(unit_price),
            tax_ids=line_in.tax_ids or []
        )
        db.add(sub_line)

    db.commit()
    db.refresh(subscription)
    return {"id": subscription.id, "number": subscription.number, "state": subscription.state}

# ----------------- Lifecycle Transitions ----------------- #

@router.post("/{subscription_id}/to-quotation")
def transition_to_quotation(
    subscription_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    if sub.state != SubscriptionState.DRAFT.value:
        raise HTTPException(status_code=400, detail=f"Cannot transition to Quotation from {sub.state}.")

    sub.state = SubscriptionState.QUOTATION.value
    db.commit()
    return {"id": sub.id, "number": sub.number, "state": sub.state}

@router.post("/{subscription_id}/confirm")
def confirm_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    if sub.state not in [SubscriptionState.DRAFT.value, SubscriptionState.QUOTATION.value]:
        raise HTTPException(status_code=400, detail=f"Cannot confirm subscription in {sub.state} state.")

    today = ClockService.get_today(db)
    # If start date reached, auto-activate; else Confirmed
    if sub.start_date <= today:
        sub.state = SubscriptionState.ACTIVE.value
    else:
        sub.state = SubscriptionState.CONFIRMED.value

    db.commit()
    return {"id": sub.id, "number": sub.number, "state": sub.state}

@router.post("/{subscription_id}/activate")
def activate_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    if sub.state not in [SubscriptionState.CONFIRMED.value, SubscriptionState.QUOTATION.value]:
        raise HTTPException(status_code=400, detail=f"Cannot activate subscription from {sub.state}.")

    sub.state = SubscriptionState.ACTIVE.value
    db.commit()
    return {"id": sub.id, "number": sub.number, "state": sub.state}

@router.post("/{subscription_id}/pause")
def pause_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    if not sub.plan.pausable:
        raise HTTPException(status_code=400, detail="Plan does not allow pausing.")
    if sub.state != SubscriptionState.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Only Active subscriptions can be paused.")

    sub.is_paused = True
    db.commit()
    return {"id": sub.id, "number": sub.number, "is_paused": sub.is_paused, "message": "Subscription paused."}

@router.post("/{subscription_id}/resume")
def resume_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    sub.is_paused = False
    db.commit()
    return {"id": sub.id, "number": sub.number, "is_paused": sub.is_paused, "message": "Subscription resumed."}

@router.post("/{subscription_id}/close")
def close_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    if not sub.plan.closable:
        raise HTTPException(status_code=400, detail="Plan does not allow early close.")

    sub.state = SubscriptionState.CLOSED.value
    db.commit()
    return {"id": sub.id, "number": sub.number, "state": sub.state, "message": "Subscription closed."}

