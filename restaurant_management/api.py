
# import frappe
# from frappe.utils import getdate, flt
# from frappe.model.workflow import apply_workflow


# # ==================================================
# # 37. GET ALL AVAILABLE FOOD ITEMS
# # ==================================================

# @frappe.whitelist()
# def get_available_food_items():

#     items = frappe.get_all(
#         "Food Item",
#         filters={"availability": 1},
#         fields=[
#             "name",
#             "item_name",
#             "category",
#             "price",
#             "tax_percentage"
#         ],
#         order_by="item_name asc"
#     )

#     return {
#         "success": True,
#         "message": "Available food items retrieved successfully",
#         "count": len(items),
#         "data": items
#     }


# # ==================================================
# # 38. GET FOOD ITEM DETAILS USING ITEM CODE
# # ==================================================

# @frappe.whitelist()
# def get_food_item_details(item_code=None):

#     if not item_code or not item_code.strip():
#         frappe.throw("Item Code is required")

#     item_code = item_code.strip()

#     if not frappe.db.exists("Food Item", item_code):
#         frappe.throw(
#             f"Food Item with Item Code {item_code} does not exist"
#         )

#     item = frappe.get_doc("Food Item", item_code)

#     return {
#         "success": True,
#         "message": "Food item details retrieved successfully",
#         "data": {
#             "item_code": item.name,
#             "item_name": item.item_name,
#             "category": item.category,
#             "price": item.price,
#             "tax_percentage": item.tax_percentage,
#             "availability": item.availability
#         }
#     }


# # ==================================================
# # 39. GET RESTAURANT ORDER DETAILS USING ORDER ID
# # ==================================================

# @frappe.whitelist()
# def get_restaurant_order_details(order_id=None):

#     if not order_id or not order_id.strip():
#         frappe.throw("Order ID is required")

#     order_id = order_id.strip()

#     if not frappe.db.exists("Restaurant Order", order_id):
#         frappe.throw(
#             f"Restaurant Order with ID {order_id} does not exist"
#         )

#     order = frappe.get_doc("Restaurant Order", order_id)

#     return {
#         "success": True,
#         "message": "Restaurant order details retrieved successfully",
#         "data": order.as_dict()
#     }


# # ==================================================
# # 40. GET TOTAL SALES FOR A SPECIFIED DATE
# # ==================================================

# @frappe.whitelist()
# def get_total_sales(order_date=None):

#     if not order_date or not str(order_date).strip():
#         frappe.throw("Order Date is required. Format: YYYY-MM-DD")

#     try:
#         order_date = getdate(order_date)

#     except (ValueError, TypeError):
#         frappe.throw("Invalid date. Please use YYYY-MM-DD format")

#     orders = frappe.get_all(
#         "Restaurant Order",
#         filters={
#             "order_date": order_date,
#             "order_status": "Completed"
#         },
#         fields=[
#             "name",
#             "grand_total"
#         ]
#     )

#     total_sales = sum(
#         flt(order.grand_total)
#         for order in orders
#     )

#     return {
#         "success": True,
#         "message": "Total sales retrieved successfully",
#         "date": str(order_date),
#         "completed_orders": len(orders),
#         "total_sales": total_sales,
#         "currency": frappe.defaults.get_global_default("currency")
#     }


# # ==================================================
# # KITCHEN DASHBOARD APIs
# # ==================================================




# # ==================================================
# # 1. GET ALL PENDING KITCHEN ORDERS
# # ==================================================

# @frappe.whitelist()
# def get_kitchen_orders():

#     orders = frappe.get_list(
#         "Restaurant Order",
#         filters={
#             "order_status": "Pending Kitchen",
#             "docstatus": 1
#         },
#         fields=[
#             "name",
#             "customer_name",
#             "order_type",
#             "order_date",
#             "grand_total",
#             "order_status",
#             "creation"
#         ],
#         order_by="creation asc"
#     )

#     return {
#         "success": True,
#         "message": "Kitchen orders retrieved successfully",
#         "count": len(orders),
#         "data": orders
#     }


