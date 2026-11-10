
# # Copyright (c) 2026, Sanjay and contributors
# # For license information, please see license.txt

# import frappe
# from frappe.model.document import Document
# from frappe.utils import flt


# class RestaurantOrder(Document):

#     def validate(self):

#         # 1. Prevent empty orders
#         if not self.items:
#             frappe.throw(
#                 "Cannot save an order without food items."
#             )

#         subtotal = 0
#         tax_amount = 0

#         # 2. Validate and calculate each order item
#         for row in self.items:

#             # Check Food Item selection
#             if not row.food_item:
#                 frappe.throw(
#                     "Please select a Food Item in every order row."
#                 )

#             # Fetch current Food Item details
#             item = frappe.db.get_value(
#                 "Food Item",
#                 row.food_item,
#                 ["price", "tax_percentage", "availability"],
#                 as_dict=True
#             )

#             if not item:
#                 frappe.throw(
#                     f"Food Item {row.food_item} does not exist."
#                 )

#             # 3. Prevent unavailable food items
#             if not item.availability:
#                 frappe.throw(
#                     f"{row.food_item} is currently unavailable."
#                 )

#             quantity = flt(row.quantity)
#             rate = flt(item.price)
#             tax_percentage = flt(item.tax_percentage)

#             # 4. Validate quantity
#             if quantity <= 0:
#                 frappe.throw(
#                     "Quantity must be greater than zero."
#                 )

#             # 5. Validate item price
#             if rate < 0:
#                 frappe.throw(
#                     "Food item price cannot be negative."
#                 )

#             # Validate tax percentage
#             if tax_percentage < 0:
#                 frappe.throw(
#                     "Tax percentage cannot be negative."
#                 )

#             # Update child table with trusted master values
#             row.rate = rate
#             row.tax_percentage = tax_percentage

#             # 6. Calculate row amount
#             row.amount = quantity * rate

#             # 7. Calculate subtotal
#             subtotal += row.amount

#             # 8. Calculate tax
#             tax_amount += (
#                 row.amount * tax_percentage / 100
#             )

#         # 9. Validate discount
#         discount = flt(self.discount)

#         if discount < 0:
#             frappe.throw(
#                 "Discount cannot be negative."
#             )

#         if discount > subtotal:
#             frappe.throw(
#                 "Discount cannot be greater than subtotal."
#             )

#         # 10. Update parent totals
#         self.subtotal = subtotal
#         self.tax_amount = tax_amount

#         self.grand_total = (
#             subtotal + tax_amount - discount
#         )

#         # 11. Prevent unauthorized modifications
#         old_doc = self.get_doc_before_save()

#         if (
#             old_doc
#             and old_doc.order_status == "Completed"
#             and not frappe.has_role("Restaurant Manager")
#         ):
#             frappe.throw(
#                 "Only Restaurant Manager can modify a completed order."
#             )

#this is a new set of changes made to the restaurant order doctype. The validate method now includes comprehensive checks for empty orders, item availability, quantity, price, tax percentage, and discount. It also calculates the subtotal, tax amount, and grand total while ensuring that only authorized users can modify completed orders.

import frappe
from frappe.model.document import Document
from frappe.utils import flt, getdate, today


