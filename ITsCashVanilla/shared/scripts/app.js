import { s, db, actor, user, role, page, esc, button, link, go, url, image, guard, setRefresh, toast, modal, workspaceForRole, iconButton } from "./core.js";
import { home, auth, hasPendingOtp } from "../../login/scripts/login.js";
import { openSettings } from "./settings.js";
import { bellIcon, studentNavigationIcons, overviewIcon, cashierNavigationIcons } from "./icons.js";
const menus = { student: [["overview", "◔", "Overview"], ["tuition", "▤", "Tuition Payments"], ["store", "♧", "Uniform Store"], ["cart", "▣", "Shopping Cart"], ["orders", "□", "My Purchase"], ["history", "▧", "Transaction History"], ["notices", "♧", "Notifications"], ["profile", "○", "My Account"]], cashier: [["overview", "◔", "Dashboard"], ["tickets", "▤", "Checkout Tickets"], ["tuition", "▤", "Tuition & Balances"], ["orders", "□", "Uniform Orders"], ["history", "▧", "Payment History"], ["notices", "♧", "Notifications"]], proware: [["overview", "◔", "Overview"], ["inventory", "▣", "Uniforms & Stock"], ["orders", "□", "Pickup Orders"]] };
const root = document.getElementById("app");
let roleModule;
const settingsIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.4 7.4 0 0 0-1.68-.97l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.38 2.65c-.61.25-1.17.59-1.68.97l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.05.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.52.39 1.07.72 1.68.97l.38 2.65c.04.24.24.42.5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.61-.25 1.17-.58 1.68-.97l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.1-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z\"/></svg>";
const signOutIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20 4 18V3l8 2v15ZM4 3h12v8M14 14l7 7M21 15v6h-6"/></svg>';

function confirmSignOut() {
  if (document.querySelector(".signout-dialog[open]")) return;
  let busy = false;
  const dialog = modal("Would you like to sign out?", `
    <p id="signout-description">You can sign back in whenever you need to.</p>
    <p class="signout-error" role="alert" hidden></p>
    <div class="signout-actions">${button("Cancel", () => dialog.close(), "signout-cancel")}${button("Sign out", async () => {
      if (busy) return;
      busy = true;
      const controls = [...dialog.querySelectorAll("button")];
      controls.forEach(control => control.disabled = true);
      const confirm = dialog.querySelector(".signout-confirm");
      confirm.textContent = "Signing out…";
      try {
        await s.signOut();
        dialog.close();
        go();
      } catch (error) {
        const message = dialog.querySelector(".signout-error");
        message.hidden = false;
        message.textContent = error.message || "Could not sign out. Please try again.";
      } finally {
        busy = false;
        controls.forEach(control => control.disabled = false);
        confirm.textContent = "Sign out";
      }
    }, "primary signout-confirm")}</div>`);
  dialog.classList.add("signout-dialog");
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-describedby", "signout-description");
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  dialog.querySelector(".signout-cancel").focus();
}
function render() {
  if (hasPendingOtp()) { auth(root); return; }
  if (!role) {
    if (user()) go(workspaceForRole(user().role), "overview");
    else home(root);
    return;
  }
  if (!guard()) {
    if (user()) go(workspaceForRole(user().role), "overview");
    else auth(root);
    return;
  }
  const actual = role === "student" && page === "profile" ? "overview" : role === "student" && page === "cart" ? "orders" : ["login", "register"].includes(page) ? "overview" : page;
  const list = menus[role].filter(([key]) => key !== "notices" && !(role === "student" && ["cart", "profile"].includes(key)));
  if (user()?.role === "Admin") list.push(["accounts", "○", "Accounts"]);
  const adminWorkspaceLink = user()?.role === "Admin"
    ? link(role === "cashier" ? "Proware workspace" : "Cashier workspace", role === "cashier" ? "proware" : "cashier", "overview") : "";
  const displayName = user()?.role === "Student" && user()?.username ? user().username : user()?.name || "Guest";
  const cartCount = role === "student" && user()?.role === "Student" ? (db().carts[actor()] || []).reduce((sum, line) => sum + line.qty, 0) : 0;
  const unread = db().notices.filter((n) => (role === "cashier" ? n.audience === "Cashier" : n.audience !== "Cashier" && n.studentNumber === user()?.studentNumber) && !(n.readBy || []).includes(actor())).length;
  const notificationControl = ["student", "cashier"].includes(role)
    ? iconButton(`Notifications${unread ? `, ${unread} unread` : ""}`, bellIcon + (unread ? `<span class="notification-count" aria-hidden="true">${unread > 99 ? "99+" : unread}</span>` : ""), () => go(role, "notices"), `notification-trigger${actual === "notices" ? " is-active" : ""}`) : "";
  root.innerHTML = `<div class="app-layout"><aside class="app-sidebar"><a class="app-brand" href="${url(role, "overview")}"><span class="sti-logo">STI</span><span><b>ITsCash</b><small>${role === "student" ? "CAMPUS PORTAL" : `${role.toUpperCase()} WORKSPACE`}</small></span></a><nav aria-label="${role} navigation">${list.map(([key, icon, label]) => `<a href="${url(role, key)}" class="${key === actual ? "active" : ""}" ${key === actual ? 'aria-current="page"' : ""}><span aria-hidden="true">${key === "overview" ? overviewIcon : role === "student" ? studentNavigationIcons[key] || esc(icon) : role === "cashier" ? cashierNavigationIcons[key] || esc(icon) : esc(icon)}</span>${label}${key === "orders" && role === "student" && cartCount > 0 ? `<i>${cartCount}</i>` : ""}${key === "notices" && unread > 0 ? `<i>${unread}</i>` : ""}</a>`).join("")}${adminWorkspaceLink}</nav><footer>${user()?.avatar ? `<img class="avatar" src="${esc(image(user().avatar))}" alt="Profile">` : `<span class="avatar">${esc(displayName[0] || "S")}</span>`}<div><strong>${esc(displayName)}</strong><small>${esc(user()?.studentNumber || user()?.role || "Browse the campus store")}</small></div>${user() ? iconButton("Settings", settingsIcon, openSettings, "settings-trigger") + iconButton("Sign out", signOutIcon, confirmSignOut, "signout-trigger") : link("Sign in", "student", "login")}</footer></aside><main class="app-main"><div class="workspace-note"><span>STI CAMPUS STORE</span><div class="workspace-tools"><span>${role === "proware" ? "Stock updates appear in the student store." : "Payment simulation &middot; No actual funds move."}</span>${notificationControl}</div></div><div id="page-content"></div></main></div>`;
  root.querySelector(".signout-trigger")?.setAttribute("aria-label", "Sign out");
  root.querySelector(".settings-trigger")?.setAttribute("aria-label", "Settings");
  root.querySelector(".settings-trigger")?.setAttribute("title", "Settings");
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
  if (role === "student" && page === "profile" && guard()) openSettings();
  window.addEventListener("storage", async (e) => {
    if (e.key === s.KEY) {
      const previousIds = new Set(db().notices.map(notice => notice.id));
      s.refresh();
      if (s.sqlBackend) await s.initializeAccounts();
      render();
      const activity = role === "cashier" && guard()
        ? db().notices.find(notice => notice.audience === "Cashier" && !previousIds.has(notice.id))
        : null;
      toast(activity ? `${activity.title}: ${activity.text}` : "Records refreshed from another tab.");
    }
  });
  window.addEventListener("pageshow", async (e) => {
    if (e.persisted) {
      s.refresh();
      if (s.sqlBackend) await s.initializeAccounts();
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
