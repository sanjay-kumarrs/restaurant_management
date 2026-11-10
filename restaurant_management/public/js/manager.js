document.addEventListener("DOMContentLoaded", () => {
    const api = "/api/method/restaurant_management.api.";
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateInput = document.getElementById("sales-date");
    dateInput.value = localDate;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const money = value => "₹" + (Number(value) || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
    let orders = [];
    async function read(url) {
        const response = await fetch(url, {credentials:"same-origin"});
        const json = await response.json();
        if (!response.ok || json.exc) throw new Error(json.message?.message || json._server_messages || "Could not load this information.");
        return json.message;
    }
    async function loadSales() {
        const result = document.getElementById("sales-result");
        const message = document.getElementById("sales-message");
        if (!dateInput.value) { message.textContent = "Choose a date to view sales."; message.classList.add("rh-error"); return; }
        message.textContent = "Loading sales…"; message.classList.remove("rh-error");
        try {
            const data = await read(api + "get_total_sales?order_date=" + encodeURIComponent(dateInput.value));
            result.innerHTML = `<strong>${money(data.total_sales)}</strong><span>${Number(data.completed_orders) || 0} completed ${(Number(data.completed_orders) || 0) === 1 ? "order" : "orders"} · ${esc(data.date)}</span>`;
            message.textContent = "Sales totals include completed orders only.";
        } catch (error) { result.innerHTML = '<strong>Unavailable</strong><span>Sales data could not be loaded.</span>'; message.textContent = error.message; message.classList.add("rh-error"); }
    }
    async function loadOrders() {
        const tbody = document.getElementById("manager-orders");
        const message = document.getElementById("manager-orders-message");
        try {
            const result = await read(api + "get_restaurant_orders");
            orders = result?.data || [];
            renderOrders();
            message.classList.remove("rh-error");
        } catch (error) { tbody.innerHTML = `<tr><td colspan="7" class="rh-empty rh-error">${esc(error.message)}</td></tr>`; message.textContent = "Order visibility follows your Frappe permissions."; message.classList.add("rh-error"); }
    }
    function renderOrders() {
        const tbody = document.getElementById("manager-orders");
        const query = document.getElementById("manager-order-search").value.trim().toLowerCase();
        const status = document.getElementById("manager-order-status").value;
        const message = document.getElementById("manager-orders-message");
        const rows = orders.filter(row => (!status || (row.order_status || "Draft") === status) && (!query || `${row.name} ${row.customer_name} ${row.order_type}`.toLowerCase().includes(query)));
        message.textContent = `${rows.length} of ${orders.length} orders shown.`;
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7" class="rh-empty">${orders.length ? "No orders match these filters." : "No orders are visible yet."}</td></tr>`; return; }
        tbody.innerHTML = rows.map(row => `<tr><td>${esc(row.name)}</td><td>${esc(row.customer_name)}</td><td>${esc(row.order_type)}</td><td>${esc(row.order_date)}</td><td><span class="rh-status ${["Confirmed","Completed"].includes(row.order_status) ? "active" : ""}">${esc(row.order_status || "Draft")}</span></td><td>${money(row.grand_total)}</td><td><a class="rh-text-link" href="/app/restaurant-order">Items ↗</a></td></tr>`).join("");
    }
    document.getElementById("load-sales").addEventListener("click", loadSales);
    dateInput.addEventListener("change", loadSales);
    document.getElementById("manager-order-search").addEventListener("input", renderOrders);
    document.getElementById("manager-order-status").addEventListener("change", renderOrders);
    document.getElementById("manager-orders-refresh").addEventListener("click", loadOrders);
    loadSales(); loadOrders();
});
