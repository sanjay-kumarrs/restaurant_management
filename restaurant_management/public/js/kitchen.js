document.addEventListener("DOMContentLoaded", () => {
    const api = "/api/method/restaurant_management.api.";
    const board = document.getElementById("kitchen-orders");
    const message = document.getElementById("kitchen-message");
    const manager = document.querySelector("[data-restaurant-manager]")?.dataset.restaurantManager === "1";
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const money = value => "₹" + (Number(value) || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
    const setMessage = (text, error=false) => { message.textContent = text; message.classList.toggle("rh-error", error); };

    async function request(method, options={}) {
        const response = await fetch(api + method, {credentials:"same-origin", ...options});
        const result = await response.json();
        if (!response.ok || result.exc || result.message?.success === false) {
            throw new Error(result.message?.message || result._server_messages?.[0] || "The request could not be completed.");
        }
        return result.message;
    }
    function render(orders) {
        const pending = orders.filter(o => o.order_status === "Pending Kitchen").length;
        const active = orders.filter(o => o.order_status === "Confirmed").length;
        document.getElementById("kitchen-pending-count").textContent = pending;
        document.getElementById("kitchen-active-count").textContent = active;
        if (!orders.length) { board.innerHTML = '<div class="rh-empty">All caught up. New orders will appear here.</div>'; return; }
        board.innerHTML = orders.map(order => `<article class="rh-order-card"><div class="rh-order-card-top"><div><span class="rh-order-id">${esc(order.name)}</span><h3>${esc(order.customer_name)}</h3><span class="rh-order-meta">${esc(order.order_type)} · ${esc(order.order_date || "")}</span></div><span class="rh-status ${order.order_status === "Confirmed" ? "active" : ""}">${esc(order.order_status)}</span></div><div class="rh-order-lines" data-order-items="${esc(order.name)}"><div class="rh-order-line"><span>Loading items…</span></div></div><div class="rh-order-card-bottom"><strong>${money(order.grand_total)}</strong><div class="rh-order-actions">${order.order_status === "Pending Kitchen" ? `<button class="rh-button rh-button-primary" data-action="confirm" data-id="${esc(order.name)}">Start preparation</button>` : `<button class="rh-button rh-button-primary" data-action="complete" data-id="${esc(order.name)}">Mark complete</button>`}${manager ? `<button class="rh-button rh-button-danger" data-action="cancel" data-id="${esc(order.name)}" aria-label="Cancel ${esc(order.name)}">Cancel</button>` : ""}</div></div></article>`).join("");
        orders.forEach(loadItems);
    }
    async function loadItems(order) {
        try {
            const result = await request("get_kitchen_order_details?order_id=" + encodeURIComponent(order.name));
            const container = board.querySelector(`[data-order-items="${CSS.escape(order.name)}"]`);
            if (!container) return;
            let rows = result?.data?.items ?? result?.items ?? [];
            if (typeof rows === "string") { try { rows = JSON.parse(rows); } catch (_) { rows = []; } }
            if (!Array.isArray(rows)) rows = Object.values(rows || {});
            container.innerHTML = rows.map(row => {
                let foodName = row?.food_item_name || row?.item_name || row?.food_item || "";
                if (typeof foodName === "string" && foodName.trim().startsWith("[")) {
                    try { const parsed = JSON.parse(foodName); foodName = Array.isArray(parsed) ? (parsed[0]?.item_name || parsed[0]?.food_item_name || parsed[0]?.food_item || "") : foodName; } catch (_) {}
                }
                return `<div class="rh-order-line"><span>${esc(foodName || "Food item")}</span><span>× ${Number(row?.quantity) || 0}</span></div>`;
            }).join("") || '<div class="rh-order-line"><span>No item details returned</span></div>';
        } catch (error) { const container = board.querySelector(`[data-order-items="${CSS.escape(order.name)}"]`); if (container) container.innerHTML = `<div class="rh-order-line"><span>${esc(error.message)}</span></div>`; }
    }
    async function load() {
        board.innerHTML = '<div class="rh-empty">Loading the kitchen queue…</div>'; setMessage("");
        try { const result = await request("get_kitchen_orders"); render(result.data || []); }
        catch (error) { board.innerHTML = `<div class="rh-empty rh-error">${esc(error.message)}</div>`; setMessage("Check your access or refresh the page.", true); }
    }
    board.addEventListener("click", async event => {
        const button = event.target.closest("[data-action]"); if (!button) return;
        const {action, id} = button.dataset;
        if (action === "cancel" && !window.confirm(`Cancel order ${id}?`)) return;
        const endpoint = {confirm:"confirm_kitchen_order", complete:"complete_kitchen_order", cancel:"cancel_kitchen_order"}[action];
        button.disabled = true; button.textContent = "Updating…";
        try { const form = new URLSearchParams({order_id:id}); const result = await request(endpoint, {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded", "X-Frappe-CSRF-Token":window.getCookie("csrf_token")}, body:form}); setMessage(`${result.order_id} updated · ${result.order_status}`); await load(); }
        catch (error) { setMessage(error.message, true); button.disabled = false; button.textContent = action === "confirm" ? "Start preparation" : action === "complete" ? "Mark complete" : "Cancel"; }
    });
    document.getElementById("refresh-kitchen").addEventListener("click", load);
    load();
    window.setInterval(load, 45000);
});
