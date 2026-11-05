import { s, db, actor, user, role, page, esc, button, link, go, url, image, guard, setRefresh, toast } from "./core.js";
import { home, auth } from "../../login/scripts/login.js";
const menus = { student: [["overview", "◔", "Overview"], ["tuition", "▤", "Tuition Payments"], ["store", "♧", "Uniform Store"], ["cart", "▣", "Shopping Cart"], ["orders", "□", "My Purchase"], ["history", "▧", "Transaction History"], ["notices", "♧", "Notifications"], ["profile", "○", "My Account"]], cashier: [["overview", "◔", "Dashboard"], ["tickets", "▤", "Checkout Tickets"], ["tuition", "▤", "Tuition & Balances"], ["orders", "□", "Uniform Orders"], ["history", "▧", "Payment History"], ["notices", "♧", "Notifications"]], proware: [["overview", "◔", "Overview"], ["inventory", "▣", "Uniforms & Stock"], ["orders", "□", "Pickup Orders"]] };
const root = document.getElementById("app");
let roleModule;
function render() {
  if (!role) {
    home(root);
    return;
  }
  const guest = role === "student" && ["store", "orders"].includes(page) && !user();
  if (!guard() && !guest) {
    auth(root);
    return;
  }
  const actual = ["login", "register"].includes(page) ? "overview" : page;
  const list = [...menus[role]];
  if (user()?.role === "Admin") list.push(["accounts", "○", "Accounts"]);
  const cartCount = role === "student" && user()?.role === "Student" ? (db().carts[actor()] || []).reduce((sum, line) => sum + line.qty, 0) : 0;
  const unread = db().notices.filter((n) => n.studentNumber === user()?.studentNumber && !(n.readBy || []).includes(actor())).length;
  root.innerHTML = `<div class="app-layout"><aside class="app-sidebar"><a class="app-brand" href="${url(role, "overview")}"><span class="sti-logo">STI</span><span><b>ITsCash</b><small>${role === "student" ? "CAMPUS PORTAL" : `${role.toUpperCase()} WORKSPACE`}</small></span></a><nav aria-label="${role} navigation">${list.map(([key, icon, label]) => `<a href="${url(role, key)}" class="${key === actual ? "active" : ""}" ${key === actual ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${label}${key === "cart" && cartCount > 0 ? `<i>${cartCount}</i>` : ""}${key === "notices" && unread > 0 ? `<i>${unread}</i>` : ""}</a>`).join("")}</nav><footer>${user()?.avatar ? `<img class="avatar" src="${esc(image(user().avatar))}" alt="Profile">` : `<span class="avatar">${esc(user()?.name?.[0] || "S")}</span>`}<div><strong>${esc(user()?.name || "Guest")}</strong><small>${esc(user()?.studentNumber || user()?.role || "Browse the campus store")}</small></div>${user() ? button("↪", () => {
    if (confirm("Would you like to sign out?")) {
      sessionStorage.removeItem("itscash_vanilla_actor");
      go();
    }
  }) : link("Sign in", "student", "login")}</footer></aside><main class="app-main"><div class="workspace-note"><span>STI CAMPUS STORE</span><span>${role === "proware" ? "Stock updates appear in the student store." : "Payment simulation · No actual funds move."}</span></div><div id="page-content"></div></main></div>`;
  const target = root.querySelector("#page-content");
  if (actual === "accounts" && user()?.role !== "Admin") {
    target.innerHTML = '<p role="alert">Only administrators can manage accounts.</p>';
    return;
  }
  roleModule.render(target, actual);
}
async function start() {
  await s.initializeAccounts();
  if (role) roleModule = await import(new URL(`${role}/scripts/${role}.js`, new URL("../../", import.meta.url)));
  setRefresh(render);
  render();
  window.addEventListener("storage", (e) => {
    if (e.key === s.KEY) {
      s.refresh();
      render();
      toast("Records refreshed from another tab.");
    }
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      s.refresh();
      render();
    }
  });
}
start().catch((error) => {
  root.replaceChildren();
  const main = document.createElement("main");
  main.className = "auth-page";
  const card = document.createElement("section");
  card.className = "card";
  const h = document.createElement("h1");
  h.textContent = "ITsCash could not start";
  const p = document.createElement("p");
  p.textContent = error.message;
  const note = document.createElement("p");
  note.textContent = "Your existing records have not been cleared. Open this folder through Live Server and reload.";
  card.append(h, p, note);
  main.append(card);
  root.append(main);
});
