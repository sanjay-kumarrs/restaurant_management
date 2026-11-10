document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("restaurant-login-form");
    if (!form) return;
    const errorBox = document.getElementById("login-error");
    const button = document.getElementById("login-submit");
    const password = document.getElementById("password");
    const togglePassword = document.getElementById("toggle-password");
    togglePassword?.addEventListener("click", () => {
        const reveal = password.type === "password";
        password.type = reveal ? "text" : "password";
        togglePassword.textContent = reveal ? "Hide" : "Show";
        togglePassword.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        errorBox.textContent = "";
        button.disabled = true;
        button.innerHTML = "Signing in…";
        try {
            const loginResponse = await fetch("/api/method/login", {
                method:"POST", credentials:"same-origin",
                headers:{"Content-Type":"application/x-www-form-urlencoded"},
                body:new URLSearchParams({usr:document.getElementById("username").value.trim(), pwd:document.getElementById("password").value})
            });
            const loginData = await loginResponse.json();
            if (!loginResponse.ok || loginData.exc || loginData.message?.message === "Invalid Login") throw new Error("Those sign-in details didn’t match. Please try again.");
            const routeResponse = await fetch("/api/method/restaurant_management.api.get_dashboard_route", {credentials:"same-origin"});
            const routeData = await routeResponse.json();
            if (!routeResponse.ok || routeData.exc || !routeData.message?.route) throw new Error(routeData.message?.message || "This account does not have access to a restaurant workspace.");
            window.location.assign("/" + routeData.message.route);
        } catch (error) {
            errorBox.textContent = error.message || "Unable to sign in. Please try again.";
            button.disabled = false;
            button.innerHTML = 'Sign in <span>→</span>';
        }
    });
});