# # ==================================================
# # 2. GET INDIVIDUAL KITCHEN ORDER DETAILS
# # ==================================================

# @frappe.whitelist()
# def get_kitchen_order_details(order_id=None):

#     if not order_id or not order_id.strip():

#         frappe.throw("Order ID is required.")

#     order_id = order_id.strip()

#     if not frappe.db.exists("Restaurant Order", order_id):

#         frappe.throw(
#             f"Restaurant Order {order_id} does not exist."
#         )

#     order = frappe.get_doc("Restaurant Order", order_id)

#     if not frappe.has_permission(
#         "Restaurant Order",
#         "read",
#         doc=order
#     ):

#         frappe.throw(
#             "You do not have permission to view this order."
#         )

#     if order.order_status not in [
#         "Pending Kitchen",
#         "Confirmed",
#         "Completed"
#     ]:

#         frappe.throw(
#             "This order is not available in the kitchen."
#         )

#     return {
#         "success": True,
#         "message": "Kitchen order details retrieved successfully",
#         "data": {
#             "order_id": order.name,
#             "customer_name": order.customer_name,
#             "order_type": order.order_type,
#             "order_date": order.order_date,
#             "order_status": order.order_status,
#             "items": [
#                 {
#                     "food_item": row.food_item,
#                     "quantity": row.quantity,
#                     "rate": row.rate,
#                     "amount": row.amount
#                 }
#                 for row in order.items
#             ],
#             "subtotal": order.subtotal,
#             "tax_amount": order.tax_amount,
#             "discount": order.discount,
#             "grand_total": order.grand_total
#         }
#     }


# # ==================================================
# # COMMON FUNCTION TO PROCESS KITCHEN WORKFLOW
# # ==================================================

# def process_kitchen_workflow(order_id, action):

#     # Check authorized roles
#     if not (
#         frappe.has_role("Head Chef")
#         or frappe.has_role("Restaurant Manager")
#         or frappe.has_role("System Manager")
#     ):

#         frappe.throw(
#             "Only Head Chef or Restaurant Manager can process kitchen orders."
#         )

#     if not order_id or not order_id.strip():

#         frappe.throw("Order ID is required.")

#     order_id = order_id.strip()

#     if not frappe.db.exists("Restaurant Order", order_id):

#         frappe.throw(
#             f"Restaurant Order {order_id} does not exist."
#         )

#     order = frappe.get_doc("Restaurant Order", order_id)

#     # Ensure the order is already submitted
#     if order.docstatus != 1:

#         frappe.throw(
#             "Only submitted orders can be processed by the kitchen."
#         )

#     # Check that the requested action is valid for the current state
#     allowed_actions = {
#         "Pending Kitchen": ["Confirm", "Cancel"],
#         "Confirmed": ["Complete", "Cancel"]
#     }

#     if action not in allowed_actions.get(
#         order.order_status, []
#     ):

#         frappe.throw(
#             f"Action {action} is not allowed for order status {order.order_status}."
#         )

#     # Apply the configured Frappe Workflow transition
#     updated_order = apply_workflow(order, action)

#     return {
#         "success": True,
#         "message": f"Order {order_id} successfully processed.",
#         "order_id": updated_order.name,
#         "order_status": updated_order.order_status,
#         "docstatus": updated_order.docstatus
#     }


# # ==================================================
# # 3. CONFIRM KITCHEN ORDER
# # ==================================================

# @frappe.whitelist()
# def confirm_kitchen_order(order_id=None):

#     return process_kitchen_workflow(
#         order_id,
#         "Confirm"
#     )


# # ==================================================
# # 4. CANCEL KITCHEN ORDER
# # ==================================================

# @frappe.whitelist()
# def cancel_kitchen_order(order_id=None):

#     return process_kitchen_workflow(
#         order_id,
#         "Cancel"
#     )


# # ==================================================
# # 5. COMPLETE KITCHEN ORDER
# # ==================================================

# @frappe.whitelist()
# def complete_kitchen_order(order_id=None):

