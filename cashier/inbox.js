const cashierBell = document.createElement("button");
cashierBell.type = "button";
cashierBell.className = "cash-inbox-button";
cashierBell.setAttribute("aria-expanded", "false");
cashierBell.setAttribute("aria-controls", "cashierInbox");
document.querySelector(".om-top > div:last-child").prepend(cashierBell);
manager.insertAdjacentHTML(
  "beforeend",
  '<section id="cashierInbox" class="cash-inbox-panel" aria-label="Cashier order notifications" hidden></section>',
);
document.body.insertAdjacentHTML(
  "beforeend",
  '<aside id="cashierLiveAlert" class="cash-live-alert" role="status" aria-live="polite" hidden></aside>',
);
const cashierKnownOrders = new Set(orders.map((o) => o.id));
function cashierInboxRefresh() {
  const pending = orders.filter((o) => !o.cashierViewedAt && o.status === "Pending");
  cashierBell.textContent = "🔔 Notifications (" + pending.length + ")";
  const box = document.getElementById("cashierInbox");
  box.innerHTML =
    "<h3>New student orders</h3>" +
    (pending.length
      ? pending
          .map(
            (o) =>
              `<button class="cash-inbox-item" data-ticket="${esc(o.id)}"><b>${esc(o.id)}</b><small>${esc(o.recipient)} · ${esc(o.studentNumber)}</small><small>${money(o.total)} · ${esc(o.payment)} · ${esc(cashTime(o.createdAt))}</small>View checkout ticket →</button>`,
          )
          .join("")
      : '<p class="om-note">No new student orders.</p>');
  box
    .querySelectorAll("[data-ticket]")
    .forEach((b) => (b.onclick = () => cashierOpenNotification(b.dataset.ticket)));
}
cashierBell.onclick = () => {
  const box = document.getElementById("cashierInbox");
  box.hidden = !box.hidden;
  cashierBell.setAttribute("aria-expanded", String(!box.hidden));
  cashierInboxRefresh();
};
function cashierOpenNotification(id) {
  document.getElementById("cashierInbox").hidden = true;
  cashierBell.setAttribute("aria-expanded", "false");
  document.getElementById("cashierLiveAlert").hidden = true;
  ticketShowCashier(id);
}
function cashierAlert(o) {
  if (!o) return;
  cashierInboxRefresh();
  if (manager.classList.contains("open")) {
    const a = document.getElementById("cashierLiveAlert");
    a.innerHTML = `<strong>New student order received</strong><p>${esc(o.recipient)} · ${esc(o.studentNumber)}</p><p><b>${esc(o.id)}</b><br>${money(o.total)} · ${esc(o.payment)}</p><button id="cashierAlertView">View ticket</button><button id="cashierAlertDismiss" class="dismiss">Dismiss</button>`;
    a.hidden = false;
    document.getElementById("cashierAlertView").onclick = () => cashierOpenNotification(o.id);
    document.getElementById("cashierAlertDismiss").onclick = () => (a.hidden = true);
  }
}
const notifyCashierPlaceOrder = placeOrder;
placeOrder = function (e) {
  const before = new Set(orders.map((o) => o.id));
  notifyCashierPlaceOrder(e);
  const o = orders.find((o) => !before.has(o.id));
  if (!o) return;
  cashierKnownOrders.add(o.id);
  cashierAlert(o);
  const slip = document.querySelector("#successContent .ticket-slip");
  if (slip)
    slip.insertAdjacentHTML(
      "beforeend",
      '<p style="color:#08754d;font-weight:700" role="status">✓ Cashier notified — your ticket is waiting for review.</p>',
    );
  toast("Order placed. Cashier notified.");
};
const notifyCashierRenderManager = renderOrderManager;
renderOrderManager = function () {
  notifyCashierRenderManager();
  cashierInboxRefresh();
};
const notifyCashierAcknowledge = ticketAcknowledge;
ticketAcknowledge = function () {
  notifyCashierAcknowledge();
  cashierInboxRefresh();
};
window.addEventListener("storage", (e) => {
  if (e.key !== "marketly_orders") return;
  const incoming = orders.filter((o) => !cashierKnownOrders.has(o.id));
  orders.forEach((o) => cashierKnownOrders.add(o.id));
  cashierInboxRefresh();
  if (incoming.length) cashierAlert(incoming[0]);
});
const notifyCashierOpen = openOrderManager;
openOrderManager = function () {
  notifyCashierOpen();
  cashierInboxRefresh();
};
const notifyCashierClose = closeOrderManager;
closeOrderManager = function () {
  notifyCashierClose();
  document.getElementById("cashierInbox").hidden = true;
  cashierBell.setAttribute("aria-expanded", "false");
  document.getElementById("cashierLiveAlert").hidden = true;
};
manageButton.onclick = openOrderManager;
document.getElementById("omSearch").oninput = renderOrderManager;
document.getElementById("omFilter").onchange = renderOrderManager;
cashierInboxRefresh();
