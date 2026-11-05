import { s, db, esc, role, page, button, link, field, form, submit, act, go, url, contactFields } from "../../shared/scripts/core.js";
function home(target) {
  const roles = [["Student", "student", "Shop uniforms, view purchases, and manage your profile.", "⌂"], ["Cashier", "cashier", "Review checkout tickets and process student payments.", "▤"], ["Proware", "proware", "Manage uniform quantities and monitor stock availability.", "▣"]];
  target.innerHTML = `<main class="login-shell"><section class="login-brand" aria-label="ITsCash school portal"><a class="brand" href="${url()}"><span class="sti-logo">STI</span><span>ITsCash<span class="brand-caption">CAMPUS PAYMENT &amp; UNIFORM PORTAL</span></span></a><div class="brand-content"><span class="eyebrow">YOUR CAMPUS. CONNECTED.</span><h1>One place for<br>your campus<br>essentials.</h1><p>Manage student purchases, school payments, and uniform inventory with the account made for you.</p><div class="brand-tags"><span>Uniform orders</span><span>Tuition payments</span><span>Inventory</span></div></div><small>STI Campus Store · ITsCash</small></section><section class="login-panel" aria-labelledby="login-title"><span class="welcome-label">WELCOME BACK</span><h2 id="login-title">Log in to ITsCash</h2><p class="login-description">Choose your account to continue to sign in.</p><div class="role-options">${roles.map(([label, r, text, icon]) => `<a class="role-card" href="${url(r, "login")}"><span class="role-icon" aria-hidden="true">${icon}</span><span class="role-copy"><strong>${label}</strong><span>${text}</span><b>Log in as ${label}</b></span><span class="role-arrow" aria-hidden="true">→</span></a>`).join("")}</div><p class="create-account">New student? ${link("Create your student account", "student", "register")}</p><p class="login-footer">Use your assigned account for Cashier and Proware access.</p></section></main>`;
}
function auth(target) {
  const registration = role === "student" && page === "register";
  const setup = role !== "student" && !db().accounts.some((a) => ["Admin", role === "cashier" ? "Cashier" : "Proware"].includes(a.role) && a.active !== false);
  const registering = registration || setup;
  target.innerHTML = `<main class="auth-page"><a class="brand" href="${url()}"><span class="sti-logo">STI</span><b>ITsCash</b></a><section class="card auth-card"><span class="eyebrow">${esc(role.toUpperCase())} ACCESS</span><h1>${setup ? "Set up your Admin account" : registration ? "Create your student account" : "Welcome back"}</h1><p>${setup ? "This administrator can manage cashier and inventory access." : "Your campus essentials, together in one place."}</p>${form(field("Username", "username", "", "text", 'autocomplete="username" required pattern="[A-Za-z0-9._-]{3,50}"') + field("Password", "password", "", "password", `required minlength="8" autocomplete="${registering ? "new-password" : "current-password"}"`) + (registering ? field("Confirm password", "confirm", "", "password", 'required minlength="8" autocomplete="new-password"') + (registration ? field("Student number", "studentNumber", "", "text", "required") + contactFields(null) : field("Full name", "name", "", "text", "required")) : "") + submit(setup ? "Create Admin account" : registration ? "Create account" : "Sign in"), async (data) => {
    let result;
    if (registering) {
      if (data.password !== data.confirm) throw Error("Passwords do not match.");
      if (!confirm(setup ? "Create the first administrator account?" : "Create your student account with these details?")) return;
      result = await act(() => s.register({ ...data, password: void 0, confirm: void 0, role: setup ? "Admin" : "Student" }, data.password));
    } else result = await act(() => s.signIn(data.username, data.password, role));
    if (result.ok) {
      sessionStorage.setItem("itscash_vanilla_actor", result.value);
      go(role, "overview");
    }
  })}${role === "student" ? `<p>${link(registration ? "Already registered? Sign in" : "Create a student account", "student", registration ? "login" : "register")} · ${link("Browse uniforms", "student", "store")}</p>` : ""}</section><p class="auth-foot">Browser prototype · Payment outcomes are simulated. No money is transferred.</p></main>`;
}
export {
  auth,
  home
};
