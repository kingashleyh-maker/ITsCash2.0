import { s, db, actor, user, esc, button, link, field, select, form, submit, heading, empty, stat, badge, table, cell, modal, act, filters } from "../../shared/scripts/core.js";
import { assessment, payment, transactions, orders, notices, accounts } from "../../shared/scripts/workflows.js";
function render(target, page) {
  if (page === "history") return transactions(target);
  if (page === "orders") return orders(target);
  if (page === "notices") return notices(target);
  if (page === "accounts") return accounts(target);
  if (page === "tuition") return tuition(target);
  const active = db().tickets.filter((t) => !t.closedAt), total = db().transactions.filter((t) => t.status === "Successful").reduce((n, t) => n + t.amount, 0);
  target.innerHTML = heading(page === "tickets" ? "Checkout Tickets" : "Cashier Dashboard", "Monitor student tuition payments and uniform checkout tickets.") + (page === "tickets" ? "" : `<div class="stats four">${stat("PENDING CHECKOUT TICKETS", active.filter((t) => !t.acknowledgedAt).length)}${stat("UNPAID TRANSACTIONS", db().orders.filter((o) => o.status === "Awaiting Payment").length + db().assessments.filter((a) => s.dueFor(db(), "Tuition", a.id) > 0).length)}${stat("PAID TRANSACTIONS", db().transactions.filter((t) => t.status === "Successful").length, `${s.money(total)} verified`)}${stat("READY FOR PICKUP", db().orders.filter((o) => o.status === "Ready for Pickup").length)}</div>`) + `<div id="ticket-queue"></div>`;
  tickets(target.querySelector("#ticket-queue"));
}
function tuition(target) {
  let student = "All";
  const draw = () => {
    const list = db().assessments.filter((a) => student === "All" || a.studentNumber === student);
    target.innerHTML = heading("Tuition & Balances", "Assign term assessments and track verified payments.", button("＋ Add assessment", () => createAssessment(target), "primary")) + filters(select("Filter student", "student", ["All", ...db().accounts.filter((a) => a.role === "Student").map((a) => [a.studentNumber, `${a.studentNumber} · ${a.name}`])], student), (d) => {
      student = d.student;
      draw();
    }) + (list.map(assessment).join("") || `<section class="card">${empty("No assessments yet. Add a term for a registered student.")}</section>`);
  };
  draw();
}
function createAssessment(target) {
  let dialog;
  dialog = modal("Add tuition assessment", form(select("Student", "studentId", [["", "Choose student"], ...db().accounts.filter((a) => a.role === "Student" && a.active !== false).map((a) => [a.id, `${a.studentNumber} · ${a.name}`])], "", "required") + `<div class="form-grid">${field("School year", "schoolYear", "2026–2027", "text", "required")}${select("Semester", "semester", ["1st Semester", "2nd Semester", "Summer"])}${field("Tuition (₱)", "tuition", "", "number", 'min="0" max="1000000" step="0.01" required')}${field("Miscellaneous fees (₱)", "misc", 0, "number", 'min="0" max="1000000" step="0.01" required')}${select("Payment plan", "plan", ["Full", "Installment"])}${field("First due date", "dueDate", "", "date", "required")}</div><p class="note">Installment plans split the total across three monthly due dates.</p>${submit("Save assessment")}`, async (data) => {
    const result = await act(() => s.createAssessment(actor(), { ...data, fees: [{ label: "Tuition", amount: data.tuition }, { label: "Miscellaneous fees", amount: data.misc }] }), "Assessment added.");
    if (result.ok) {
      dialog.close();
      tuition(target);
    }
  }));
}
const ticketState = (t) => {
  const r = (t.purpose === "Tuition" ? db().assessments : db().orders).find((r2) => r2.id === t.recordId);
  if (!r) return null;
  const due = s.dueFor(db(), t.purpose, t.recordId);
  const status = r.status === "Cancelled" ? "Cancelled" : db().transactions.some((x) => (x.assessmentId || x.orderId) === t.recordId && x.status === "Pending") ? "Pending" : due <= 0 ? "Paid" : s.paidFor(db(), t.purpose, t.recordId) > 0 ? "Partially paid" : "Unpaid";
  return { t, r, due, status, student: db().accounts.find((a) => a.studentNumber === t.studentNumber) };
};
function tickets(target) {
  let query = "", type = "All", status = "All", date = "";
  const draw = () => {
    const rows = db().tickets.map(ticketState).filter(Boolean).filter((x) => (type === "All" || x.t.purpose === type) && (status === "All" || x.status === status) && (!date || new Date(x.t.at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) === date) && `${x.t.id} ${x.student?.name || x.r.name} ${x.t.studentNumber}`.toLowerCase().includes(query.toLowerCase()));
    target.innerHTML = `<section class="card"><h2>Student ticket queue</h2>${filters(field("Search tickets", "query", query, "search") + select("Transaction type", "type", ["All", "Tuition", "Uniform"], type) + select("Payment status", "status", ["All", "Unpaid", "Partially paid", "Pending", "Paid", "Cancelled"], status) + field("Submission date", "date", date, "date"), (d) => {
      query = d.query;
      type = d.type;
      status = d.status;
      date = d.date;
      draw();
    })}${table(["Ticket / submitted", "Student", "Type", "Balance", "Status", "Acknowledgment", "Details"], rows.map((x) => cell(`<b>${esc(x.t.id)}</b><small>${esc(s.dateText(x.t.at))}</small>`, `${esc(x.student?.name || x.r.name)}<small>${esc(x.t.studentNumber)}</small>`, esc(x.t.purpose), s.money(x.due), badge(x.status), x.t.acknowledgedAt ? "Acknowledged" : "Waiting", button("Open ticket", () => ticketDetails(x.t.id)))))}</section>`;
  };
  draw();
}
function ticketDetails(id) {
  let d;
  const body = () => {
    const x = ticketState(db().tickets.find((t) => t.id === id));
    return `<div class="section-head"><h3>${esc(id)}</h3>${badge(x.status)}</div><dl class="details"><dt>Student</dt><dd>${esc(x.student?.name || x.r.name)} · ${esc(x.t.studentNumber)}</dd><dt>Program / year</dt><dd>${esc(x.r.course || x.student?.course)} · ${esc(x.r.year || x.student?.year)}</dd><dt>Contact</dt><dd>${esc(x.r.email || x.student?.email)} · ${esc(x.r.phone || x.student?.phone)}</dd><dt>Amount due</dt><dd>${s.money(x.due)}</dd><dt>Verified payments</dt><dd>${s.money(s.paidFor(db(), x.t.purpose, x.t.recordId))}</dd></dl>${(x.t.purpose === "Uniform" ? x.r.items : x.r.fees).map((i) => `<div class="line"><span>${esc(i.name || i.label)}${i.size ? ` · ${esc(i.size)} · ${i.qty}` : ""}</span><b>${s.money(i.amount ?? i.price * i.qty)}</b></div>`).join("")}<div class="actions">${!x.t.acknowledgedAt ? button("Acknowledge ticket", async () => {
      if ((await act(() => s.ticketNote(actor(), id, "", true), "Ticket acknowledged.")).ok) d.querySelector(".modal-content").innerHTML = body();
    }) : ""}${x.due > 0 && !["Pending", "Cancelled"].includes(x.status) ? button("Record payment", () => {
      d.close();
      payment(x.t.purpose, x.t.recordId);
    }, "primary") : ""}</div><h3>Transaction notes</h3>${(x.t.notes || []).map((n) => `<p class="note">${esc(n.text || n.note)}<small>${esc(n.staff)} · ${esc(s.dateText(n.at))}</small></p>`).join("")}${form(`<label class="field"><span>Add internal note</span><textarea name="note" rows="2" required></textarea></label>${submit("Save note")}`, async (data) => {
      if ((await act(() => s.ticketNote(actor(), id, data.note), "Note saved.")).ok) d.querySelector(".modal-content").innerHTML = body();
    })}`;
  };
  d = modal("Checkout ticket details", body(), { wide: true });
}
export {
  render
};