#     return process_kitchen_workflow(
#         order_id,
#         "Complete"
#     )


# @frappe.whitelist()
# def get_dashboard_route():

#     user = frappe.session.user

#     if user == "Guest":
#         frappe.throw("Please log in first.")

#     roles = frappe.get_roles(user)

#     # Manager has the highest priority
#     if "Restaurant Manager" in roles or "System Manager" in roles:
#         return {"route": "manager"}

#     if "Head Chef" in roles:
#         return {"route": "kitchen"}

#     if "Waiter" in roles:
#         return {"route": "waiter"}

#     frappe.throw(
#         "Your account does not have access to the restaurant application.",
#         frappe.PermissionError
#     )


import frappe
from frappe.utils import getdate, flt
from frappe.model.workflow import apply_workflow, get_transitions


# ==================================================
# COMMON ROLE CHECK
# ==================================================

def has_any_role(roles):

    user_roles = frappe.get_roles(frappe.session.user)

    return any(role in user_roles for role in roles)


def check_restaurant_access(roles):

    if frappe.session.user == "Administrator":
        return

    if frappe.session.user == "Guest" or not has_any_role(roles):
        frappe.throw(
            "You are not authorized to perform this operation.",
            frappe.PermissionError
        )


# ==================================================
# 1. GET ALL AVAILABLE FOOD ITEMS
# Existing API - retained for Postman compatibility
# ==================================================

@frappe.whitelist()
def get_available_food_items():

    items = frappe.get_list(
        "Food Item",
        filters={"availability": 1},
        fields=[
            "name",
            "item_name",
            "category",
            "price",
            "tax_percentage"
        ],
        order_by="item_name asc"
    )

    return {
        "success": True,
        "message": "Available food items retrieved successfully",
        "count": len(items),
        "data": items
    }


# ==================================================
# 2. GET FOOD ITEM DETAILS
# ==================================================

@frappe.whitelist()
def get_food_item_details(item_code=None):

    if not item_code or not item_code.strip():
        frappe.throw("Item Code is required.")

    item_code = item_code.strip()

    if not frappe.db.exists("Food Item", item_code):
        frappe.throw(
            f"Food Item with Item Code {item_code} does not exist."
        )

    item = frappe.get_doc("Food Item", item_code)

    if not frappe.has_permission("read", doc=item):
        frappe.throw("You cannot access this food item.",
                     frappe.PermissionError)

    return {
        "success": True,
        "message": "Food item details retrieved successfully",
        "data": {
            "item_code": item.name,
            "item_name": item.item_name,
            "category": item.category,
            "price": item.price,
            "tax_percentage": item.tax_percentage,
            "availability": item.availability
        }
    }


# ==================================================
# 3. GET RESTAURANT ORDER DETAILS
# ==================================================

@frappe.whitelist()
def get_restaurant_order_details(order_id=None):

    if not order_id or not order_id.strip():
        frappe.throw("Order ID is required.")

    order_id = order_id.strip()

    if not frappe.db.exists("Restaurant Order", order_id):
        frappe.throw(
            f"Restaurant Order with ID {order_id} does not exist."
        )

    order = frappe.get_doc("Restaurant Order", order_id)

    if not frappe.has_permission("read", doc=order):
        frappe.throw("You cannot access this order.",
                     frappe.PermissionError)

    return {
        "success": True,
        "message": "Restaurant order details retrieved successfully",
        "data": order.as_dict()
    }


@frappe.whitelist()
def get_restaurant_orders():
    """Return the orders visible to restaurant operations staff."""
    check_restaurant_access(["Restaurant Manager", "Waiter", "System Manager"])
    orders = frappe.get_list(
        "Restaurant Order",
        fields=["name", "customer_name", "order_type", "order_date", "order_status", "grand_total", "creation"],
        order_by="creation desc",
        limit_page_length=500
    )
    return {"success": True, "data": orders}


# ==================================================
# 4. GET TOTAL SALES FOR A SPECIFIED DATE
# ==================================================

