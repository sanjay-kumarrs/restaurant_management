# Copyright (c) 2026, Sanjay and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FoodCategory(Document):
    def validate(self):
        self.category_name = (self.category_name or "").strip()
        if not self.category_name:
            frappe.throw("Category Name is required.")

        normalized_name = self.category_name.casefold()
        duplicate = any(
            row.name != self.name
            and (row.category_name or "").strip().casefold() == normalized_name
            for row in frappe.get_all("Food Category", fields=["name", "category_name"])
        )
        if duplicate:
            frappe.throw("A Food Category with this name already exists.")
