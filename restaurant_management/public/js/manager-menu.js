document.addEventListener("DOMContentLoaded", () => {
    const categories = [];
    const items = [];
    let categoryDoc = null;
    let itemDoc = null;
    const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const money = value => "₹" + (Number(value) || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
    const token = () => window.frappe?.csrf_token || window.csrf_token || window.getCookie?.("csrf_token") || "";
    const message = document.getElementById("manager-menu-message");
    function showMessage(text, error=false) { message.textContent = text || ""; message.classList.toggle("rh-error", Boolean(error)); }
    function unpackError(result, fallback) {
        let text = result?.message?.message || result?.message || result?._server_messages || fallback;
        if (typeof text !== "string") return fallback;
        try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) text = JSON.parse(parsed[0])?.message || text; } catch (_) {}
        return String(text).replace(/<[^>]*>/g, "").replace(/[\[\]"]/g, "").trim() || fallback;
    }
    async function call(url, values, method="GET") {
        const options = {method, credentials:"same-origin", headers:{Accept:"application/json"}};
        if (method !== "GET") {
            const csrf = token();
            options.headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
            if (csrf) options.headers["X-Frappe-CSRF-Token"] = csrf;
            options.body = new URLSearchParams({...values, ...(csrf ? {csrf_token:csrf} : {})});
        }
        const response = await fetch(url, options);
        const result = await response.json();
        if (!response.ok || result.exc) throw new Error(unpackError(result, "Frappe could not complete this request."));
        return result.message;
    }
    function listURL(doctype, fields, orderBy) {
        return "/api/method/frappe.client.get_list?" + new URLSearchParams({doctype, fields:JSON.stringify(fields), order_by:orderBy, limit_page_length:"500"});
    }
    function renderCategories() {
        const host = document.getElementById("category-list");
        document.getElementById("category-list-count").textContent = categories.length;
        const select = document.getElementById("food-item-category");
        const selected = select.value;
        select.innerHTML = '<option value="">Choose a category</option>' + categories.map(row => `<option value="${escapeHTML(row.name)}">${escapeHTML(row.category_name)}</option>`).join("");
        if (categories.some(row => row.name === selected)) select.value = selected;
        host.innerHTML = categories.length ? categories.map(row => `<div class="rh-managed-row"><div class="rh-managed-row-copy"><b>${escapeHTML(row.category_name)}</b><small>${escapeHTML(row.description || "No description")}</small></div><button type="button" class="rh-text-link" data-edit-category="${escapeHTML(row.name)}">Edit</button></div>`).join("") : '<div class="rh-empty">No categories yet. Add the first category above.</div>';
    }
    function renderItems() {
        const host = document.getElementById("food-item-list");
        const query = document.getElementById("manager-item-search").value.trim().toLowerCase();
        const byName = Object.fromEntries(categories.map(row => [row.name, row.category_name]));
        const filtered = items.filter(row => `${row.item_name} ${byName[row.category] || ""}`.toLowerCase().includes(query));
        document.getElementById("food-item-list-count").textContent = items.length;
        host.innerHTML = filtered.length ? filtered.map(row => `<div class="rh-managed-row rh-managed-food"><div class="rh-managed-row-copy"><b>${escapeHTML(row.item_name)}</b><small>${escapeHTML(byName[row.category] || "Uncategorized")} · ${money(row.price)} · ${Number(row.tax_percentage)||0}% tax</small></div><span class="rh-availability ${Number(row.availability) ? "is-available" : "is-unavailable"}">${Number(row.availability) ? "Available" : "Unavailable"}</span><button type="button" class="rh-text-link" data-edit-item="${escapeHTML(row.name)}">Edit</button></div>`).join("") : `<div class="rh-empty">${query ? "No items match your search." : "No menu items yet. Add the first dish above."}</div>`;
    }
    async function loadCatalogue() {
        showMessage("Loading menu records…");
        document.getElementById("category-list").innerHTML = '<div class="rh-empty">Loading categories…</div>';
        document.getElementById("food-item-list").innerHTML = '<div class="rh-empty">Loading menu items…</div>';
        try {
            const [categoryRows, itemRows] = await Promise.all([
                call(listURL("Food Category", ["name","category_name","description"], "category_name asc")),
                call(listURL("Food Item", ["name","item_name","category","price","tax_percentage","availability"], "item_name asc"))
            ]);
            categories.splice(0, categories.length, ...(categoryRows || []));
            items.splice(0, items.length, ...(itemRows || []));
            renderCategories(); renderItems(); showMessage(`${categories.length} categories · ${items.length} menu items`);
        } catch (error) {
            showMessage(error.message, true);
            document.getElementById("category-list").innerHTML = `<div class="rh-empty rh-error">${escapeHTML(error.message)}</div>`;
            document.getElementById("food-item-list").innerHTML = '<div class="rh-empty">Menu list is unavailable.</div>';
        }
    }
    function resetCategory() {
        categoryDoc = null;
        document.getElementById("category-form").reset();
        document.getElementById("category-name-id").value = "";
        document.getElementById("category-form-title").textContent = "Add a category";
        document.getElementById("category-save").textContent = "Save category";
        document.getElementById("category-reset").hidden = true;
    }
    function resetItem() {
        itemDoc = null;
        document.getElementById("food-item-form").reset();
        document.getElementById("food-item-id").value = "";
        document.getElementById("food-item-tax").value = "0";
        document.getElementById("food-item-available").checked = true;
        document.getElementById("item-form-title").textContent = "Add a menu item";
        document.getElementById("food-item-save").textContent = "Save menu item";
        document.getElementById("food-item-reset").hidden = true;
    }
    async function editCategory(name) {
        try {
            categoryDoc = categories.find(row => row.name === name);
            if (!categoryDoc) throw new Error("Category is no longer in the loaded list. Refresh the catalogue.");
            document.getElementById("category-name-id").value = categoryDoc.name;
            document.getElementById("category-name").value = categoryDoc.category_name || "";
            document.getElementById("category-description").value = categoryDoc.description || "";
            document.getElementById("category-form-title").textContent = "Edit category";
            document.getElementById("category-save").textContent = "Update category";
            document.getElementById("category-reset").hidden = false;
            document.getElementById("category-name").focus();
        } catch (error) { showMessage(error.message, true); }
    }
    async function editItem(name) {
        try {
            itemDoc = items.find(row => row.name === name);
            if (!itemDoc) throw new Error("Menu item is no longer in the loaded list. Refresh the catalogue.");
            document.getElementById("food-item-id").value = itemDoc.name;
            document.getElementById("food-item-name").value = itemDoc.item_name || "";
            document.getElementById("food-item-category").value = itemDoc.category || "";
            document.getElementById("food-item-price").value = Number(itemDoc.price) || 0;
            document.getElementById("food-item-tax").value = Number(itemDoc.tax_percentage) || 0;
            document.getElementById("food-item-available").checked = Boolean(Number(itemDoc.availability));
            document.getElementById("item-form-title").textContent = "Edit menu item";
            document.getElementById("food-item-save").textContent = "Update menu item";
            document.getElementById("food-item-reset").hidden = false;
            document.getElementById("food-item-name").focus();
        } catch (error) { showMessage(error.message, true); }
    }
    async function saveCategory(doc, existing) {
        return call("/api/method/restaurant_management.api.save_food_category", {
            category_name:doc.category_name,
            description:doc.description,
            ...(existing ? {name:categoryDoc.name} : {})
        }, "POST");
    }
    async function saveItem(doc, existing) {
        return call("/api/method/restaurant_management.api.save_food_item", {
            item_name:doc.item_name,
            category:doc.category,
            price:String(doc.price),
            tax_percentage:String(doc.tax_percentage),
            availability:String(doc.availability),
            ...(existing ? {name:itemDoc.name} : {})
        }, "POST");
    }
    document.getElementById("category-form").addEventListener("submit", async event => {
        event.preventDefault();
        const save = document.getElementById("category-save");
        const editing = Boolean(categoryDoc);
        const doc = {...(categoryDoc || {}), doctype:"Food Category", category_name:document.getElementById("category-name").value.trim(), description:document.getElementById("category-description").value.trim()};
        if (!doc.category_name) return;
        const normalizedName = doc.category_name.toLocaleLowerCase();
        const duplicate = categories.find(row => row.name !== categoryDoc?.name && String(row.category_name || "").trim().toLocaleLowerCase() === normalizedName);
        if (duplicate) {
            showMessage(`“${doc.category_name}” already exists. Choose a different category name.`, true);
            document.getElementById("category-name").focus();
            return;
        }
        save.disabled = true; save.textContent = editing ? "Updating…" : "Saving…";
        try { const saved = await saveCategory(doc, editing); resetCategory(); await loadCatalogue(); showMessage(`${saved.category_name} ${editing ? "updated" : "created"}.`); }
        catch (error) { showMessage(error.message, true); }
        finally { save.disabled = false; if (categoryDoc) save.textContent = "Update category"; else save.textContent = "Save category"; }
    });
    document.getElementById("food-item-form").addEventListener("submit", async event => {
        event.preventDefault();
        const save = document.getElementById("food-item-save");
        const editing = Boolean(itemDoc);
        const price = Number(document.getElementById("food-item-price").value);
        const tax = Number(document.getElementById("food-item-tax").value || 0);
        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(tax) || tax < 0) { showMessage("Enter a valid price and a tax percentage of zero or greater.", true); return; }
        const doc = {...(itemDoc || {}), doctype:"Food Item", item_name:document.getElementById("food-item-name").value.trim(), category:document.getElementById("food-item-category").value, price, tax_percentage:tax, availability:document.getElementById("food-item-available").checked ? 1 : 0};
        save.disabled = true; save.textContent = editing ? "Updating…" : "Saving…";
        try { const saved = await saveItem(doc, editing); resetItem(); await loadCatalogue(); showMessage(`${saved.item_name} ${editing ? "updated" : "created"}.`); }
        catch (error) { showMessage(error.message, true); }
        finally { save.disabled = false; if (itemDoc) save.textContent = "Update menu item"; else save.textContent = "Save menu item"; }
    });
    document.getElementById("category-list").addEventListener("click", event => { const button = event.target.closest("[data-edit-category]"); if (button) editCategory(button.dataset.editCategory); });
    document.getElementById("food-item-list").addEventListener("click", event => { const button = event.target.closest("[data-edit-item]"); if (button) editItem(button.dataset.editItem); });
    document.getElementById("category-reset").addEventListener("click", resetCategory);
    document.getElementById("food-item-reset").addEventListener("click", resetItem);
    document.getElementById("manager-item-search").addEventListener("input", renderItems);
    document.getElementById("manager-menu-refresh").addEventListener("click", loadCatalogue);
    document.getElementById("food-item-available").checked = true;
    loadCatalogue();
});