@frappe.whitelist()
def get_total_sales(order_date=None):

    check_restaurant_access([
        "Restaurant Manager",
        "System Manager"
    ])

    if not order_date or not str(order_date).strip():
        frappe.throw("Order Date is required. Format: YYYY-MM-DD")

    try:
        order_date = getdate(order_date)
    except (ValueError, TypeError):
        frappe.throw("Invalid date. Please use YYYY-MM-DD format.")

    orders = frappe.get_list(
        "Restaurant Order",
        filters={
            "order_date": order_date,
            "order_status": "Completed"
        },
        fields=["name", "grand_total"]
    )

    total_sales = sum(
        flt(order.grand_total) for order in orders
    )

    return {
        "success": True,
        "message": "Total sales retrieved successfully",
        "date": str(order_date),
        "completed_orders": len(orders),
        "total_sales": total_sales,
        "currency": frappe.defaults.get_global_default("currency")
    }


# ==================================================
# WAITER DASHBOARD APIs
# ==================================================


# ==================================================
# 5. GET WAITER MENU
# Categories + Available Food Items
# ==================================================

@frappe.whitelist()
def get_waiter_menu():

    check_restaurant_access([
        "Waiter",
        "Restaurant Manager",
        "System Manager"
    ])

    categories = frappe.get_list(
        "Food Category",
        fields=["name", "category_name"],
        order_by="category_name asc"
    )

    food_items = frappe.get_list(
        "Food Item",
        filters={"availability": 1},
        fields=[
            "name",
            "item_name",
            "category",
            "price",
            "tax_percentage",
            "availability"
        ],
        order_by="item_name asc"
    )

    return {
        "success": True,
        "categories": categories,
        "food_items": food_items
    }


# ==================================================
# MANAGER MENU MAINTENANCE
# These endpoints use fixed DocTypes and preserve document permissions.
# ==================================================

@frappe.whitelist(methods=["POST"])
def save_food_category(category_name, description="", name=None):
    check_restaurant_access(["Restaurant Manager", "System Manager"])
    category_name = (category_name or "").strip()
    if not category_name:
        frappe.throw("Category Name is required.")

    if name:
        doc = frappe.get_doc("Food Category", name)
        doc.check_permission("write")
        doc.category_name = category_name
        doc.description = description or ""
        doc.save()
    else:
        doc = frappe.get_doc({
            "doctype": "Food Category",
            "category_name": category_name,
            "description": description or ""
        })
        doc.insert()

    return {"name": doc.name, "category_name": doc.category_name, "description": doc.description}


@frappe.whitelist(methods=["POST"])
def save_food_item(item_name, category, price, tax_percentage=0, availability=0, name=None):
    check_restaurant_access(["Restaurant Manager", "System Manager"])
    item_name = (item_name or "").strip()
    if not item_name:
        frappe.throw("Item Name is required.")
    if not category:
        frappe.throw("Category is required.")

    values = {
        "item_name": item_name,
        "category": category,
        "price": flt(price),
        "tax_percentage": flt(tax_percentage),
        "availability": 1 if str(availability).lower() in ("1", "true", "yes", "on") else 0
    }
    if values["price"] < 0:
        frappe.throw("Price cannot be negative.")
    if values["tax_percentage"] < 0:
        frappe.throw("Tax Percentage cannot be negative.")

    if name:
        doc = frappe.get_doc("Food Item", name)
        doc.check_permission("write")
        doc.update(values)
        doc.save()
    else:
        doc = frappe.get_doc({"doctype": "Food Item", **values})
        doc.insert()

    return {
        "name": doc.name,
        "item_name": doc.item_name,
        "category": doc.category,
        "price": doc.price,
        "tax_percentage": doc.tax_percentage,
        "availability": doc.availability
    }


# ==================================================
# 6. CREATE ORDER AND SEND TO KITCHEN
# ==================================================

