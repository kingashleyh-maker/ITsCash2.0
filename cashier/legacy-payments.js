// Campus cashier workflow: local prototype; cashier records received payments.
const cashStates = [
  "Pending",
  "Paid",
  "Completed",
  "Cancelled",
  "Awaiting Payment",
  "Ready for Pickup",
  "Claimed",
];
function cashBadge(s) {
  return `<span class="om-badge" data-status="${esc(s)}">${esc(s)}</span>`;
}
function cashTime(s) {
  return s ? new Date(s).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—";
}
function cashInfo(pairs) {
  return `<dl class="om-info">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v ?? "—")}</dd>`).join("")}</dl>`;
}
orders.forEach((o) => {
  o.status =
    {
      "Order placed": "Pending",
      Processing: "Pending",
      "Ready for pickup": "Paid",
      Complete: "Completed",
      Delivered: "Completed",
      Refunded: "Cancelled",
    }[o.status] || o.status;
  if (!cashStates.includes(o.status)) o.status = "Pending";
  o.paymentStatus = o.paymentStatus === "Paid" ? "Paid" : "Unpaid";
  o.payment = /Maya/i.test(o.payment) ? "Maya" : /GCash/i.test(o.payment) ? "GCash" : "Cash";
  o.yearLevel = o.yearLevel || o.section || "";
  o.email = o.email || o.customer || "";
});
uniformOrderList = function () {
  return orders;
};
document.getElementById("omFilter").innerHTML =
  '<option value="All">All orders</option>' +
  cashStates.map((s) => `<option>${s}</option>`).join("");
document.getElementById("omTitle").textContent = "ITs Cash · Campus cashier";
document.querySelector("#omTitle + small").textContent =
  "Student orders • Payment records • Receipts";
manageButton.textContent = "Open cashier";
document.querySelectorAll(".store-value strong").forEach((e) => {
  if (e.textContent.includes("Cash or GCash"))
    e.innerHTML = "Simple payments<br>Cash · GCash · Maya";
});
renderCheckout = function () {
  document.getElementById("checkoutContent").innerHTML =
    `<form id="checkoutForm"><div class="cash-checkout">CAMPUS PICKUP<b>Your campus essentials, ready to order.</b>Enter your student details. Pay at the cashier.</div><div class="cart-layout"><div><h4>Student information</h4><div class="formgrid">${[
      ["studentNumber", "Student Number", "text"],
      ["shipName", "Full Name", "text"],
      ["studentCourse", "Course / Program", "text"],
      ["studentEmail", "Email Address", "email"],
    ]
      .map(
        ([id, label, type]) =>
          `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" required maxlength="100" value="${id === "shipName" ? esc(currentUser?.name || "") : id === "studentEmail" ? esc(currentUser?.email || "") : ""}"></div>`,
      )
      .join(
        "",
      )}<div class="field"><label for="studentYear">Year Level</label><select id="studentYear" required><option value="">Choose year level</option>${["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Grade 11", "Grade 12"].map((s) => `<option>${s}</option>`).join("")}</select></div><div class="field"><label for="paymentMethod">Payment Method</label><select id="paymentMethod"><option>Cash</option><option>GCash</option><option>Maya</option></select></div></div><p class="small muted">Payment is recorded by staff after receipt. This browser prototype does not transfer money.</p></div><aside class="summary"><h4>Order details</h4>${cartLines()
      .map(
        (c) =>
          `<div class="sumline"><span>${esc(c.product.name)} × ${c.qty}<br><small>${money(c.product.price)} each</small></span><b>${money(c.product.price * c.qty)}</b></div>`,
      )
      .join(
        "",
      )}<div class="sumline"><span>Subtotal</span><b>${money(cartSubtotal())}</b></div><div class="sumline total"><span>Total Amount</span><b>${money(cartSubtotal())}</b></div><button class="primary" type="submit">Place order</button></aside></div></form>`;
  document.getElementById("checkoutForm").onsubmit = placeOrder;
};
placeOrder = function (e) {
  e.preventDefault();
  if (!e.target.reportValidity()) return;
  const lines = cartLines();
  if (!lines.length) return;
  const quantities = new Map();
  for (const l of lines) quantities.set(l.id, (quantities.get(l.id) || 0) + l.qty);
  for (const [id, q] of quantities) {
    const p = products.find((p) => p.id === id);
    if (!p || q > p.stock || q < 1) {
      toast("Please check stock and quantities.");
      return;
    }
  }
  for (const id of ["studentNumber", "shipName", "studentCourse"])
    if (!document.getElementById(id).value.trim()) {
      toast("Please complete all student fields.");
      return;
    }
  const now = new Date(),
    o = {
      id:
        "STI-" +
        now.getTime().toString(36).toUpperCase() +
        "-" +
        Math.random().toString(36).slice(2, 6).toUpperCase(),
      created: now.toLocaleString("en-PH"),
      createdAt: now.toISOString(),
      studentNumber: document.getElementById("studentNumber").value.trim(),
      recipient: document.getElementById("shipName").value.trim(),
      course: document.getElementById("studentCourse").value.trim(),
      yearLevel: document.getElementById("studentYear").value,
      email: document.getElementById("studentEmail").value.trim(),
      customer: document.getElementById("studentEmail").value.trim(),
      payment: document.getElementById("paymentMethod").value,
      subtotal: Math.round(cartSubtotal() * 100) / 100,
      total: Math.round(cartSubtotal() * 100) / 100,
      status: "Pending",
      paymentStatus: "Unpaid",
      amountReceived: 0,
      change: 0,
      referenceNumber: "",
      receiptNumber: "",
      items: lines.map((l) => ({
        id: l.id,
        name: l.product.name,
        qty: l.qty,
        price: l.product.price,
        size: l.size || "",
        image: l.product.image,
        seller: l.product.seller,
      })),
    };
  for (const [id, q] of quantities) products.find((p) => p.id === id).stock -= q;
  orders.unshift(o);
  cart = [];
  persist();
  updateHeader();
  renderProducts();
  closeModal("checkoutModal");
  document.getElementById("successContent").innerHTML =
    `<div class="cash-checkout">ORDER PLACED<b>${esc(o.id)}</b>Your order is pending payment.</div><p>${esc(o.recipient)} · ${esc(o.studentNumber)}</p><p>Total Amount: <b>${money(o.total)}</b> · ${esc(o.payment)}</p><button class="primary" onclick="closeModal('orderSuccessModal');openOrders()">View orders</button>`;
  openModal("orderSuccessModal");
};
renderOrderManager = function () {
  const q = document.getElementById("omSearch").value.toLowerCase().trim(),
    f = document.getElementById("omFilter").value,
    list = orders.filter(
      (o) =>
        (f === "All" || f === o.status) &&
        [o.id, o.recipient, o.studentNumber, o.course, o.email]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  if (!list.some((o) => o.id === omSelected)) omSelected = list[0]?.id || null;
  document.getElementById("omCount").textContent = list.length + " orders";
  document.getElementById("omList").innerHTML =
    list
      .map(
        (o) =>
          `<button class="om-ticket ${omSelected === o.id ? "selected" : ""}" data-order="${esc(o.id)}"><b>${esc(o.id)}</b><small>${esc(o.recipient)} · ${esc(o.studentNumber || "")}</small><small>${money(o.total)} · ${esc(o.payment)}</small>${cashBadge(o.status)}</button>`,
      )
      .join("") ||
    '<div class="om-empty">No orders found. Place an order in the campus store to get started.</div>';
  document.querySelectorAll(".om-ticket").forEach(
    (b) =>
      (b.onclick = () => {
        omSelected = b.dataset.order;
        renderOrderManager();
      }),
  );
  renderOrderDetail();
};
renderOrderDetail = function () {
  const el = document.getElementById("omDetail"),
    o = orders.find((x) => x.id === omSelected);
  const stats = `<div class="cash-stats"><div class="cash-stat"><small>Pending orders</small><b>${orders.filter((x) => x.status === "Pending").length}</b></div><div class="cash-stat"><small>Recorded payments</small><b>${money(orders.filter((x) => x.paymentStatus === "Paid").reduce((s, x) => s + x.total, 0))}</b></div><div class="cash-stat"><small>Completed orders</small><b>${orders.filter((x) => x.status === "Completed").length}</b></div></div>`;
  if (!o) {
    el.innerHTML =
      stats +
      '<div class="om-empty">Your cashier workspace is ready. Select an order to view details.</div>';
    return;
  }
  const paid = o.paymentStatus === "Paid",
    closed = o.status === "Cancelled" || o.status === "Completed",
    cashier = document.getElementById("omRole").value === "Cashier";
  el.innerHTML =
    stats +
    `<div class="om-heading"><div><h2>${esc(o.id)}</h2>${cashBadge(o.status)} ${cashBadge(o.paymentStatus)}<p class="om-sub">Order Date and Time · ${esc(o.createdAt ? cashTime(o.createdAt) : o.created)}</p></div><div><div class="om-sub">TOTAL AMOUNT</div><div class="om-total">${money(o.total)}</div></div></div><div class="om-grid"><section class="om-card"><h3>Student information</h3>${cashInfo(
      [
        ["Student Number", o.studentNumber],
        ["Full Name", o.recipient],
        ["Course / Program", o.course],
        ["Year Level", o.yearLevel],
        ["Email Address", o.email],
      ],
    )}</section><section class="om-card"><h3>Payment information</h3>${cashInfo([
      ["Payment Method", o.payment],
      ["Amount to Pay", money(o.total)],
      ["Amount Received", money(o.amountReceived || 0)],
      ["Change", o.payment === "Cash" ? money(o.change || 0) : "Not applicable"],
      ["Payment Status", o.paymentStatus],
      ["Payment Date and Time", cashTime(o.paidAt)],
      ["Reference Number", o.referenceNumber || "—"],
      ["Receipt Number", o.receiptNumber || "—"],
    ])}${paid ? '<button class="om-action" onclick="cashReceipt(omSelected)">Print receipt</button>' : ""}</section><section class="om-card om-wide"><h3>Order details</h3><div class="cash-table-wrap"><table class="cash-table"><thead><tr><th>Product Name</th><th>Product Quantity</th><th>Product Price</th><th>Line Total</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.price * i.qty)}</td></tr>`).join("")}</tbody></table></div><div class="cash-summary"><div><span>Subtotal</span><b>${money(o.subtotal)}</b></div><div><span>Total Amount</span><b>${money(o.total)}</b></div></div></section><section class="om-card"><h3>Record payment</h3>${cashier && !paid && !closed ? `<form id="cashPaymentForm"><label for="cashMethod">Payment Method</label><select id="cashMethod">${["Cash", "GCash", "Maya"].map((s) => `<option ${s === o.payment ? "selected" : ""}>${s}</option>`).join("")}</select><label for="cashReceived">Amount Received</label><input id="cashReceived" type="number" min="0" step="0.01" required value="${o.payment === "Cash" ? "" : o.total}"><div id="cashReferenceField"><label for="cashReference">Reference Number</label><input id="cashReference" maxlength="80"></div><p class="om-note" id="cashChange"></p><button class="om-action" type="submit">Confirm received payment</button><p class="om-note">Record only after cash or the wallet transfer is received.</p></form>` : `<p class="om-note">${paid ? "Payment has been recorded." : closed ? "This order is closed." : "Switch to the Cashier view to record payment."}</p>`}<p id="omNotice" class="om-notice" role="status"></p></section><section class="om-card"><h3>Order status</h3><p class="om-note">Complete the order after payment and pickup. Only unpaid pending orders can be cancelled.</p><button class="om-action" onclick="cashComplete()" ${!paid || closed ? "disabled" : ""}>Mark Completed</button><button class="om-action refund" onclick="cashCancel()" ${paid || closed ? "disabled" : ""}>Cancel order</button><label for="omNotes">Staff notes</label><textarea id="omNotes">${esc(o.staffNotes || "")}</textarea><button class="om-action" onclick="cashSaveNotes()">Save notes</button></section></div>`;
  if (document.getElementById("cashPaymentForm")) {
    document.getElementById("cashMethod").onchange = cashPaymentPreview;
    document.getElementById("cashReceived").oninput = cashPaymentPreview;
    document.getElementById("cashPaymentForm").onsubmit = cashRecordPayment;
    cashPaymentPreview();
  }
};
function cashPaymentPreview() {
  const cash = document.getElementById("cashMethod").value === "Cash",
    o = orders.find((x) => x.id === omSelected),
    r = Number(document.getElementById("cashReceived").value);
  document.getElementById("cashReferenceField").hidden = cash;
  document.getElementById("cashReference").required = !cash;
  document.getElementById("cashChange").textContent = cash
    ? "Change: " + money(Math.max(0, r - o.total))
    : "Wallet amount must equal the total amount.";
}
function cashRecordPayment(e) {
  e.preventDefault();
  const o = orders.find((x) => x.id === omSelected);
  if (
    !o ||
    o.paymentStatus === "Paid" ||
    o.status !== "Pending" ||
    document.getElementById("omRole").value !== "Cashier"
  )
    return;
  const method = document.getElementById("cashMethod").value,
    received = Math.round(Number(document.getElementById("cashReceived").value) * 100),
    total = Math.round(o.total * 100),
    ref = document.getElementById("cashReference").value.trim();
  if (!Number.isFinite(received) || received < total) {
    omMessage("Amount received must cover the total amount.");
    return;
  }
  if (method !== "Cash" && (received !== total || !ref)) {
    omMessage("Enter the exact wallet amount and reference number.");
    return;
  }
  if (
    method !== "Cash" &&
    orders.some(
      (x) =>
        x !== o &&
        x.payment === method &&
        x.referenceNumber === ref &&
        x.paymentStatus === "Paid",
    )
  ) {
    omMessage("This reference number is already recorded.");
    return;
  }
  Object.assign(o, {
    payment: method,
    amountReceived: received / 100,
    change: method === "Cash" ? (received - total) / 100 : 0,
    referenceNumber: method === "Cash" ? "" : ref,
    paymentStatus: "Paid",
    status: "Paid",
    paidAt: new Date().toISOString(),
    receiptNumber: "RCP-" + o.id,
  });
  persist();
  renderOrderManager();
  renderOrders();
  omMessage("Payment recorded. Receipt is ready.");
}
function cashComplete() {
  const o = orders.find((x) => x.id === omSelected);
  if (!o || o.paymentStatus !== "Paid" || o.status !== "Paid") return;
  o.status = "Completed";
  persist();
  renderOrderManager();
  renderOrders();
}
function cashCancel() {
  const o = orders.find((x) => x.id === omSelected);
  if (!o || o.paymentStatus === "Paid" || o.status !== "Pending") return;
  o.status = "Cancelled";
  o.items.forEach((i) => {
    const p = products.find((x) => x.id === i.id);
    if (p) p.stock += i.qty;
  });
  persist();
  renderProducts();
  renderOrderManager();
  renderOrders();
}
function cashSaveNotes() {
  const o = orders.find((x) => x.id === omSelected);
  if (o) {
    o.staffNotes = document.getElementById("omNotes").value.trim();
    persist();
    omMessage("Notes saved.");
  }
}
renderOrders = function () {
  document.getElementById("ordersContent").innerHTML =
    orders
      .map(
        (o) =>
          `<div class="order-card"><div class="order-top"><b>${esc(o.id)}</b>${cashBadge(o.status)}</div><p>${esc(o.recipient)} · ${esc(o.studentNumber || "")}</p><p class="small muted">${esc(o.created)} · ${esc(o.payment)} · ${esc(o.paymentStatus)}</p>${o.items.map((i) => `<div class="sumline"><span>${esc(i.name)} × ${i.qty}</span><b>${money(i.price * i.qty)}</b></div>`).join("")}<div class="sumline total"><span>Total Amount</span><b>${money(o.total)}</b></div>${o.paymentStatus === "Paid" ? `<button class="secondary" onclick="cashReceipt('${esc(o.id)}')">Print receipt</button>` : ""}</div>`,
      )
      .join("") || '<div class="empty">No orders yet.</div>';
};
function cashReceipt(id) {
  const o = orders.find((x) => x.id === id);
  if (!o || o.paymentStatus !== "Paid") return;
  const w = window.open("", "_blank", "width=760,height=800");
  if (!w) {
    toast("Allow popups to print your receipt.");
    return;
  }
  w.document.write(
    `<!doctype html><html><head><title>Receipt ${esc(o.receiptNumber)}</title><style>body{font:14px system-ui;max-width:680px;margin:40px auto;padding:24px;color:#162c40}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}dl{display:grid;grid-template-columns:180px 1fr;gap:9px}dd{margin:0}button{padding:12px;margin-top:20px}@media print{button{display:none}body{margin:0}}</style></head><body><h1>STI Campus Store</h1><p>Payment receipt · ${esc(o.receiptNumber)}</p>${cashInfo(
      [
        ["Order Number", o.id],
        ["Order Date and Time", o.created],
        ["Student Number", o.studentNumber],
        ["Full Name", o.recipient],
        ["Course / Program", o.course],
        ["Year Level", o.yearLevel],
        ["Email Address", o.email],
        ["Order Status", o.status],
      ],
    )}<table><thead><tr><th>Product Name</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.price * i.qty)}</td></tr>`).join("")}</tbody></table>${cashInfo(
      [
        ["Subtotal", money(o.subtotal)],
        ["Total Amount / Amount to Pay", money(o.total)],
        ["Payment Method", o.payment],
        ["Amount Received", money(o.amountReceived || 0)],
        ["Change", o.payment === "Cash" ? money(o.change || 0) : "Not applicable"],
        ["Payment Status", o.paymentStatus],
        ["Payment Date and Time", cashTime(o.paidAt)],
        ["Reference Number", o.referenceNumber || "Not applicable"],
      ],
    )}<p>Browser prototype payment record.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`,
  );
  w.document.close();
}
document.getElementById("omSearch").oninput = renderOrderManager;
document.getElementById("omFilter").onchange = renderOrderManager;
document.getElementById("omRole").onchange = renderOrderDetail;
persist();
