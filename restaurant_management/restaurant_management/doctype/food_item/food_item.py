# Copyright (c) 2026, Sanjay and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class FoodItem(Document):
    def validate(self):
        self.item_name = (self.item_name or "").strip()
        if not self.item_name:
            frappe.throw("Item Name is required.")
        if not self.category or not frappe.db.exists("Food Category", self.category):
            frappe.throw("Select a valid Food Category.")
        if flt(self.price) < 0:
            frappe.throw("Price cannot be negative.")
        if flt(self.tax_percentage) < 0:
            frappe.throw("Tax Percentage cannot be negative.")
