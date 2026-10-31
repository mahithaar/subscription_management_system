import unittest
from decimal import Decimal
from datetime import date, timedelta
from app.services.pricing import PricingEngine, quantize_money

class MockVariant:
    def __init__(self, id, attribute, value, extra_price):
        self.id = id
        self.attribute = attribute
        self.value = value
        self.extra_price = Decimal(str(extra_price))

class MockTaxRule:
    def __init__(self, id, name, rate_percent, inclusive=False, is_active=True):
        self.id = id
        self.name = name
        self.rate_percent = Decimal(str(rate_percent))
        self.inclusive = inclusive
        self.is_active = is_active

class MockDiscount:
    def __init__(
        self, id, name, kind, value,
        min_purchase=0, min_quantity=1,
        start_date=None, end_date=None,
        usage_limit=100, used_count=0,
        scope="subscription", product_id=None, is_active=True
    ):
        self.id = id
        self.name = name
        self.kind = kind
        self.value = Decimal(str(value))
        self.min_purchase = Decimal(str(min_purchase))
        self.min_quantity = min_quantity
        self.start_date = start_date
        self.end_date = end_date
        self.usage_limit = usage_limit
        self.used_count = used_count
        self.scope = scope
        self.product_id = product_id
        self.is_active = is_active

class TestPricingEngine(unittest.TestCase):
    def test_odoo_variant_and_taxes_formula(self):
        """
        Verify the exact scenario in the blueprint:
        Base: 1000
        Odoo Variant: +560 -> 1560
        Discount: -100 -> 1460
        CGST 9%: 131.40
        SGST 9%: 131.40
        Total: 1722.80
        """
        variant = MockVariant(id=1, attribute="Brand", value="Odoo", extra_price=560)
        discount = MockDiscount(id=1, name="Promo 100", kind="fixed", value=100)
        cgst = MockTaxRule(id=1, name="CGST 9%", rate_percent=9.00)
        sgst = MockTaxRule(id=2, name="SGST 9%", rate_percent=9.00)

        result = PricingEngine.price_line(
            product_name="Software Pro",
            product_id=1,
            base_price=Decimal("1000.00"),
            quantity=1,
            as_of_date=date(2026, 11, 1),
            variant=variant,
            candidate_discounts=[discount],
            tax_rules=[cgst, sgst]
        )

        self.assertEqual(result["unit_price"], Decimal("1560.00"))
        self.assertEqual(result["discount_amount"], Decimal("100.00"))
        self.assertEqual(result["taxable_amount"], Decimal("1460.00"))
        self.assertEqual(result["total_tax"], Decimal("262.80"))
        self.assertEqual(result["line_total"], Decimal("1722.80"))

        # Verify explain trace structure
        trace = result["explain_trace"]
        self.assertEqual(trace["base_price"], "1000.00")
        self.assertEqual(trace["variant"]["extra_price"], "560.00")
        self.assertEqual(trace["effective_unit_price"], "1560.00")
        self.assertEqual(trace["taxable_amount"], "1460.00")
        self.assertEqual(len(trace["taxes"]), 2)
        self.assertEqual(trace["line_total"], "1722.80")

    def test_discount_exhaustion(self):
        """Discounts that have reached usage_limit must be skipped."""
        discount = MockDiscount(
            id=1, name="Sold out promo", kind="percent", value=20,
            usage_limit=5, used_count=5
        )
        result = PricingEngine.price_line(
            product_name="ERP Starter",
            product_id=2,
            base_price=Decimal("500.00"),
            quantity=1,
            as_of_date=date(2026, 11, 1),
            candidate_discounts=[discount]
        )
        self.assertEqual(result["discount_amount"], Decimal("0.00"))
        self.assertIsNone(result["discount_id"])

    def test_discount_expired(self):
        """Discounts past their end_date must be skipped (Time Machine scenario)."""
        discount = MockDiscount(
            id=1, name="Halloween deal", kind="fixed", value=50,
            start_date=date(2026, 10, 1), end_date=date(2026, 10, 31)
        )
        # Advance clock to Nov 1
        result = PricingEngine.price_line(
            product_name="ERP Starter",
            product_id=2,
            base_price=Decimal("500.00"),
            quantity=1,
            as_of_date=date(2026, 11, 1),
            candidate_discounts=[discount]
        )
        self.assertEqual(result["discount_amount"], Decimal("0.00"))

    def test_rounding_half_up(self):
        """Verify strict decimal round-half-up to prevent floating point drift."""
        # Taxable amount 33.33 with 7.5% tax = 2.49975 -> should round to 2.50
        tax = PricingEngine.calculate_tax(Decimal("33.33"), Decimal("7.50"))
        self.assertEqual(tax, Decimal("2.50"))

if __name__ == "__main__":
    unittest.main()

