const cashierDetailBase = renderOrderDetail;
renderOrderDetail = function () {
  cashierDetailBase();
  if (document.getElementById("omRole").value !== "Cashier") return;
  const o = orders.find((o) => o.id === omSelected);
  if (!o) return;
  const grid = document.querySelector("#omDetail .om-grid");
  grid.insertAdjacentHTML(
    "beforebegin",
    '<nav class="om-tabs" aria-label="Order details"><button class="active" id="omOverviewTab">Overview</button><button id="omNotifyTab">Notify student</button></nav>',
  );
  grid.children[1].insertAdjacentHTML(
    "beforeend",
    `<h3 style="margin-top:24px">Order status</h3><div class="om-status-buttons">${["Order placed", "Processing", "Ready for pickup", "Complete"].map((status) => `<button type="button" data-status="${esc(status)}" class="${o.status === status ? "active" : ""}" ${o.paymentStatus === "Refunded" ? "disabled" : ""}>${esc(status)}</button>`).join("")}</div><button class="om-action" id="omCashierSaveStatus" ${o.paymentStatus === "Refunded" ? "disabled" : ""}>Save order status</button>`,
  );
  let nextStatus = o.status;
  grid.querySelectorAll("[data-status]").forEach(
    (button) =>
      (button.onclick = () => {
        nextStatus = button.dataset.status;
        grid
          .querySelectorAll("[data-status]")
          .forEach((b) => b.classList.toggle("active", b === button));
      }),
  );
  document.getElementById("omCashierSaveStatus").onclick = () => {
    if (o.paymentStatus === "Refunded") return;
    if (["Ready for pickup", "Complete"].includes(nextStatus) && o.paymentStatus !== "Paid") {
      omMessage("Record the student payment first.");
      return;
    }
    if (nextStatus === o.status) {
      omMessage("Order status is already saved.");
      return;
    }
    o.status = nextStatus;
    omNotify(o, "Order updated", `Your order ${o.id} is now ${nextStatus}.`);
    persist();
    renderOrderManager();
    omMessage("Order status saved. Student notified.");
  };
  grid.insertAdjacentHTML(
    "afterend",
    `<section id="omNotifyPanel" class="om-card" hidden><h3>Notify student</h3><p class="om-note">To: ${esc(o.recipient || o.customer || "Student")} · ${esc(o.studentNumber || "")}</p><label for="omStudentMessage">Message</label><textarea id="omStudentMessage" maxlength="1000" placeholder="Write an order update for the student"></textarea><button class="om-action" id="omSendNotification">Send notification</button><p class="om-notice" id="omSentNotice" aria-live="polite"></p><p class="om-note">Creates an in-app notification in this browser demo.</p></section>`,
  );
  const overview = document.getElementById("omOverviewTab"),
    notify = document.getElementById("omNotifyTab"),
    panel = document.getElementById("omNotifyPanel");
  overview.onclick = () => {
    grid.hidden = false;
    panel.hidden = true;
    overview.classList.add("active");
    notify.classList.remove("active");
  };
  notify.onclick = () => {
    grid.hidden = true;
    panel.hidden = false;
    notify.classList.add("active");
    overview.classList.remove("active");
  };
  document.getElementById("omSendNotification").onclick = () => {
    const message = document.getElementById("omStudentMessage").value.trim();
    if (!message) {
      document.getElementById("omSentNotice").textContent = "Enter a message first.";
      return;
    }
    omNotify(o, "Cashier · " + o.id, message);
    persist();
    document.getElementById("omStudentMessage").value = "";
    document.getElementById("omSentNotice").textContent = "Notification sent.";
  };
};
const cashierManagerBase = renderOrderManager;
renderOrderManager = function () {
  cashierManagerBase();
  const all = uniformOrderList();
  Array.from(document.getElementById("omFilter").options).forEach((option) => {
    const status = option.value;
    option.textContent =
      (status === "All" ? "All orders" : status) +
      " (" +
      all.filter((o) => status === "All" || o.status === status).length +
      ")";
  });
};