@frappe.whitelist()
def create_waiter_order(
    customer_name,
    order_type,
    items,
    discount=0
):

    check_restaurant_access([
        "Waiter",
        "Restaurant Manager",
        "System Manager"
    ])

    if not customer_name or not customer_name.strip():
        frappe.throw("Customer name is required.")

    if order_type not in ["Dine-in", "Takeaway", "Delivery"]:
        frappe.throw("Invalid order type.")

    items = frappe.parse_json(items)

    if not isinstance(items, list) or not items:
        frappe.throw("Please add food items to the order.")

    if flt(discount) < 0:
        frappe.throw("Discount cannot be negative.")

    order_items = []

    for item in items:

        food_item = item.get("food_item")
        quantity = flt(item.get("quantity"))

        if not food_item:
            frappe.throw("Food Item is required.")

        if quantity <= 0:
            frappe.throw("Quantity must be greater than zero.")

        order_items.append({
            "food_item": food_item,
            "quantity": quantity
        })

    order = frappe.get_doc({
        "doctype": "Restaurant Order",
        "customer_name": customer_name.strip(),
        "order_type": order_type,
        "order_date": getdate(),
        "discount": flt(discount),
        "items": order_items
    })

    # Insert the order in Draft state
    order.insert()

    # The Administrator account has no Restaurant Manager workflow role.
    # Keep its Desk-equivalent create behavior as Draft; restaurant managers
    # continue below and use the configured kitchen workflow transition.
    if frappe.session.user == "Administrator" or (
        "System Manager" in frappe.get_roles()
        and "Restaurant Manager" not in frappe.get_roles()
    ):
        return {
            "success": True,
            "draftOnly": True,
            "message": "Restaurant Order created successfully as Draft.",
            "order_id": order.name,
            "order_status": order.order_status,
            "grand_total": order.grand_total
        }

    # Workflow processing is a separate step from order creation. If it is
    # unavailable to this role, retain the validated order as a Draft rather
    # than rolling back the order that Desk-equivalent creation just saved.
    workflow_savepoint = "restaurant_order_before_workflow"
    frappe.db.savepoint(workflow_savepoint)
    try:
        transitions = get_transitions(order)
        preferred = next(
            (transition for transition in transitions
             if transition.action in ["Send to Kitchen", "Confirm"]),
            transitions[0] if transitions else None
        )
        if not preferred:
            return {
                "success": True,
                "draftOnly": True,
                "message": "Restaurant Order created successfully as Draft. No workflow approval action is available to this account.",
                "order_id": order.name,
                "order_status": order.order_status,
                "grand_total": order.grand_total
            }
        updated_order = apply_workflow(order, preferred.action)
    except Exception as exc:
        frappe.db.rollback(save_point=workflow_savepoint)
        order.reload()
        return {
            "success": True,
            "draftOnly": True,
            "message": "Restaurant Order created successfully as Draft. Workflow approval was not available: " + str(exc),
            "order_id": order.name,
            "order_status": order.order_status,
            "grand_total": order.grand_total
        }

    return {
        "success": True,
        "message": "Order successfully sent to kitchen.",
        "order_id": updated_order.name,
        "order_status": updated_order.order_status,
        "grand_total": updated_order.grand_total
    }


# ==================================================
# KITCHEN DASHBOARD APIs
# ==================================================


# ==================================================
# 7. GET ALL PENDING KITCHEN ORDERS
# ==================================================

@frappe.whitelist()
def get_kitchen_orders():

    check_restaurant_access([
        "Head Chef",
        "Restaurant Manager",
        "System Manager"
    ])

    # Kitchen access is granted to these explicit operational roles. Use the
    # fixed DocType query after that role gate so user-specific list filters
    # cannot hide kitchen tickets from Head Chef accounts.
    orders = frappe.get_all(
        "Restaurant Order",
        filters={
            "order_status": ["in", ["Pending Kitchen", "Confirmed"]],
            "docstatus": 1
        },
        fields=[
            "name",
            "customer_name",
            "order_type",
            "order_date",
            "grand_total",
            "order_status",
            "creation"
        ],
        order_by="creation asc"
    )

    return {
        "success": True,
        "message": "Kitchen orders retrieved successfully",
        "count": len(orders),
        "data": orders
    }