class RestaurantOrder(Document):

    def validate(self):


        if not self.customer_name or not self.customer_name.strip():
            frappe.throw("Customer name is required.")
        self.customer_name = self.customer_name.strip()

        if self.order_date and getdate(self.order_date) > getdate(today()):
            frappe.throw("Order Date cannot be in the future.")

        old_doc = self.get_doc_before_save()

        # ==========================================
        # 1. PROTECT ALREADY SUBMITTED ORDERS
        # ==========================================

        if old_doc and old_doc.docstatus == 1:

            is_manager = (
                frappe.has_role("Restaurant Manager")
                or frappe.has_role("System Manager")
            )

            is_head_chef = frappe.has_role("Head Chef")

            is_waiter = frappe.has_role("Waiter")

            # Waiter cannot modify a submitted order
            if is_waiter and not is_manager:

                frappe.throw(
                    "You cannot modify an order after submitting it."
                )

            # Head Chef can only process workflow actions
            if is_head_chef and not is_manager:

                # Check whether protected order details changed
                protected_fields = [
                    "customer_name",
                    "order_type",
                    "order_date",
                    "discount",
                    "subtotal",
                    "tax_amount",
                    "grand_total"
                ]

                for fieldname in protected_fields:

                    if self.get(fieldname) != old_doc.get(fieldname):

                        frappe.throw(
                            "Head Chef cannot modify order details."
                        )

                # Check child table changes
                old_items = [
                    {
                        "food_item": row.food_item,
                        "quantity": row.quantity,
                        "rate": row.rate,
                        "tax_percentage": row.tax_percentage,
                        "amount": row.amount
                    }
                    for row in old_doc.items
                ]

                new_items = [
                    {
                        "food_item": row.food_item,
                        "quantity": row.quantity,
                        "rate": row.rate,
                        "tax_percentage": row.tax_percentage,
                        "amount": row.amount
                    }
                    for row in self.items
                ]

                if old_items != new_items:

                    frappe.throw(
                        "Head Chef cannot modify food items or quantities."
                    )

                # Validate Head Chef workflow transitions
                allowed_transitions = {
                    "Pending Kitchen": [
                        "Confirmed",
                        "Cancelled"
                    ],
                    "Confirmed": [
                        "Completed",
                        "Cancelled"
                    ]
                }

                previous_status = old_doc.order_status
                new_status = self.order_status

                if new_status not in allowed_transitions.get(
                    previous_status, []
                ):

                    frappe.throw(
                        "Invalid order status transition."
                    )

                # No further recalculation is required for
                # a Head Chef workflow-only action.
                return

            # Validate Manager workflow transitions too
            if is_manager and old_doc.order_status != self.order_status:

                allowed_transitions = {
                    "Pending Kitchen": [
                        "Confirmed",
                        "Cancelled"
                    ],
                    "Confirmed": [
                        "Completed",
                        "Cancelled"
                    ]
                }

                if self.order_status not in allowed_transitions.get(
                    old_doc.order_status, []
                ):

                    frappe.throw(
                        "Invalid order status transition."
                    )

        # ==========================================
        # 2. PREVENT EMPTY ORDERS
        # ==========================================

        if not self.items:

            frappe.throw(
                "Cannot save an order without food items."
            )

        subtotal = 0
        tax_amount = 0

        # ==========================================
        # 3. VALIDATE EACH ORDER ITEM
        # ==========================================

        for row in self.items:

            if not row.food_item:

                frappe.throw(
                    "Please select a food item for every row."
                )

            # Fetch current Food Item details
            food_item = frappe.db.get_value(
                "Food Item",
                row.food_item,
                [
                    "price",
                    "tax_percentage",
                    "availability"
                ],
                as_dict=True
            )

            if not food_item:

                frappe.throw(
                    f"Food Item {row.food_item} does not exist."
                )

            # Check availability
            if not food_item.availability:

                frappe.throw(
                    f"{row.food_item} is currently unavailable."
                )

            # Validate quantity
            if flt(row.quantity) <= 0:

                frappe.throw(
                    f"Quantity must be greater than zero for {row.food_item}."
                )

            # Validate price
            if flt(food_item.price) < 0:

                frappe.throw(
                    f"Invalid price for {row.food_item}."
                )

            # Validate tax percentage
            if flt(food_item.tax_percentage) < 0:

                frappe.throw(
                    f"Invalid tax percentage for {row.food_item}."
                )

            # Fetch trusted values from Food Item
            row.rate = flt(food_item.price)

            row.tax_percentage = flt(
                food_item.tax_percentage
            )

            # Calculate row amount
            row.amount = (
                flt(row.quantity) * flt(row.rate)
            )

            subtotal += flt(row.amount)

            # Calculate item tax
            tax_amount += (
                flt(row.amount)
                * flt(row.tax_percentage)
                / 100
            )

        # ==========================================
        # 4. VALIDATE DISCOUNT
        # ==========================================

        discount = flt(self.discount)

        if discount < 0:

            frappe.throw(
                "Discount cannot be negative."
            )

        if discount > subtotal:

            frappe.throw(
                "Discount cannot exceed the subtotal."
            )

        # ==========================================
        # 5. CALCULATE FINAL TOTALS
        # ==========================================

        grand_total = (
            subtotal + tax_amount - discount
        )

        self.subtotal = flt(subtotal, 2)

        self.tax_amount = flt(tax_amount, 2)

        self.grand_total = flt(grand_total, 2)
