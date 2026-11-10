import frappe

def get_context(context):

    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/restaurant-login"
        raise frappe.Redirect

    roles = frappe.get_roles(frappe.session.user)
    context.show_frappe_desk = (
        frappe.session.user == "Administrator"
        or "Restaurant Manager" in roles
        or "System Manager" in roles
    )

    if not (
        "Restaurant Manager" in roles
        or "System Manager" in roles
    ):
        frappe.throw(
            "You are not authorized to access this page.",
            frappe.PermissionError
        )
