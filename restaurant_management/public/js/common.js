window.getCookie = function(name) {
    const prefix = name + "=";
    const cookie = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
    if (!cookie) return "";
    try { return decodeURIComponent(cookie.slice(prefix.length)); }
    catch (_) { return cookie.slice(prefix.length); }
};

window.restaurantLogout = async function() {
    const buttons = document.querySelectorAll("[data-restaurant-logout]");
    buttons.forEach(button => { button.disabled = true; button.textContent = "Signing out…"; });
    try {
        const token = window.frappe?.csrf_token || window.csrf_token ||
            document.querySelector('meta[name="csrf-token"]')?.content ||
            window.getCookie("csrf_token");
        const body = new URLSearchParams();
        if (token) body.set("csrf_token", token);

        const response = await fetch("/api/method/logout", {
            method:"POST", credentials:"same-origin",
            headers:{
                "Accept":"application/json",
                "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8",
                ...(token ? {"X-Frappe-CSRF-Token":token} : {})
            },
            body
        });
        let result = {};
        try { result = await response.json(); } catch (_) { /* Frappe may return a redirect response. */ }
        if (!response.ok || result.exc) {
            const detail = result._server_messages || result.message;
            throw new Error(typeof detail === "string" ? detail : "Could not sign out. Please try again.");
        }
        window.location.replace("/restaurant-login");
    } catch (error) {
        buttons.forEach(button => { button.disabled = false; button.textContent = "Sign out"; });
        window.alert(error.message || "Could not sign out. Please try again.");
    }
};

document.addEventListener("click", event => {
    const button = event.target.closest("[data-restaurant-logout]");
    if (!button) return;
    event.preventDefault();
    window.restaurantLogout();
});
