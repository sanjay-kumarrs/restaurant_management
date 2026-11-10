document.addEventListener("DOMContentLoaded", () => {
    const API = "/api/method/restaurant_management.api.";
    const menu = document.getElementById("menu-container");
    const filters = document.getElementById("category-filter");
    const cartBox = document.getElementById("cart-items");
    const orderButton = document.getElementById("place-order");
    const state = {categories:[], items:[], cart:[], category:"all", search:"", orders:[]};
    const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const money = value => "₹" + (Number(value) || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
    const csrf = () => window.frappe?.csrf_token || window.csrf_token || window.getCookie?.("csrf_token") || "";
    function setMessage(id, value, error=false) {
        const node = document.getElementById(id);
        if (!node) return;
        node.textContent = value || "";
        node.classList.toggle("rh-error", Boolean(error));
    }
    function errorText(payload, fallback) {
        let value = payload?.message?.message || payload?.message || payload?._server_messages || fallback;
        if (typeof value !== "string") return fallback;
        try { const parsed = JSON.parse(value); value = Array.isArray(parsed) ? (JSON.parse(parsed[0])?.message || value) : value; } catch (_) {}
        return String(value).replace(/<[^>]*>/g, "").replace(/[\[\]"]/g, "").trim() || fallback;
    }
    async function getJSON(url) {
        const response = await fetch(url, {credentials:"same-origin", headers:{Accept:"application/json"}});
        const json = await response.json();
        if (!response.ok || json.exc) throw new Error(errorText(json, "Could not load data from Frappe."));
        return json.message;
    }
    async function postJSON(url, values) {
        const token = csrf();
        const body = new URLSearchParams({...values, ...(token ? {csrf_token:token} : {})});
        const response = await fetch(url, {method:"POST", credentials:"same-origin", headers:{Accept:"application/json", "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8", ...(token ? {"X-Frappe-CSRF-Token":token} : {})}, body});
        const json = await response.json();
        if (!response.ok || json.exc || json.message?.success === false) throw new Error(errorText(json, "Frappe could not save this order."));
        return json.message;
    }
    async function createRestaurantOrder(customer, orderType, discount) {
        return postJSON(API + "create_waiter_order", {
            customer_name:customer,
            order_type:orderType,
            discount:String(discount),
            items:JSON.stringify(state.cart.map(item => ({food_item:item.food_item, quantity:item.quantity})))
        });
    }

    function renderFilters() {
        const all = [{name:"all", category_name:"Everything"}, ...state.categories];
        filters.innerHTML = all.map(category => `<button type="button" class="rh-filter-chip ${state.category === category.name ? "is-active" : ""}" data-category="${escapeHTML(category.name)}">${escapeHTML(category.category_name)}</button>`).join("");
    }
    function renderMenu() {
        const query = state.search.trim().toLowerCase();
        const shown = state.items.filter(item => (state.category === "all" || item.category === state.category) && (!query || item.item_name.toLowerCase().includes(query)));
        if (!state.items.length) {
            menu.innerHTML = '<div class="rh-empty">There are no available dishes right now. Ask a manager to check menu availability.</div>';
            return;
        }
        if (!shown.length) { menu.innerHTML = '<div class="rh-empty">No dishes match this search. Try another name or category.</div>'; return; }
        const categoryNames = Object.fromEntries(state.categories.map(category => [category.name, category.category_name]));
        menu.innerHTML = shown.map((item, index) => `<article class="rh-menu-card" style="--menu-index:${index % 8}"><div class="rh-menu-card-art"><span>${escapeHTML((item.item_name || "*").trim().charAt(0).toUpperCase())}</span><small>${escapeHTML(categoryNames[item.category] || "FOODHUB MENU")}</small></div><div class="rh-menu-card-body"><div class="rh-menu-card-title"><h3>${escapeHTML(item.item_name)}</h3><span>${Number(item.tax_percentage) || 0}% tax</span></div><div class="rh-menu-card-bottom"><b>${money(item.price)}</b><button type="button" class="rh-add-item" data-add="${escapeHTML(item.name)}" aria-label="Add ${escapeHTML(item.item_name)} to order">＋ <span>Add</span></button></div></div></article>`).join("");
    }
    function computeTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax = state.cart.reduce((sum, item) => sum + item.price * item.quantity * item.tax / 100, 0);
        const discountInput = document.getElementById("discount");
        const discount = Number(discountInput.value) || 0;
        document.getElementById("subtotal").textContent = money(subtotal);
        document.getElementById("tax-amount").textContent = money(tax);
        document.getElementById("grand-total").textContent = money(subtotal + tax - Math.max(discount, 0));
        const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById("cart-count").textContent = `${count} ${count === 1 ? "item" : "items"}`;
        if (discount < 0 || discount > subtotal) setMessage("order-message", discount < 0 ? "Discount cannot be negative." : "Discount cannot exceed the subtotal.", true);
        else setMessage("order-message", "");
    }
    function renderCart() {
        if (!state.cart.length) {
            cartBox.innerHTML = '<div class="rh-cart-empty"><span>＋</span><b>Your order starts here</b><small>Add dishes from the menu to begin.</small></div>';
        } else {
            cartBox.innerHTML = state.cart.map(item => `<div class="rh-cart-row"><div class="rh-cart-row-info"><b>${escapeHTML(item.item_name)}</b><small>${money(item.price)} each</small></div><div class="rh-quantity-control"><button type="button" data-quantity="-1" data-item="${escapeHTML(item.food_item)}" aria-label="Decrease ${escapeHTML(item.item_name)}">−</button><span>${item.quantity}</span><button type="button" data-quantity="1" data-item="${escapeHTML(item.food_item)}" aria-label="Increase ${escapeHTML(item.item_name)}">＋</button></div><strong>${money(item.price * item.quantity)}</strong><button type="button" class="rh-remove-item" data-remove="${escapeHTML(item.food_item)}" aria-label="Remove ${escapeHTML(item.item_name)}">×</button></div>`).join("");
        }
        computeTotals();
    }
    function addItem(item) {
        const existing = state.cart.find(row => row.food_item === item.name);
        if (existing) existing.quantity += 1;
        else state.cart.push({food_item:item.name, item_name:item.item_name, price:Number(item.price)||0, tax:Number(item.tax_percentage)||0, quantity:1});
        renderCart();
        setMessage("order-message", `${item.item_name} added to the order.`);
    }
    async function loadMenu() {
        menu.innerHTML = '<div class="rh-empty">Loading available dishes…</div>';
        setMessage("menu-message", "Loading today’s menu…");
        try {
            const data = await getJSON(API + "get_waiter_menu");
            if (!data?.success) throw new Error(data?.message || "The waiter menu could not be loaded.");
            state.categories = data.categories || [];
            state.items = (data.food_items || []).filter(item => Number(item.availability ?? 1) === 1);
            document.getElementById("waiter-stat-menu").textContent = state.items.length;
            renderFilters(); renderMenu();
            setMessage("menu-message", `${state.items.length} available ${state.items.length === 1 ? "dish" : "dishes"} · Menu prices are current.`);
        } catch (error) {
            menu.innerHTML = `<div class="rh-empty rh-error">${escapeHTML(error.message)}<br><small>Check your waiter role and Food Item read permissions, then refresh.</small></div>`;
            setMessage("menu-message", "Unable to load the menu.", true);
        }
    }

    async function loadOrders() {
        const tbody = document.getElementById("waiter-orders");
        tbody.innerHTML = '<tr><td colspan="7" class="rh-empty">Loading your orders…</td></tr>';
        setMessage("orders-message", "");
        const params = new URLSearchParams({doctype:"Restaurant Order", fields:JSON.stringify(["name","customer_name","order_type","order_date","order_status","grand_total","creation"]), order_by:"creation desc", limit_page_length:"50"});
        try {
            state.orders = await getJSON("/api/method/frappe.client.get_list?" + params) || [];
            document.getElementById("waiter-stat-total").textContent = state.orders.length;
            document.getElementById("waiter-stat-pending").textContent = state.orders.filter(order => order.order_status === "Pending Kitchen").length;
            document.getElementById("waiter-order-count").textContent = state.orders.length;
            if (!state.orders.length) { tbody.innerHTML = '<tr><td colspan="7" class="rh-empty">No restaurant orders are visible yet. Create the first one from New order.</td></tr>'; return; }
            tbody.innerHTML = state.orders.map(order => `<tr><td>${escapeHTML(order.name)}</td><td>${escapeHTML(order.customer_name)}</td><td>${escapeHTML(order.order_type)}</td><td>${escapeHTML(order.order_date)}</td><td><span class="rh-status ${["Confirmed","Completed"].includes(order.order_status) ? "active" : ""}">${escapeHTML(order.order_status || "Draft")}</span></td><td>${money(order.grand_total)}</td><td><button type="button" class="rh-text-link" data-order-detail="${escapeHTML(order.name)}">Items ↗</button></td></tr>`).join("");
        } catch (error) {
            document.getElementById("waiter-stat-total").textContent = "—";
            document.getElementById("waiter-stat-pending").textContent = "—";
            document.getElementById("waiter-order-count").textContent = "!";
            tbody.innerHTML = `<tr><td colspan="7" class="rh-empty rh-error">${escapeHTML(error.message)}<br><small>Order list access follows your Restaurant Order read permission.</small></td></tr>`;
            setMessage("orders-message", "Could not retrieve existing orders.", true);
        }
    }
    async function showOrderDetail(orderId) {
        const box = document.getElementById("waiter-order-detail");
        box.hidden = false; box.innerHTML = '<div class="rh-empty">Loading order details…</div>';
        try {
            const data = await getJSON(API + "get_restaurant_order_details?order_id=" + encodeURIComponent(orderId));
            if (!data?.success) throw new Error(data?.message || "Could not load order details.");
            const order = data.data;
            box.innerHTML = `<div class="rh-detail-heading"><div><span class="rh-eyebrow">ORDER DETAILS</span><h3>${escapeHTML(order.name)} · ${escapeHTML(order.customer_name)}</h3><p>${escapeHTML(order.order_type)} · ${escapeHTML(order.order_date)} · ${escapeHTML(order.order_status || "Draft")}</p></div><button type="button" class="rh-button rh-button-outline" data-close-detail>Close</button></div><div class="rh-detail-lines">${(order.items || []).map(item => `<div><span>${escapeHTML(item.food_item)} × ${Number(item.quantity)||0}</span><b>${money(item.amount)}</b></div>`).join("") || "No item rows"}</div><div class="rh-detail-total"><span>Subtotal ${money(order.subtotal)} · Tax ${money(order.tax_amount)} · Discount ${money(order.discount)}</span><b>Total ${money(order.grand_total)}</b></div>`;
        } catch (error) { box.innerHTML = `<div class="rh-inline-message rh-error">${escapeHTML(error.message)}</div>`; }
        box.scrollIntoView({behavior:"smooth", block:"nearest"});
    }

    async function submitOrder() {
        const customer = document.getElementById("customer-name").value.trim();
        const discount = Number(document.getElementById("discount").value) || 0;
        const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (!customer) { setMessage("order-message", "Enter the customer name to continue.", true); document.getElementById("customer-name").focus(); return; }
        if (!state.cart.length) { setMessage("order-message", "Add at least one available dish.", true); return; }
        if (discount < 0 || discount > subtotal) { setMessage("order-message", "Discount must be between zero and the subtotal.", true); return; }
        orderButton.disabled = true; orderButton.innerHTML = 'Creating order <span class="rh-button-spinner"></span>';
        setMessage("order-message", "Saving the validated Restaurant Order…");
        try {
            const order = await createRestaurantOrder(customer, document.getElementById("order-type").value, discount);
            state.cart = [];
            document.getElementById("customer-name").value = "";
            document.getElementById("discount").value = "0";
            renderCart();
            setMessage("order-message", order.draftOnly ? `${order.order_id} was created and saved as Draft. ${order.message || order.workflowError || "It needs approval through the configured workflow."}` : `${order.order_id} sent through the workflow · ${order.order_status} · ${money(order.grand_total)}`);
            await loadOrders();
            activateView("existing-orders", false);
            setMessage("orders-message", order.draftOnly ? `${order.order_id} is saved as Draft and awaits an eligible workflow approval.` : `${order.order_id} was created and sent through the workflow · ${order.order_status || "Submitted"}`);
        } catch (error) {
            setMessage("order-message", error.message, true);
            await loadOrders();
        } finally {
            orderButton.innerHTML = 'Create restaurant order <span>→</span>';
            computeTotals();
        }
    }
    function activateView(view, refreshOrders=true) {
        const isNew = view === "new-order";
        document.getElementById("new-order-view").hidden = !isNew;
        document.getElementById("existing-orders-view").hidden = isNew;
        document.querySelectorAll(".rh-tab").forEach(tab => tab.classList.toggle("is-active", tab.dataset.view === view));
        if (!isNew && refreshOrders) loadOrders();
    }

    filters.addEventListener("click", event => {
        const button = event.target.closest("[data-category]"); if (!button) return;
        state.category = button.dataset.category; renderFilters(); renderMenu();
    });
    menu.addEventListener("click", event => {
        const button = event.target.closest("[data-add]"); if (!button) return;
        const item = state.items.find(row => row.name === button.dataset.add); if (item) addItem(item);
    });
    cartBox.addEventListener("click", event => {
        const quantityButton = event.target.closest("[data-quantity]");
        const removeButton = event.target.closest("[data-remove]");
        if (quantityButton) {
            const item = state.cart.find(row => row.food_item === quantityButton.dataset.item);
            if (item) item.quantity += Number(quantityButton.dataset.quantity);
            state.cart = state.cart.filter(row => row.quantity > 0); renderCart();
        }
        if (removeButton) { state.cart = state.cart.filter(row => row.food_item !== removeButton.dataset.remove); renderCart(); }
    });
    document.getElementById("waiter-menu-search").addEventListener("input", event => { state.search = event.target.value; renderMenu(); });
    document.getElementById("customer-name").addEventListener("input", computeTotals);
    document.getElementById("discount").addEventListener("input", computeTotals);
    orderButton.addEventListener("click", submitOrder);
    document.querySelectorAll(".rh-tab").forEach(tab => tab.addEventListener("click", () => activateView(tab.dataset.view)));
    document.getElementById("orders-refresh").addEventListener("click", loadOrders);
    document.getElementById("waiter-refresh").addEventListener("click", () => { loadMenu(); loadOrders(); });
    document.getElementById("waiter-orders").addEventListener("click", event => {
        const button = event.target.closest("[data-order-detail]"); if (button) showOrderDetail(button.dataset.orderDetail);
    });
    document.getElementById("waiter-order-detail").addEventListener("click", event => { if (event.target.closest("[data-close-detail]")) event.currentTarget.hidden = true; });
    document.addEventListener("keydown", event => { if (event.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) { event.preventDefault(); document.getElementById("waiter-menu-search").focus(); } });

    renderCart();
    loadMenu();
    loadOrders();
    window.setInterval(() => { if (!document.getElementById("existing-orders-view").hidden) loadOrders(); }, 60000);
});