# ==================================================
# 8. GET INDIVIDUAL KITCHEN ORDER DETAILS
# ==================================================

@frappe.whitelist()
def get_kitchen_order_details(order_id=None):

    check_restaurant_access([
        "Head Chef",
        "Restaurant Manager",
        "System Manager"
    ])

    if not order_id or not order_id.strip():
        frappe.throw("Order ID is required.")

    order_id = order_id.strip()

    if not frappe.db.exists("Restaurant Order", order_id):
        frappe.throw(
            f"Restaurant Order {order_id} does not exist."
        )

    order = frappe.get_doc("Restaurant Order", order_id)

    if order.order_status not in [
        "Pending Kitchen",
        "Confirmed",
        "Completed"
    ]:
        frappe.throw("This order is not available in the kitchen.")

    return {
        "success": True,
        "message": "Kitchen order details retrieved successfully",
        "data": {
            "order_id": order.name,
            "customer_name": order.customer_name,
            "order_type": order.order_type,
            "order_date": order.order_date,
            "order_status": order.order_status,
            "items": [
                {
                    "food_item": row.food_item,
                    "food_item_name": frappe.db.get_value(
                        "Food Item", row.food_item, "item_name"
                    ) or row.food_item,
                    "quantity": row.quantity,
                    "rate": row.rate,
                    "amount": row.amount
                }
                for row in order.items
            ],
            "subtotal": order.subtotal,
            "tax_amount": order.tax_amount,
            "discount": order.discount,
            "grand_total": order.grand_total
        }
    }


# ==================================================
# COMMON KITCHEN WORKFLOW FUNCTION
# ==================================================

def process_kitchen_workflow(order_id, action):

    check_restaurant_access([
        "Head Chef",
        "Restaurant Manager",
        "System Manager"
    ])

    if not order_id or not order_id.strip():
        frappe.throw("Order ID is required.")

    order_id = order_id.strip()

    if not frappe.db.exists("Restaurant Order", order_id):
        frappe.throw(
            f"Restaurant Order {order_id} does not exist."
        )

    order = frappe.get_doc("Restaurant Order", order_id)

    if order.docstatus != 1:
        frappe.throw(
            "Only submitted orders can be processed by the kitchen."
        )

    allowed_actions = {
        "Pending Kitchen": ["Confirm", "Cancel"],
        "Confirmed": ["Complete", "Cancel"]
    }

    if action not in allowed_actions.get(order.order_status, []):
        frappe.throw(
            f"Action {action} is not allowed for "
            f"order status {order.order_status}."
        )

    updated_order = apply_workflow(order, action)

    return {
        "success": True,
        "message": f"Order {order_id} successfully processed.",
        "order_id": updated_order.name,
        "order_status": updated_order.order_status,
        "docstatus": updated_order.docstatus
    }


# ==================================================
# 9. CONFIRM KITCHEN ORDER
# ==================================================

@frappe.whitelist()
def confirm_kitchen_order(order_id=None):

    return process_kitchen_workflow(order_id, "Confirm")


# ==================================================
# 10. CANCEL KITCHEN ORDER
# ==================================================

@frappe.whitelist()
def cancel_kitchen_order(order_id=None):

    return process_kitchen_workflow(order_id, "Cancel")


# ==================================================
# 11. COMPLETE KITCHEN ORDER
# ==================================================

@frappe.whitelist()
def complete_kitchen_order(order_id=None):

    return process_kitchen_workflow(order_id, "Complete")


# ==================================================
# LOGIN DASHBOARD REDIRECTION
# ==================================================

@frappe.whitelist()
def get_dashboard_route():

    user = frappe.session.user

    if user == "Guest":
        frappe.throw("Please log in first.")

    roles = frappe.get_roles(user)

    if "Restaurant Manager" in roles or "System Manager" in roles:
        return {"route": "manager_service"}

    if "Head Chef" in roles:
        return {"route": "kitchen"}

    if "Waiter" in roles:
        return {"route": "waiter_service"}

    frappe.throw(
        "Your account does not have access to the restaurant application.",
        frappe.PermissionError
    )
