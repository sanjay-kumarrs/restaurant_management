
frappe.ui.form.on('Restaurant Order', {

    // 1. Refresh event
    refresh: function(frm) {

        calculate_totals(frm);

        // Generate Bill button for saved orders
        if (!frm.is_new()) {

            frm.add_custom_button('Generate Bill', function() {
                generate_bill(frm);
            });

        }
    },


    // 2. Validate Order Date
    order_date: function(frm) {

        if (frm.doc.order_date) {

            let today = frappe.datetime.get_today();

            if (frm.doc.order_date > today) {

                frappe.msgprint({
                    title: "Invalid Order Date",
                    message: "Order Date cannot be a future date.",
                    indicator: "red"
                });

                frm.set_value('order_date', today);
            }
        }
    },


    // 3. Recalculate when Discount changes
    discount: function(frm) {

        let discount = flt(frm.doc.discount);

        if (discount < 0) {

            frappe.msgprint("Discount cannot be negative.");

            frm.set_value('discount', 0);
            return;
        }

        let subtotal = 0;

        (frm.doc.items || []).forEach(row => {
            subtotal += flt(row.quantity) * flt(row.rate);
        });

        if (discount > subtotal) {

            frappe.msgprint(
                "Discount cannot exceed the subtotal."
            );

            frm.set_value('discount', 0);
            return;
        }

        calculate_totals(frm);
    },


    // 4. Validate before saving
    validate: function(frm) {

        // Check Customer Name
        if (!frm.doc.customer_name) {
            frappe.throw("Please enter Customer Name.");
        }

        // Check Order Type
        if (!frm.doc.order_type) {
            frappe.throw("Please select Order Type.");
        }

        // Check Order Date
        if (!frm.doc.order_date) {
            frappe.throw("Please select Order Date.");
        }

        if (frm.doc.order_date > frappe.datetime.get_today()) {
            frappe.throw("Order Date cannot be a future date.");
        }

        // Check whether items exist
        if (!frm.doc.items || frm.doc.items.length === 0) {
            frappe.throw("Please add at least one food item.");
        }

        // Validate each order item
        for (let row of frm.doc.items) {

            if (!row.food_item) {
                frappe.throw("Please select a Food Item.");
            }

            if (flt(row.quantity) <= 0) {
                frappe.throw(
                    "Quantity must be greater than zero."
                );
            }

            if (flt(row.rate) < 0) {
                frappe.throw("Rate cannot be negative.");
            }

            if (flt(row.tax_percentage) < 0) {
                frappe.throw("Tax Percentage cannot be negative.");
            }
        }

        // Calculate subtotal
        let subtotal = 0;

        (frm.doc.items || []).forEach(row => {
            subtotal += flt(row.quantity) * flt(row.rate);
        });

        // Validate discount
        if (flt(frm.doc.discount) < 0) {
            frappe.throw("Discount cannot be negative.");
        }

        if (flt(frm.doc.discount) > subtotal) {
            frappe.throw("Discount cannot exceed subtotal.");
        }

        calculate_totals(frm);
    },


    // 5. Recalculate when rows are added
    items_add: function(frm) {
        calculate_totals(frm);
    },


    // 6. Recalculate when rows are removed
    items_remove: function(frm) {
        calculate_totals(frm);
    }

});


