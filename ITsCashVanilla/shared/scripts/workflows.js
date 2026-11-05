import { s, db, actor, user, role, esc, button, link, field, select, form, submit, heading, empty, badge, table, cell, modal, act, filters, image } from "./core.js";
import QRCode from "./vendor/qrcode.js";
const recordFor = (purpose, id) => (purpose === "Tuition" ? db().assessments : db().orders).find((r) => r.id === id);
function payment(purpose, id) {
  const record = recordFor(purpose, id);
  if (!record) throw Error("Record not found.");
  const due = s.dueFor(db(), purpose, id);
  let dialog;
  const body = () => form(`<p>Remaining balance: <b>${s.money(s.dueFor(db(), purpose, id))}</b></p>${select("Payment method", "method", ["Cash", "GCash", "Maya", "Online bank"], "Cash")}${purpose === "Tuition" ? select("Payment option", "option", ["Full", "Installment"], "Full") : ""}<div class="payment-amounts">${field("Amount to pay (₱)", "amount", (due / 100).toFixed(2), "number", `min="0.01" max="${due / 100}" step="0.01" required ${purpose === "Uniform" ? "readonly" : ""}`)}<div class="cash-fields">${field("Amount received (₱)", "received", "", "number", 'min="0" step="0.01"')}<p>Change: <b class="change">₱0.00</b></p></div><div class="digital-fields">${field("Payment reference", "reference", "", "text", 'maxlength="100"')}<p class="note">Digital payment outcomes are simulated. No actual funds move.</p></div></div><p class="cash-note">Submit this balance to the cashier and pay in person.</p>${submit("Continue")}`, async (data) => {
    if (data.method === "Cash" && user().role === "Student") {
      const r = await act(() => s.submitTicket(actor(), purpose, id), "Ticket submitted to cashier.");
      if (r.ok) dialog.close();
      return;
    }
    const result = await act(() => s.beginPayment(actor(), purpose, id, data));
    if (result.ok) {
      dialog.close();
      transaction(result.value);
    }
  });
  const wire = () => {
    const f = dialog.querySelector("form");
    const update = () => {
      const cash = f.elements.method.value === "Cash", student = user().role === "Student";
      f.querySelector(".cash-note").hidden = !(cash && student);
      f.querySelector(".payment-amounts").hidden = cash && student;
      f.querySelector(".cash-fields").hidden = !cash;
      f.querySelector(".digital-fields").hidden = cash;
      f.elements.reference.required = !cash;
      f.elements.received.required = cash && !student;
      f.elements.amount.required = !(cash && student);
      if (f.elements.option) {
        f.elements.amount.readOnly = f.elements.option.value === "Full";
        if (f.elements.option.value === "Full") f.elements.amount.value = (due / 100).toFixed(2);
      }
      f.querySelector(".change").textContent = s.money(Math.max(0, Math.round((Number(f.elements.received.value) - Number(f.elements.amount.value)) * 100)));
      f.querySelector('[type="submit"]').textContent = cash && student ? "Submit cashier ticket" : cash ? "Confirm cash payment" : "Create simulated payment";
    };
    f.addEventListener("change", update);
    f.addEventListener("input", update);
    update();
  };
  dialog = modal(`${purpose} payment`, body());
  wire();
}
function transaction(id) {
  const t = db().transactions.find((t2) => t2.id === id);
  if (!t) return;
  const d = modal("Payment status", `<p>${badge(t.status)} · ${s.money(t.amount)}</p><p>${esc(t.reference)}</p><p class="note">Browser payment simulation · No actual funds move.</p><div class="actions">${t.status === "Pending" ? ["Successful", "Failed"].map((status) => button(`Simulate ${status.toLowerCase()}`, async () => {
    if ((await act(() => s.resolvePayment(actor(), id, status), "Payment updated.")).ok) {
      d.close();
      transaction(id);
    }
  })).join("") : t.status === "Successful" ? button("View receipt", () => {
    d.close();
    receipt(t);
  }) : ""}${button("Leave / close", () => d.close())}</div>`);
}
function receipt(t) {
  const r = recordFor(t.purpose, t.assessmentId || t.orderId);
  const d = modal("Payment receipt", `<div class="receipt"><h2>STI · ITsCash</h2><p>Local demonstration receipt · No live gateway transfer.</p><h3>${esc(t.receiptNumber || t.id)}</h3><dl class="details"><dt>Student</dt><dd>${esc(t.studentName)} · ${esc(t.studentNumber)}</dd><dt>Date</dt><dd>${esc(s.dateText(t.verifiedAt || t.at))}</dd><dt>Purpose</dt><dd>${esc(t.purpose)}</dd><dt>Method / reference</dt><dd>${esc(t.method)} · ${esc(t.reference)}</dd><dt>Amount</dt><dd>${s.money(t.amount)}</dd><dt>Received / change</dt><dd>${s.money(t.amountReceived)} / ${s.money(t.change)}</dd><dt>Status</dt><dd>${badge(t.status)}</dd></dl>${r?.items ? r.items.map((i) => `<p>${esc(i.name)} · ${esc(i.size)} · ${i.qty} · ${s.money(i.price * i.qty)}</p>`).join("") : ""}<img class="receipt-qr" alt="Receipt verification code"><p class="note">This code identifies a local record; it is not a payment QR.</p></div><div class="actions no-print">${button("Print / Save PDF", () => window.print())}</div>`, { printable: true });
  QRCode.toDataURL(t.receiptNumber || t.id, { width: 120, margin: 1 }).then((src) => {
    if (d.isConnected) d.querySelector(".receipt-qr").src = src;
  });
}
function statement() {
  const list = db().assessments.filter((a) => a.studentNumber === user().studentNumber);
  modal("Statement of Account", `<h2>STI · ITsCash</h2><p>${esc(user().name)} · ${esc(user().studentNumber)}</p>${table(["Term", "Assessed", "Paid", "Balance"], list.map((a) => cell(esc(`${a.schoolYear} · ${a.semester}`), s.money(s.assessedTotal(a)), s.money(s.paidFor(db(), "Tuition", a.id)), s.money(s.dueFor(db(), "Tuition", a.id)))))}<div class="no-print">${button("Print / Save PDF", () => print())}</div>`, { wide: true, printable: true });
}
function assessment(a) {
  const due = s.dueFor(db(), "Tuition", a.id);
  const student = db().accounts.find((u) => u.id === a.studentId);
  return `<section class="card"><div class="section-head"><h2>${esc(a.schoolYear)} · ${esc(a.semester)}</h2>${badge(due > 0 ? "Unpaid" : "Paid")}</div><p>${esc(student?.name || a.studentNumber)} · ${esc(a.plan)}</p>${a.fees.map((f) => `<div class="line"><span>${esc(f.label)}</span><b>${s.money(f.amount)}</b></div>`).join("")}<div class="line"><span>Verified payments</span><b>${s.money(s.paidFor(db(), "Tuition", a.id))}</b></div><div class="line"><span>Remaining balance</span><b>${s.money(due)}</b></div>${table(["Due date", "Scheduled amount"], a.schedule.map((i) => cell(esc(s.dateText(i.date)), s.money(i.amount))))}<div class="actions">${due > 0 ? button(user().role === "Student" ? "Pay / cashier ticket" : "Record payment", () => payment("Tuition", a.id), "primary") : ""}</div></section>`;
}
function transactions(target) {
  let q = "", status = "All", method = "All", date = "";
  const draw = () => {
    let rows = db().transactions.filter((t) => user().role !== "Student" || t.studentNumber === user().studentNumber).filter((t) => (status === "All" || t.status === status) && (method === "All" || t.method === method) && (!date || new Date(t.at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) === date) && `${t.id} ${t.studentName} ${t.studentNumber} ${t.reference}`.toLowerCase().includes(q.toLowerCase()));
    target.innerHTML = heading("Transaction History", "Payment records, verification outcomes, and receipts.") + filters(field("Search", "q", q, "search") + select("Status", "status", ["All", "Pending", "Successful", "Failed", "Refunded"], status) + select("Method", "method", ["All", "Cash", "GCash", "Maya", "Online bank"], method) + field("Date", "date", date, "date"), (data) => {
      q = data.q;
      status = data.status;
      method = data.method;
      date = data.date;
      draw();
    }) + `<section class="card">${table(["Transaction / date", "Student", "Purpose", "Amount", "Method", "Status", "Actions"], rows.map((t) => cell(`<b>${esc(t.id)}</b><small>${esc(s.dateText(t.at))}</small>`, esc(t.studentName), esc(t.purpose), s.money(t.amount), `${esc(t.method)}<small>${esc(t.reference)}</small>`, badge(t.status), `<div class="actions">${t.status === "Pending" ? button("Open payment", () => transaction(t.id)) : t.status === "Successful" ? button("Receipt", () => receipt(t)) : ""}${user().role === "Admin" && t.status === "Successful" ? button("Refund", async () => {
      if (confirm("Refund this payment?")) {
        await act(() => s.refundPayment(actor(), t.id), "Payment refunded.");
        draw();
      }
    }) : ""}</div>`)))}</section>`;
  };
  draw();
}
function orders(target) {
  let query = "", status = "All";
  const draw = () => {
    const rows = db().orders.filter((o) => user()?.role === "Student" ? o.studentNumber === user().studentNumber : role === "proware" ? ["Paid", "Ready for Pickup", "Claimed"].includes(o.status) : !!user()).filter((o) => (status === "All" || o.status === status) && `${o.id} ${o.name} ${o.studentNumber}`.toLowerCase().includes(query.toLowerCase()));
    target.innerHTML = heading(role === "student" ? "My Purchase" : role === "proware" ? "Pickup Orders" : "Uniform Orders", "Track uniform payments and pickup status.") + filters(field("Search orders", "query", query, "search") + select("Status", "status", ["All", "Awaiting Payment", "Paid", "Ready for Pickup", "Claimed", "Cancelled"], status), (d) => {
      query = d.query;
      status = d.status;
      draw();
    }) + `<section class="card">${table(["Order / submitted", "Student", "Items", "Total / balance", "Status", "Actions"], rows.map((o) => cell(`<b>${esc(o.id)}</b><small>${esc(s.dateText(o.at))}</small>`, `${esc(o.name)}<small>${esc(o.studentNumber)}</small>`, o.items.map((i) => `${esc(i.name)} · ${esc(i.size)} · ${i.qty}`).join("<br>"), `${s.money(o.total)}<small>Due ${s.money(s.dueFor(db(), "Uniform", o.id))}</small>`, badge(o.status), `<div class="actions">${button("Details", () => orderDetails(o))}${o.status === "Awaiting Payment" && role !== "proware" ? button("Pay", () => payment("Uniform", o.id), "primary") : ""}${o.status === "Awaiting Payment" && user()?.role === "Student" ? button("Cancel", async () => {
      if (confirm("Cancel this unpaid order and restore reserved stock?")) {
        await act(() => s.cancelOrder(actor(), o.id), "Order cancelled.");
        draw();
      }
    }) : ""}${role !== "student" && ["Paid", "Ready for Pickup"].includes(o.status) ? button(o.status === "Paid" ? "Ready for Pickup" : "Mark Claimed", async () => {
      const next = o.status === "Paid" ? "Ready for Pickup" : "Claimed";
      if (confirm(`Move order to ${next}?`)) {
        await act(() => s.setOrderStatus(actor(), o.id, next), "Pickup status updated.");
        draw();
      }
    }) : ""}</div>`)))}</section>`;
  };
  draw();
}
function orderDetails(o) {
  modal("Order details", `<h3>${esc(o.id)}</h3>${badge(o.status)}<p>${esc(o.name)} · ${esc(o.studentNumber)}</p><p>${esc(o.email)} · ${esc(o.phone)}<br>${esc(o.course)} · ${esc(o.year)}</p>${table(["Uniform", "Size", "Quantity", "Subtotal"], o.items.map((i) => cell(esc(i.name), esc(i.size), i.qty, s.money(i.price * i.qty))))}<p>Total: <b>${s.money(o.total)}</b></p><p>Payment method: ${esc(o.method)}</p>`, { wide: true });
}
function notices(target) {
  const staff = role === "cashier";
  const activity = db().notices.filter(notice => notice.audience === "Cashier");
  const list = db().notices.filter(notice => notice.audience !== "Cashier" && (staff || notice.studentNumber === user().studentNumber));
  const cards = (items, showUnread) => items.length ? items.map(notice => `<section class="card"><div class="section-head"><h3>${esc(notice.title)}</h3>${showUnread && !(notice.readBy || []).includes(actor()) ? badge("Unread") : ""}</div><p>${esc(notice.text)}</p><small>${esc(notice.studentNumber)} &middot; ${esc(s.dateText(notice.at))}</small></section>`).join("") : empty();
  const markRead = () => button("Mark all as read", async () => {
    await act(() => s.markRead(actor()), "Notifications marked read.");
  });
  target.innerHTML = heading(staff ? "Cashier Notifications" : "Notifications", staff ? "Student orders, payment updates, and messages to students." : "Payment confirmations and campus pickup updates.") +
    (staff ? `<section id="cashier-notifications"><div class="section-head"><h2>Student activity</h2>${markRead()}</div>${cards(activity, true)}</section><section class="card"><h2>Send a student notification</h2>${form(select("Student", "studentNumber", db().accounts.filter(account => account.role === "Student").map(account => [account.studentNumber, `${account.studentNumber} - ${account.name}`])) + field("Title", "title", "", "text", "required") + '<label class="field"><span>Message</span><textarea name="text" rows="3" required></textarea></label>' + submit("Send notification"), async data => {
      await act(() => s.sendNotice(actor(), data.studentNumber, data.title, data.text), "Notification sent.");
    })}</section><h2>Student notification history</h2>${cards(list, false)}` : markRead() + cards(list, true));
}
function accounts(target) {
  if (user().role !== "Admin") {
    target.innerHTML = empty("Only administrators can manage accounts.");
    return;
  }
  target.innerHTML = heading("Account Management", "Create student and staff access for this browser.") + `<section class="card">${form(`<div class="form-grid">${field("Full name", "name", "", "text", "required")}${field("Username", "username", "", "text", 'required pattern="[A-Za-z0-9._-]{3,50}"')}${field("Initial password", "password", "", "password", 'required minlength="8"')}${select("Role", "role", ["Student", "Cashier", "Proware", "Admin"])}${field("Student number", "studentNumber")}${field("Course / program", "course")}${field("Year level", "year")}${field("Email", "email", "", "email")}${field("Phone", "phone")}</div>${submit("Create account")}`, async (d) => {
    const r = await act(() => s.register({ ...d, password: void 0 }, d.password, actor()), "Account created.");
    if (r.ok) accounts(target);
  })}</section><section class="card">${table(["Name", "Username", "Role", "Student number", "Status"], db().accounts.map((a) => cell(esc(a.name), esc(a.username), esc(a.role), esc(a.studentNumber), badge(a.active !== false ? "Active" : "Disabled"))))}</section>`;
}
export {
  accounts,
  assessment,
  notices,
  orders,
  payment,
  receipt,
  statement,
  transaction,
  transactions
};
