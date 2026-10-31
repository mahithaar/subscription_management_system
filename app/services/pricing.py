from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import List, Dict, Any, Optional

TWO_PLACES = Decimal("0.01")

def quantize_money(amount: Decimal) -> Decimal:
    """Rounds money amounts using standard ROUND_HALF_UP to two decimal places."""
    return amount.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

class PricingEngine:
    @staticmethod
    def calculate_line_price(
        base_price: Decimal,
        variant_extra_price: Optional[Decimal] = None
    ) -> Decimal:
        """Computes effective unit price = base_price + variant_extra_price"""
        extra = variant_extra_price if variant_extra_price is not None else Decimal("0.00")
        return quantize_money(base_price + extra)

    @staticmethod
    def is_discount_eligible(
        discount: Any,
        as_of_date: date,
        subtotal: Decimal,
        quantity: int,
        product_id: Optional[int] = None
    ) -> bool:
        if not discount or not getattr(discount, "is_active", True):
            return False

        # Date window check
        if discount.start_date and as_of_date < discount.start_date:
            return False
        if discount.end_date and as_of_date > discount.end_date:
            return False

        # Usage limit check
        if discount.used_count >= discount.usage_limit:
            return False

        # Quantity and purchase threshold check
        if quantity < discount.min_quantity:
            return False
        if subtotal < discount.min_purchase:
            return False

        # Scope matching
        if discount.scope == "product" and product_id is not None:
            if discount.product_id != product_id:
                return False

        return True

    @classmethod
    def calculate_discount_amount(cls, discount: Any, subtotal: Decimal) -> Decimal:
        if not discount or subtotal <= Decimal("0.00"):
            return Decimal("0.00")

        if discount.kind == "fixed":
            # Cannot discount more than subtotal
            amount = min(Decimal(str(discount.value)), subtotal)
        elif discount.kind == "percent":
            raw_amount = subtotal * (Decimal(str(discount.value)) / Decimal("100"))
            amount = min(raw_amount, subtotal)
        else:
            amount = Decimal("0.00")

        return quantize_money(amount)

    @classmethod
    def calculate_tax(
        cls,
        taxable_amount: Decimal,
        rate_percent: Decimal,
        inclusive: bool = False
    ) -> Decimal:
        if taxable_amount <= Decimal("0.00"):
            return Decimal("0.00")

        if inclusive:
            # tax = taxable_amount - (taxable_amount / (1 + rate / 100))
            tax = taxable_amount - (taxable_amount / (Decimal("1.00") + (rate_percent / Decimal("100.00"))))
        else:
            tax = taxable_amount * (rate_percent / Decimal("100.00"))

        return quantize_money(tax)

    @classmethod
    def price_line(
        cls,
        product_name: str,
        product_id: int,
        base_price: Decimal,
        quantity: int,
        as_of_date: date,
        variant: Optional[Any] = None,
        candidate_discounts: Optional[List[Any]] = None,
        tax_rules: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """
        Pure function: calculates effective price, discount, taxes, totals, and explain trace.
        """
        base_price = quantize_money(Decimal(str(base_price)))
        variant_extra = quantize_money(Decimal(str(variant.extra_price))) if variant and variant.extra_price else Decimal("0.00")
        effective_unit_price = quantize_money(base_price + variant_extra)
        line_subtotal = quantize_money(effective_unit_price * quantity)

        # 1. Discount evaluation (best-wins)
        best_discount = None
        best_discount_amount = Decimal("0.00")

        if candidate_discounts:
            for disc in candidate_discounts:
                if cls.is_discount_eligible(disc, as_of_date, line_subtotal, quantity, product_id):
                    disc_amt = cls.calculate_discount_amount(disc, line_subtotal)
                    if disc_amt > best_discount_amount:
                        best_discount_amount = disc_amt
                        best_discount = disc

        taxable_amount = quantize_money(max(Decimal("0.00"), line_subtotal - best_discount_amount))

        # 2. Tax evaluation (exclusive taxes added after discount)
        applied_taxes = []
        total_tax = Decimal("0.00")

        if tax_rules:
            for rule in tax_rules:
                if not getattr(rule, "is_active", True):
                    continue
                rate = Decimal(str(rule.rate_percent))
                tax_amt = cls.calculate_tax(taxable_amount, rate, inclusive=getattr(rule, "inclusive", False))
                total_tax += tax_amt
                applied_taxes.append({
                    "id": getattr(rule, "id", None),
                    "name": getattr(rule, "name", "Tax"),
                    "rate_percent": str(rate),
                    "amount": str(tax_amt)
                })

        total_tax = quantize_money(total_tax)
        line_total = quantize_money(taxable_amount + total_tax)

        # 3. Build explain trace
        explain_trace = {
            "product_name": product_name,
            "product_id": product_id,
            "base_price": f"{base_price:.2f}",
            "variant": {
                "id": getattr(variant, "id", None),
                "attribute": getattr(variant, "attribute", None),
                "value": getattr(variant, "value", None),
                "extra_price": f"{variant_extra:.2f}"
            } if variant else None,
            "effective_unit_price": f"{effective_unit_price:.2f}",
            "quantity": quantity,
            "line_subtotal": f"{line_subtotal:.2f}",
            "discount": {
                "id": getattr(best_discount, "id", None),
                "name": getattr(best_discount, "name", None),
                "code": getattr(best_discount, "code", None),
                "kind": getattr(best_discount, "kind", None),
                "value": f"{quantize_money(Decimal(str(getattr(best_discount, 'value', 0)))):.2f}",
                "amount": f"{best_discount_amount:.2f}"
            } if best_discount else None,
            "taxable_amount": f"{taxable_amount:.2f}",
            "taxes": applied_taxes,
            "total_tax": f"{total_tax:.2f}",
            "line_total": f"{line_total:.2f}"
        }

        return {
            "description": f"{product_name}" + (f" ({variant.attribute}: {variant.value})" if variant else ""),
            "product_id": product_id,
            "variant_id": getattr(variant, "id", None) if variant else None,
            "quantity": quantity,
            "unit_price": effective_unit_price,
            "discount_id": getattr(best_discount, "id", None) if best_discount else None,
            "discount_amount": best_discount_amount,
            "tax_snapshot": applied_taxes,
            "taxable_amount": taxable_amount,
            "total_tax": total_tax,
            "line_total": line_total,
            "explain_trace": explain_trace,
            "applied_discount_obj": best_discount
        }
