function ticketNewCount() {
  return orders.filter((o) => !o.cashierViewedAt && o.status === "Pending").length;
}
const ticketEntry = document.createElement("button");
ticketEntry.type = "button";
ticketEntry.className = "cash-ticket-link";
ticketEntry.onclick = () => {
  document.getElementById("omSearch").value = "";
  document.getElementById("omFilter").value = "All";
  openOrderManager();
};
document.querySelector(".topbar-tools").prepend(ticketEntry);
function ticketUpdateCount() {
  const n = ticketNewCount();
  ticketEntry.innerHTML = "Cashier tickets <small>" + n + "</small>";
  manageButton.textContent = "Cashier · " + n + " new tickets";
}
const ticketRenderManager = renderOrderManager;
renderOrderManager = function () {
  ticketRenderManager();
  document.querySelectorAll(".om-ticket").forEach((b) => {
    const o = orders.find((x) => x.id === b.dataset.order);
    if (o && !o.cashierViewedAt && o.status === "Pending")
      b.insertAdjacentHTML("beforeend", '<span class="ticket-new">NEW</span>');
  });
  ticketUpdateCount();
};
const ticketRenderDetail = renderOrderDetail;
renderOrderDetail = function () {
  ticketRenderDetail();
  const o = orders.find((x) => x.id === omSelected);
  if (!o) return;
  document
    .getElementById("omDetail")
    .insertAdjacentHTML(
      "afterbegin",
      `<div class="ticket-alert">Checkout ticket · ${esc(o.id)} ${!o.cashierViewedAt ? '<button class="om-action" onclick="ticketAcknowledge()">Acknowledge ticket</button>' : "· Reviewed " + esc(cashTime(o.cashierViewedAt))}</div>`,
    );
};
function ticketAcknowledge() {
  const o = orders.find((x) => x.id === omSelected);
  if (!o) return;
  o.cashierViewedAt = new Date().toISOString();
  persist();
  renderOrderManager();
}
const ticketPlaceOrder = placeOrder;
placeOrder = function (e) {
  const before = orders.length;
  ticketPlaceOrder(e);
  if (orders.length === before) return;
  const o = orders[0];
  o.ticketCreatedAt = o.createdAt;
  notifications.unshift({
    id: Date.now(),
    icon: "▤",
    title: "New checkout ticket",
    message: `${o.id} · ${o.recipient} · ${money(o.total)} is waiting in the cashier queue.`,
    time: "Just now",
    read: false,
  });
  persist();
  updateHeader();
  ticketUpdateCount();
  document.getElementById("successContent").innerHTML =
    `<article class="ticket-slip"><div class="small">STI CAMPUS STORE · CHECKOUT TICKET</div><h2>${esc(o.id)}</h2><p>Your order has been sent to the cashier queue. Show this ticket when paying.</p><dl><dt>Student Number</dt><dd>${esc(o.studentNumber)}</dd><dt>Full Name</dt><dd>${esc(o.recipient)}</dd><dt>Course / Program</dt><dd>${esc(o.course)}</dd><dt>Year Level</dt><dd>${esc(o.yearLevel)}</dd><dt>Email Address</dt><dd>${esc(o.email)}</dd><dt>Order Date</dt><dd>${esc(cashTime(o.createdAt))}</dd><dt>Payment Method</dt><dd>${esc(o.payment)}</dd><dt>Status</dt><dd>Pending · Unpaid</dd></dl>${o.items.map((i) => `<div class="sumline"><span>${esc(i.name)} × ${i.qty}</span><b>${money(i.price * i.qty)}</b></div>`).join("")}<div class="sumline total"><span>Total Amount</span><b>${money(o.total)}</b></div></article><div class="modal-actions"><button class="secondary" onclick="closeModal('orderSuccessModal');openOrders()">My orders</button><button class="primary" onclick="ticketShowCashier('${esc(o.id)}')">View ticket in cashier</button></div>`;
  if (manager.classList.contains("open")) renderOrderManager();
};
function ticketShowCashier(id) {
  closeModal("orderSuccessModal");
  document.getElementById("omSearch").value = "";
  document.getElementById("omFilter").value = "All";
  document.getElementById("omRole").value = "Cashier";
  omSelected = id;
  openOrderManager();
}
// Synchronize shop and cashier tabs when this file is served from the same origin.
window.addEventListener("storage", (e) => {
  if (!e.key?.startsWith("marketly_")) return;
  orders = load("marketly_orders", []);
  products = load("marketly_products", products);
  notifications = load("marketly_notifications", []);
  cart = load("marketly_cart", []);
  saved = load("marketly_saved", []);
  updateHeader();
  ticketUpdateCount();
  renderProducts();
  if (manager.classList.contains("open")) renderOrderManager();
  if (document.getElementById("ordersModal").classList.contains("show")) renderOrders();
});
document.getElementById("omSearch").oninput = renderOrderManager;
document.getElementById("omFilter").onchange = renderOrderManager;
document.getElementById("omRole").onchange = renderOrderDetail;
ticketUpdateCount();
