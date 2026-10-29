let omSelected = null,
  omFocus = null;
const manager = document.getElementById("orderManager");
const manageButton = document.createElement("button");
manageButton.type = "button";
manageButton.textContent = "Staff · Manage orders";
manageButton.onclick = openOrderManager;
// Removed duplicate cashier shortcut; use the workspace navigation.
function uniformOrderList() {
  return orders.filter((o) =>
    o.items.some(
      (i) =>
        i.id?.startsWith("uniform-") ||
        products.some(
          (p) => p.id === i.id && ["Uniforms", "Shirts", "Pants"].includes(p.category),
        ),
    ),
  );
}
function openOrderManager() {
  omFocus = document.activeElement;
  manager.classList.add("open");
  document.body.style.overflow = "hidden";
  renderOrderManager();
  document.getElementById("omSearch").focus();
}
function closeOrderManager() {
  manager.classList.remove("open");
  if (!document.querySelector(".modal-backdrop.show")) document.body.style.overflow = "";
  omFocus?.focus();
}
function renderOrderManager() {
  const q = document.getElementById("omSearch").value.toLowerCase().trim(),
    filter = document.getElementById("omFilter").value;
  const list = uniformOrderList().filter(
    (o) =>
      (filter === "All" || o.status === filter) &&
      [o.id, o.recipient, o.customer, o.studentNumber, o.course, o.section]
        .join(" ")
        .toLowerCase()
        .includes(q),
  );
  if (!list.some((o) => o.id === omSelected)) omSelected = list[0]?.id || null;
  document.getElementById("omCount").textContent = list.length + " order(s)";
  document.getElementById("omList").innerHTML =
    list
      .map(
        (o) =>
          `<button class="om-ticket ${omSelected === o.id ? "selected" : ""}" data-order="${esc(o.id)}"><b>${esc(o.id)}</b><small>${esc(o.recipient || o.customer || "Student")}</small><small>${esc(o.created || "")}</small><span class="om-badge">${esc(o.status)}</span></button>`,
      )
      .join("") ||
    '<div class="om-empty">No matching orders. Student orders will appear here after checkout.</div>';
  document.querySelectorAll(".om-ticket").forEach(
    (b) =>
      (b.onclick = () => {
        omSelected = b.dataset.order;
        renderOrderManager();
      }),
  );
  renderOrderDetail();
}
function renderOrderDetail() {
  const o = orders.find((o) => o.id === omSelected),
    el = document.getElementById("omDetail");
  if (!o) {
    el.innerHTML =
      '<div class="om-empty">Select an order to view the student and purchase details.</div>';
    return;
  }
  const cashier = document.getElementById("omRole").value === "Cashier";
  el.innerHTML = `<div class="om-heading"><div><h2>${esc(o.id)} <span class="om-badge">${esc(o.status)}</span></h2><div class="om-sub">${esc(o.recipient || "Student")} · ${esc(o.created || "")}</div></div><div><div class="om-sub">ORDER TOTAL</div><div class="om-total">${money(o.total)}</div></div></div><div class="om-grid"><section class="om-card"><h3>Student information</h3><dl class="om-info"><dt>Name</dt><dd>${esc(o.recipient || "Not provided")}</dd><dt>Student number</dt><dd>${esc(o.studentNumber || "Not provided")}</dd><dt>Course</dt><dd>${esc(o.course || "Not provided")}</dd><dt>Year / section</dt><dd>${esc(o.section || "Not provided")}</dd><dt>Phone</dt><dd>${esc(o.phone || "Not provided")}</dd><dt>Email</dt><dd>${esc(o.customer || "Not provided")}</dd><dt>Payment method</dt><dd>${esc(o.payment || "Not provided")}</dd><dt>Payment status</dt><dd><span class="om-badge">${esc(o.paymentStatus || "Pending")}</span></dd></dl></section><section class="om-card"><h3>${cashier ? "Payment controls" : "Order controls"}</h3>${cashier ? `<p class="om-note">Record payment only after the cashier receives it. This prototype does not collect money.</p><button class="om-action" id="omPaid" ${o.paymentStatus === "Paid" || o.paymentStatus === "Refunded" ? "disabled" : ""}>Mark as paid</button><button class="om-action refund" id="omRefund" ${o.paymentStatus !== "Paid" ? "disabled" : ""}>Process refund</button>` : `<label for="omStatus">Order status</label><select id="omStatus" ${o.paymentStatus === "Refunded" ? "disabled" : ""}>${["Order placed", "Processing", "Ready for pickup", "Complete"].map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select><button class="om-action" id="omSaveStatus" ${o.paymentStatus === "Refunded" ? "disabled" : ""}>Save order status</button><p class="om-note">Payment must be recorded before an order is ready for pickup or complete.</p>`}<p class="om-notice" id="omNotice" aria-live="polite"></p><p class="om-note">Role switching is for demonstration.</p></section><section class="om-card om-wide"><h3>Ordered uniforms</h3>${o.items.map((i) => `<div class="om-item">${i.image ? `<img src="${esc(i.image)}" alt="${esc(i.name)}">` : ""}<div><b>${esc(i.name)}</b><div class="om-sub">Quantity: ${i.qty}${i.size ? " · Size: " + esc(i.size) : ""} · ${money(i.price || 0)} each</div></div><b>${money((i.price || 0) * i.qty)}</b></div>`).join("")}</section><section class="om-card om-wide"><h3>Staff notes</h3><label for="omNotes">Internal order notes</label><textarea id="omNotes" placeholder="Add a note about this order…">${esc(o.staffNotes || "")}</textarea><button class="om-action" id="omSaveNotes">Save notes</button><p class="om-note">Notes are stored with the order in this browser.</p></section></div>`;
  document.getElementById("omSaveNotes").onclick = () => {
    o.staffNotes = document.getElementById("omNotes").value.trim();
    persist();
    omMessage("Notes saved");
  };
  if (cashier) {
    document.getElementById("omPaid").onclick = () => omPayment("Paid");
    document.getElementById("omRefund").onclick = () => omPayment("Refunded");
  } else
    document.getElementById("omSaveStatus").onclick = () => {
      const status = document.getElementById("omStatus").value;
      if (["Ready for pickup", "Complete"].includes(status) && o.paymentStatus !== "Paid") {
        omMessage("Record the student payment first.");
        return;
      }
      if (o.paymentStatus === "Refunded") return;
      o.status = status;
      omNotify(o, "Order updated", `Your order ${o.id} is now ${status}.`);
      persist();
      renderOrderManager();
      omMessage("Order status saved");
    };
}
function omMessage(message) {
  document.getElementById("omNotice").textContent = message;
}
function omNotify(o, title, message) {
  notifications.unshift({
    id: Date.now(),
    icon: "▤",
    title,
    message,
    time: "Just now",
    read: false,
    customer: o.customer,
  });
  updateHeader();
}
function omPayment(status) {
  if (document.getElementById("omRole").value !== "Cashier") return;
  const o = orders.find((o) => o.id === omSelected);
  if (!o) return;
  if (status === "Paid") {
    if (o.paymentStatus === "Paid" || o.paymentStatus === "Refunded") return;
    o.paymentStatus = "Paid";
    o.paidAt = new Date().toISOString();
  } else {
    if (o.paymentStatus !== "Paid") return;
    if (
      !confirm(
        "Record a full refund of " +
          money(o.total) +
          " for " +
          o.id +
          "? Stock will be restored.",
      )
    )
      return;
    o.paymentStatus = "Refunded";
    o.status = "Refunded";
    o.items.forEach((i) => {
      const p = products.find((p) => p.id === i.id);
      if (p) p.stock += i.qty;
    });
    o.refundedAt = new Date().toISOString();
    renderProducts();
  }
  omNotify(o, "Payment status updated", `Order ${o.id}: ${o.paymentStatus}.`);
  persist();
  renderOrderManager();
  omMessage("Payment status saved");
}
document.getElementById("omSearch").oninput = renderOrderManager;
document.getElementById("omFilter").onchange = renderOrderManager;
document.getElementById("omRole").onchange = renderOrderDetail;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && manager.classList.contains("open")) closeOrderManager();
});
const studentCheckoutBase = renderCheckout;
renderCheckout = function () {
  studentCheckoutBase();
  document
    .getElementById("shipPhone")
    .closest(".field")
    .insertAdjacentHTML(
      "afterend",
      `<div class="field"><label for="studentNumber">Student number</label><input id="studentNumber" required maxlength="30" placeholder="Enter your student number"></div><div class="formgrid"><div class="field"><label for="studentCourse">Course / program</label><input id="studentCourse" required maxlength="80" placeholder="e.g. BS Information Technology"></div><div class="field"><label for="studentSection">Year and section</label><input id="studentSection" required maxlength="40" placeholder="e.g. 2nd year · BSIT 2A"></div></div>`,
    );
};
const studentOrderBase = placeOrder;
placeOrder = function (e) {
  const studentNumber = document.getElementById("studentNumber")?.value.trim(),
    course = document.getElementById("studentCourse")?.value.trim(),
    section = document.getElementById("studentSection")?.value.trim();
  if (!studentNumber || !course || !section) {
    e.preventDefault();
    toast("Enter your student number, course, and section.");
    return;
  }
  const before = orders.length;
  studentOrderBase(e);
  if (orders.length > before) {
    Object.assign(orders[0], { studentNumber, course, section, paymentStatus: "Pending" });
    persist();
  }
};