// CHILD TABLE EVENTS
frappe.ui.form.on('Order Item', {

    // 7. Fetch Food Item details
    food_item: async function(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.food_item) {

            await frappe.model.set_value(cdt, cdn, 'rate', 0);
            await frappe.model.set_value(cdt, cdn, 'tax_percentage', 0);
            await frappe.model.set_value(cdt, cdn, 'amount', 0);

            calculate_totals(frm);
            return;
        }

        // Fetch price, tax and availability
        let result = await frappe.db.get_value(
            'Food Item',
            row.food_item,
            ['price', 'tax_percentage', 'availability']
        );

        if (!result.message) {

            frappe.msgprint(
                "Food Item details could not be fetched."
            );

            return;
        }

        let item = result.message;

        // Check item availability
        if (!item.availability) {

            frappe.msgprint({
                title: "Item Unavailable",
                message: "This food item is currently unavailable.",
                indicator: "red"
            });

            await frappe.model.set_value(cdt, cdn, 'food_item', '');
            await frappe.model.set_value(cdt, cdn, 'rate', 0);
            await frappe.model.set_value(cdt, cdn, 'tax_percentage', 0);
            await frappe.model.set_value(cdt, cdn, 'amount', 0);

            calculate_totals(frm);
            return;
        }

        // Populate Rate from Food Item
        await frappe.model.set_value(
            cdt, cdn, 'rate', item.price
        );

        // Populate Tax Percentage from Food Item
        await frappe.model.set_value(
            cdt, cdn, 'tax_percentage', item.tax_percentage
        );

        calculate_row(frm, cdt, cdn);
    },


    // 8. Validate Quantity changes
    quantity: function(frm, cdt, cdn) {

        calculate_row(frm, cdt, cdn);
    },


    // 9. Recalculate when Rate changes
    rate: function(frm, cdt, cdn) {

        calculate_row(frm, cdt, cdn);
    }

});


// 10. Calculate individual row Amount
function calculate_row(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    // Quantity validation
    if (flt(row.quantity) <= 0) {

        frappe.msgprint(
            "Quantity must be greater than zero."
        );

        frappe.model.set_value(
            cdt, cdn, 'quantity', 1
        );

        return;
    }

    // Rate validation
    if (flt(row.rate) < 0) {

        frappe.msgprint(
            "Rate cannot be negative."
        );

        frappe.model.set_value(
            cdt, cdn, 'rate', 0
        );

        return;
    }

    // Amount = Quantity × Rate
    let amount = flt(row.quantity) * flt(row.rate);

    frappe.model.set_value(
        cdt, cdn, 'amount', amount
    );

    calculate_totals(frm);
}


// 11. Calculate Subtotal, Tax and Grand Total
function calculate_totals(frm) {

    let subtotal = 0;
    let tax_amount = 0;

    (frm.doc.items || []).forEach(row => {

        let quantity = flt(row.quantity);
        let rate = flt(row.rate);
        let tax_percentage = flt(row.tax_percentage);

        let amount = quantity * rate;

        subtotal += amount;

        // Tax = Amount × Tax Percentage / 100
        tax_amount += (
            amount * tax_percentage / 100
        );

    });

    let discount = flt(frm.doc.discount);

    // Grand Total = Subtotal + Tax - Discount
    let grand_total = subtotal + tax_amount - discount;

    frm.doc.subtotal = subtotal;
    frm.doc.tax_amount = tax_amount;
    frm.doc.grand_total = grand_total;

    frm.refresh_field('subtotal');
    frm.refresh_field('tax_amount');
    frm.refresh_field('grand_total');
}


// 12. Generate Bill
function generate_bill(frm) {

    let rows = (frm.doc.items || []).map(row => {

        return `
            <tr>
                <td>${frappe.utils.escape_html(row.food_item || '')}</td>
                <td>${flt(row.quantity)}</td>
                <td>${format_currency(row.rate)}</td>
                <td>${format_currency(row.amount)}</td>
            </tr>
        `;

    }).join('');

    let bill = `
        <h3>Restaurant Bill</h3>

        <p><b>Order ID:</b>
        ${frappe.utils.escape_html(frm.doc.name)}</p>

        <p><b>Customer:</b>
        ${frappe.utils.escape_html(frm.doc.customer_name || '')}</p>

        <p><b>Order Type:</b>
        ${frappe.utils.escape_html(frm.doc.order_type || '')}</p>

        <p><b>Order Date:</b>
        ${frappe.utils.escape_html(frm.doc.order_date || '')}</p>

        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Food Item</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>

        <hr>

        <p><b>Subtotal:</b>
        ${format_currency(frm.doc.subtotal)}</p>

        <p><b>Tax:</b>
        ${format_currency(frm.doc.tax_amount)}</p>

        <p><b>Discount:</b>
        ${format_currency(frm.doc.discount)}</p>

        <h3>Grand Total:
        ${format_currency(frm.doc.grand_total)}</h3>
    `;

    frappe.msgprint({
        title: "Restaurant Bill",
        message: bill,
        wide: true
    });
}
