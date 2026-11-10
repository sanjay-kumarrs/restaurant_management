
import frappe


def get_home_page(user):

    roles = frappe.get_roles(user)

    if "Restaurant Manager" in roles:
        return "manager_service"

    if "Head Chef" in roles:
        return "kitchen"

    if "Waiter" in roles:
        return "waiter_service"

    return "index"
