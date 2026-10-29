/* School payments demo. Gateway outcomes are simulated; no funds move.
 * Production: server-side sessions and ownership checks, gateway-hosted checkout,
 * signed webhook verification, idempotency keys, database transactions and backups.
 * Never put a payment gateway secret in this HTML file.
 */
const CashierSystem = (() => {
  "use strict";
  const KEY = "sti_school_payments_v1",
    BACKUP_KEY = "sti_school_daily_backup_v1",
    VERSION = 1;
  const $ = (id) => document.getElementById(id),
    clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = (p) => p + "-" + crypto.randomUUID(),
    stamp = () => new Date().toISOString();
  const dateKey = (d) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(d));
  const today = () => dateKey(stamp());
  const formatDate = (d) =>
    d ? new Date(d).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—";
  const pesos = (n) => money(n / 100);
  const cents = (x) => {
    const n = Number(x),
      c = Math.round(n * 100);
    if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(c) || c > 100000000)
      throw Error("Enter an amount from ₱0 to ₱1,000,000.");
    return c;
  };
  const whole = (x) => Number.isSafeInteger(x) && x >= 0 && x <= 100000000;
  const methods = ["GCash", "Maya", "Online bank"],
    allMethods = ["Cash", ...methods];
  let db;
  try {
    db = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    db = null;
  }
  db ||= {
    version: VERSION,
    revision: 0,
    accounts: [],
    assessments: [],
    transactions: [],
    notices: [],
    activities: [],
    reviews: [],
    adjustments: [],
    settlements: [],
  };
  let backupWarning = false;
  let session = null,
    view = "dashboard",
    selection = null,
    checkoutIntent = false,
    lock = false,
    reportData = [],
    reportHeaders = [],
    reportTitle = "";
  const shell = document.createElement("section");
  shell.id = "payApp";
  shell.hidden = true;
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
  shell.setAttribute("aria-label", "School payments");
  document.body.append(shell);
  const launch = document.createElement("button");
  launch.type = "button";
  launch.className = "pw-entry";
  launch.textContent = "Student & Cashier · Payments";
  launch.onclick = () => open();
  document.querySelector(".uniform-shop-actions").prepend(launch);
  function account() {
    return db.accounts.find((a) => a.id === session && a.active);
  }
  function guard(roles = ["Student", "Cashier", "Admin"]) {
    const a = account();
    if (!a || !roles.includes(a.role))
      throw Error("Sign in with an authorized " + roles.join(" / ") + " account.");
    return a;
  }
  function student(id) {
    const a = db.accounts.find((a) => a.id === id && a.role === "Student");
    if (!a) throw Error("Student account not found.");
    return a;
  }
  function owns(number) {
    const a = guard();
    return a.role !== "Student" || a.studentNumber === number;
  }
  function log(action, detail = "", actor = account()?.name || "System") {
    db.activities.unshift({ id: uid("ACT"), at: stamp(), staff: actor, action, detail });
  }
  function notify(studentNumber, title, text, audience = "Student") {
    db.notices.unshift({
      id: uid("NOTICE"),
      at: stamp(),
      studentNumber,
      title,
      text,
      audience,
      readBy: [],
    });
  }
  function fullSnapshot() {
    return {
      format: "STI-FULL-SCHOOL-BACKUP",
      version: 1,
      exportedAt: stamp(),
      payments: clone(db),
      inventory: Proware.backupSnapshot(),
      store: {
        products: compactProducts(),
        orders: clone(orders),
        cart: clone(cart),
        saved: clone(saved),
        notifications: clone(notifications),
        currentUser: null,
      },
    };
  }
  function write() {
    db.revision++;
    localStorage.setItem(KEY, JSON.stringify(db));
    persist();
    try {
      const daily = JSON.parse(localStorage.getItem(BACKUP_KEY) || "null");
      if (db.accounts.length && (!daily || dateKey(daily.exportedAt) !== today()))
        localStorage.setItem(BACKUP_KEY, JSON.stringify(fullSnapshot()));
      backupWarning = false;
    } catch {
      backupWarning = true;
    }
    document.dispatchEvent(new CustomEvent('student:data'));
  }
  function atomic(action, fn, roles = ["Cashier", "Admin"]) {
    guard(roles);
    if (lock) throw Error("A change is already in progress.");
    const latest = JSON.parse(localStorage.getItem(KEY) || "null");
    if (latest && latest.revision !== db.revision) {
      db = latest;
      throw Error("Records changed in another tab. Reopen this screen before continuing.");
    }
    lock = true;
    const before = clone(db),
      oldOrders = clone(orders),
      oldProducts = clone(products),
      oldInventory = Proware.backupSnapshot();
    const keys = [
        KEY,
        BACKUP_KEY,
        "sti_proware_v1",
        "marketly_products",
        "marketly_cart",
        "marketly_orders",
        "marketly_saved",
        "marketly_notifications",
        "marketly_user",
      ],
      previous = keys.map((k) => [k, localStorage.getItem(k)]);
    try {
      fn();
      log(action);
      write();
    } catch (e) {
      db = before;
      orders = oldOrders;
      products = oldProducts;
      Proware.rollbackSnapshot(oldInventory);
      for (const [k, v] of previous) {
        if (v === null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      }
      throw e;
    } finally {
      lock = false;
    }
  }
  function msg(text, error = false) {
    const m = $("payMessage");
    if (!m) {
      toast(text);
      return;
    }
    m.textContent = text;
    m.style.background = error ? "#ffeded" : "#e1f3ec";
    m.style.color = error ? "#a92c35" : "#145c46";
  }
  function handle(fn) {
    return async (e) => {
      e.preventDefault();
      try {
        await fn(e);
      } catch (err) {
        msg(err.message, true);
      }
    };
  }
  function btn(text, action, primary = false) {
    return `<button class="pw-btn ${primary ? "pw-primary" : ""}" type="button" data-pay="${esc(action)}">${text}</button>`;
  }
  function field(name, label, html) {
    return `<div class="pw-field"><label for="pay-${name}">${label}</label>${html}</div>`;
  }
  function input(name, label, value = "", type = "text", extra = "") {
    return field(
      name,
      label,
      `<input id="pay-${name}" name="${name}" type="${type}" value="${esc(value)}" maxlength="120" required ${extra}>`,
    );
  }
  function select(name, label, options, value = "", extra = "") {
    return field(
      name,
      label,
      `<select id="pay-${name}" name="${name}" ${extra}>${options
        .map((o) => {
          const [v, t] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(t)}</option>`;
        })
        .join("")}</select>`,
    );
  }
  function studentsSelect(name = "studentId") {
    return select(
      name,
      "Student",
      [
        ["", "Choose student"],
        ...db.accounts
          .filter((a) => a.role === "Student" && a.active)
          .map((a) => [a.id, a.studentNumber + " · " + a.name]),
      ],
      "",
      "required",
    );
  }
  function table(headers, rows) {
    return `<div class="pw-table-wrap"><table class="pw-table"><thead><tr>${headers.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => "<tr>" + r.map((v) => `<td>${v}</td>`).join("") + "</tr>").join("") : `<tr><td colspan="${headers.length}" class="pw-empty">No records to show.</td></tr>`}</tbody></table></div>`;
  }
  function badge(status) {
    status = ({Successful:'Verified · Paid', Pending:'Pending · Awaiting verification', Failed:'Rejected'})[status] || status;
    return `<span class="pay-status ${esc(status)}">${esc(status)}</span>`;
  }
  function assessmentPaid(a) {
    return db.transactions
      .filter(
        (t) =>
          t.purpose === "Tuition" && t.assessmentId === a.id && t.status === "Successful",
      )
      .reduce((s, t) => s + t.amount, 0);
  }
  function assessedTotal(a) {
    return (
      a.fees.reduce((s, f) => s + f.amount, 0) +
      db.adjustments.filter((x) => x.assessmentId === a.id).reduce((s, x) => s + x.amount, 0)
    );
  }
  function balance(a) {
    return assessedTotal(a) - assessmentPaid(a);
  }
  function ownOrders() {
    const a = guard();
    return orders.filter((o) => a.role !== "Student" || o.studentNumber === a.studentNumber);
  }
  function ownTransactions() {
    const a = guard();
    return db.transactions.filter(
      (t) => a.role !== "Student" || t.studentNumber === a.studentNumber,
    );
  }
  function getTransaction(id) {
    const t = db.transactions.find((t) => t.id === id);
    if (!t || !owns(t.studentNumber))
      throw Error("Payment record is not available for this account.");
    return t;
  }
  function orderStatus(o) {
    return { Pending: "Awaiting Payment", Completed: "Claimed" }[o.status] || o.status;
  }
  function nextInstallment(a) {
    const paid = assessmentPaid(a);
    let scheduled = 0;
    for (const i of a.schedule) {
      scheduled += i.amount;
      if (scheduled > paid)
        return { ...i, outstanding: Math.min(scheduled - paid, balance(a)) };
    }
    return balance(a) > 0
      ? { date: a.schedule.at(-1)?.date || today(), outstanding: balance(a) }
      : null;
  }
  function open(next = "dashboard", id = null) {
    if (["inventory","audit","reviews","reports","settlements","accounts","activity"].includes(next)) next = "dashboard";
    const a = account();
    if (
      a &&
      ((a.role === "Student" &&
        ["accounts", "activity", "reports", "reviews", "settlements", "cash"].includes(
          next,
        )) ||
        (a.role === "Cashier" && ["accounts", "activity"].includes(next)))
    ) {
      next = "dashboard";
      id = null;
    }
    view = next;
    selection = id;
    shell.hidden = false;
    document.body.style.overflow = "hidden";
    render();
    shell.querySelector("input,button")?.focus();
  }
  function close() {
    shell.hidden = true;
    if (
      !document.querySelector(".modal-backdrop.show") &&
      !manager.classList.contains("open") &&
      document.getElementById("pwApp").hidden
    )
      document.body.style.overflow = "";
    launch.focus();
  }
  function render() {
    const a = account(),
      staff = a && a.role !== "Student";
    const unread = a
      ? db.notices.filter(
          (n) =>
            (staff
              ? n.audience === "Cashier"
              : n.audience === "Student" && n.studentNumber === a.studentNumber) &&
            !n.readBy.includes(a.id),
        ).length
      : 0;
    shell.innerHTML = `<header class="pw-top"><div><div class="pay-kicker" style="color:#a7d9d5">STI SCHOOL PAYMENTS</div><h1>${staff ? "ITsCash · Cashier dashboard" : "Student payment portal"}</h1><small>Tuition · Uniforms · Receipts</small></div><div class="pw-tools">${a ? `<span>${esc(a.name)} · ${esc(a.role)}</span>${btn("Sign out", "logout")}` : ""}${a ? btn("Back to store", "close") : ""}</div></header><div id="payMessage" class="pw-message" role="status" aria-live="polite"></div><div class="pw-wrap"><div class="pw-note pw-warning"><b>Payment demo.</b> GCash, Maya, and online bank outcomes are simulated. No money is transferred. Live verification requires a payment gateway and a secure backend.</div>${
      a
        ? `<nav class="pw-nav" aria-label="Payment sections">${[
            ["dashboard", "ITsCash dashboard"],
            ["tuition", "Tuition & balances"],
            ["orders", "Uniform orders"],
            ["transactions", "Payment history"],
            ["notices", "Notifications"],
          ]
            .map(([v, t]) =>
              btn(
                t + (v === "notices" && unread ? " (" + unread + ")" : ""),
                "nav:" + v,
                view === v,
              ),
            )
            .join("")}</nav>`
        : ""
    }<div id="payContent"></div><p class="pw-muted">Browser prototype · Accounts and records stay on this browser. Server-enforced privacy, shared records, scheduled email/SMS, and automatic gateway webhooks are deployment work.</p></div>`;
    shell.querySelectorAll("[data-pay]").forEach(
      (b) =>
        (b.onclick = handle(() => {
          const action = b.dataset.pay;
          if (action === "close") close();
          else if (action === "logout") {
            log("Signed out");
            write();
            session = null;
            render();
          } else if (action.startsWith("nav:")) {
            view = action.slice(4);
            selection = null;
            render();
          }
        })),
    );
    if (!a) {
      loginView();
      return;
    }
    (
      ({
        dashboard: dashboardView,
        ticket: ticketView,

        tuition: tuitionView,
        orders: ordersView,
        transactions: transactionsView,
        notices: noticesView,
        pay: paymentView,
        paymentStatus: paymentStatusView,
        receipt: receiptView,
        cash: cashPaymentView,

      })[view] || dashboardView
    )();
  }
  async function hashPassword(password, salt) {
    if (!crypto.subtle)
      throw Error("Open this page through HTTPS or localhost for staff login.");
    const k = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const b = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt),
        iterations: 150000,
        hash: "SHA-256",
      },
      k,
      256,
    );
    return Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, "0")).join("");
  }
  async function credential(password) {
    if (password.length < 8) throw Error("Use a password with at least 8 characters.");
    const salt = uid("SALT");
    return { salt, hash: await hashPassword(password, salt) };
  }
  function loginView() {
    const setup = !db.accounts.some(a => a.role === "Admin" && a.active);
    $("payContent").innerHTML =
      `<section class="pw-auth pw-card"><h2>${setup ? "Create the payments Admin account" : "Sign in to school payments"}</h2><p class="pw-muted">${setup ? "This account manages student and cashier accounts, fee assessments, and authorized refunds." : "Students and cashiers use accounts created by the administrator."}</p><form id="payLogin" class="pw-form">${setup ? input("name", "Full name") : ""}${input("username", "Username", "", "text", 'pattern="[A-Za-z0-9._-]{3,40}" autocomplete="username"')}${input("password", "Password", "", "password", 'minlength="8" autocomplete="' + (setup ? "new-password" : "current-password") + '"')}<button class="pw-btn pw-primary" type="submit">${setup ? "Create Admin" : "Sign in"}</button></form></section>`;
    $("payLogin").insertAdjacentHTML("afterend", `<details class="pw-note" style="margin-top:20px"><summary>First time here? Set up demo access</summary><p>Create test accounts for this local prototype. Existing accounts and records are preserved. These public demo passwords are for practice only.</p><button class="pw-btn" type="button" id="paySetupDemo">Create demo accounts</button><div id="payDemoAccounts" aria-live="polite"></div></details>`);
    $("paySetupDemo").onclick = handle(async (e) => {
      const button = e.currentTarget;
      button.disabled = true;
      try {
        const definitions = [
          {username:"demo.admin", password:"Admin123!", name:"Demo Administrator", role:"Admin"},
          {username:"demo.cashier", password:"Cashier123!", name:"Demo Cashier", role:"Cashier"},
          {username:"demo.student", password:"Student123!", name:"Demo Student", role:"Student", studentNumber:"DEMO-2026-001", course:"BSIT", year:"1st Year", email:"demo.student@example.test"}
        ];
        const prepared = [];
        for (const d of definitions) {
          const existing = db.accounts.find(a=>a.username===d.username);
          if (existing && !existing.demoAccount) throw Error("A regular account already uses " + d.username + ". Ask its administrator for access; it was not changed.");
          if (d.role === "Student" && db.accounts.some(a=>a.studentNumber===d.studentNumber && !a.demoAccount)) throw Error("The demonstration student number is already assigned. No accounts were changed.");
          const {password,...details} = d;
          prepared.push({...details,...await credential(password),id:existing?.id || uid("USER"),active:true,demoAccount:true});
        }
        const before=clone(db);
        try {
          // Re-read before committing: do not overwrite changes from another tab.
          const latest=JSON.parse(localStorage.getItem(KEY)||"null");
          if(latest && latest.revision!==db.revision) {db=latest;throw Error("Account records changed in another tab. Reopen sign-in and try again.");}
          for (const a of prepared) {
            const index=db.accounts.findIndex(x=>x.id===a.id);
            if(index<0)db.accounts.push(a);else db.accounts[index]=a;
          }
          for (const a of prepared) ensurePracticeTuition(a);
          log("Created or reset public demo accounts", "Demo accounts only; other users unchanged", "Local demo setup");
          write();
        } catch(err) {db=before;throw err;}
        render();
        const details = $("paySetupDemo").closest("details");
        details.open = true;
        $("payDemoAccounts").innerHTML = table(["Role", "Username", "Password"], definitions.map(d=>[esc(d.role),esc(d.username),esc(d.password)]));
        $("pay-username").value="demo.admin";
        $("pay-password").value="";
        msg("Demo accounts are ready. Sign in with one of the accounts shown below.");
      } finally {button.disabled=false;}
    });
    $("payLogin").onsubmit = handle(async (e) => {
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target),
        username = String(f.get("username")).trim().toLowerCase(),
        password = String(f.get("password")),
        b = e.target.querySelector("button");
      b.disabled = true;
      try {
        if (setup) {
          const c = await credential(password),
            a = {
              id: uid("USER"),
              name: String(f.get("name")).trim(),
              username,
              role: "Admin",
              active: true,
              ...c,
            };
          if (!a.name || db.accounts.some(x => x.role === "Admin" && x.active) || db.accounts.some(x => x.username === username)) throw Error("Check account details or choose another username.");
          db.accounts.push(a);
          session = a.id;
          log("Created payments Admin");
          write();
        } else {
          const a = db.accounts.find((a) => a.username === username && a.active),
            h = await hashPassword(password, a?.salt || "invalid-account");
          if (!a || h !== a.hash || (document.body.dataset.workspace === "cashier" && !["Cashier", "Admin"].includes(a.role))) {
            log("Failed sign-in", username, "Unauthenticated");
            write();
            throw Error("Username or password is incorrect.");
          }
          session = a.id;
          log("Signed in");
          write();
        }
        render();
        if (checkoutIntent && account().role === "Student") {
          checkoutIntent = false;
          close();
          renderCheckout();
          openModal("checkoutModal");
        }
      } finally {
        b.disabled = false;
      }
    });
  }
  function dashboardView() {
    const a = guard(),
      staff = a.role !== "Student",
      tx = ownTransactions(),
      successful = tx.filter((t) => t.status === "Successful"),
      as = db.assessments.filter((x) => staff || x.studentNumber === a.studentNumber),
      os = ownOrders();
    $("payContent").innerHTML =
      `${backupWarning ? '<div class="pw-note pw-warning">Automatic snapshot could not be saved. Download a full backup from Activity & backups.</div>' : ""}<div class="pw-stats">${[
        [
          staff ? "Tuition collections" : "Tuition paid",
          pesos(
            successful
              .filter((t) => t.purpose === "Tuition")
              .reduce((s, t) => s + t.amount, 0),
          ),
        ],
        [
          staff ? "Uniform collections" : "Uniforms paid",
          pesos(
            successful
              .filter((t) => t.purpose === "Uniform")
              .reduce((s, t) => s + t.amount, 0),
          ),
        ],
        ["Tuition balance", pesos(as.reduce((s, x) => s + balance(x), 0))],
        ["Awaiting payment", os.filter((o) => orderStatus(o) === "Awaiting Payment").length],
      ]
        .map(
          ([l, v]) =>
            `<div class="pw-stat"><span>${l}</span><strong style="font-size:25px">${v}</strong></div>`,
        )
        .join(
          "",
        )}</div><div class="pw-grid"><section class="pw-card"><h2>Tuition due dates</h2>${
        as
          .map((x) => {
            const n = nextInstallment(x);
            return n
              ? `<div class="pay-line"><div><b>${esc(x.studentNumber)} · ${esc(x.schoolYear)} / ${esc(x.semester)}</b><small class="pw-muted" style="display:block">Due ${esc(n.date)}${n.date < today() ? " · Overdue" : ""}</small></div><b>${pesos(n.outstanding)}</b></div>`
              : "";
          })
          .join("") || '<p class="pw-muted">No unpaid tuition assessments.</p>'
      }</section><section class="pw-card"><h2>Recent payments</h2>${transactionTable(tx.slice(0, 7))}</section></div>`;
    wireTransactionLinks();
  }
  function tuitionView() {
    const a = guard(),
      admin = a.role === "Admin";
    const list = db.assessments.filter(
      (x) => a.role !== "Student" || x.studentNumber === a.studentNumber,
    );
    $("payContent").innerHTML =
      `${admin ? `<section class="pw-card"><h2>Create tuition assessment</h2><form id="payAssessment" class="pw-form">${studentsSelect()}${input("schoolYear", "School year", "2026–2027")}${select("semester", "Semester", ["1st Semester", "2nd Semester", "Summer"])}${input("tuitionFee", "Tuition fee (₱)", 0, "number", 'min="0" step="0.01"')}${input("otherFee", "Other school fees (₱)", 0, "number", 'min="0" step="0.01"')}${input("otherLabel", "Other fee description", "Miscellaneous and school fees")}${select("plan", "Payment option", ["Full", "Installment"])}${input("installments", "Number of installments", 3, "number", 'min="2" max="12" step="1"')}${input("due", "First payment due date", today(), "date")}<p class="pw-muted">Installments have monthly due dates and sum exactly to the assessed fees.</p><button class="pw-btn pw-primary" type="submit">Create assessment</button></form></section>` : ""}<section class="pw-card"><h2>Tuition balances & payment history</h2>${
        list
          .map((x) => {
            const n = nextInstallment(x);
            return `<article class="pw-card"><div class="pay-kicker">${esc(x.studentNumber)} · ${esc(student(x.studentId).name)}</div><h3>${esc(x.schoolYear)} · ${esc(x.semester)}</h3>${x.fees.map((f) => `<div class="pay-line"><span>${esc(f.label)}</span><b>${pesos(f.amount)}</b></div>`).join("")}${db.adjustments
              .filter((v) => v.assessmentId === x.id)
              .map(
                (v) =>
                  `<div class="pay-line"><span>Adjustment · ${esc(v.reason)}</span><b>${pesos(v.amount)}</b></div>`,
              )
              .join(
                "",
              )}<div class="pay-line"><span>Total amount due</span><b>${pesos(assessedTotal(x))}</b></div><div class="pay-line"><span>Amount paid</span><b>${pesos(assessmentPaid(x))}</b></div><div class="pay-line"><span>Remaining balance</span><b>${pesos(balance(x))}</b></div><p class="pw-muted">${esc(x.plan)}${n ? " · Next due " + esc(n.date) : " · Fully paid"}</p><details><summary>Installment schedule & payment history</summary>${table(
              ["Due date", "Scheduled amount"],
              x.schedule.map((i) => [esc(i.date), pesos(i.amount)]),
            )}${transactionTable(ownTransactions().filter((t) => t.assessmentId === x.id))}</details><div class="pay-actions">${a.role === "Student" && balance(x) > 0 ? `<button class="pw-btn pw-primary" data-assessment="${esc(x.id)}">Pay tuition (demo)</button><button class="pw-btn" data-submit-tuition="${esc(x.id)}">Submit cashier checkout ticket</button>` : ""}${a.role !== "Student" && balance(x) > 0 ? `<button class="pw-btn" data-cash-tuition="${esc(x.id)}">Record payment</button>` : ""}${admin ? `<button class="pw-btn" data-adjust="${esc(x.id)}">Adjust fees</button>` : ""}</div><div id="payAdjust-${esc(x.id)}"></div></article>`;
          })
          .join("") ||
        '<div class="pw-empty">No tuition assessments yet. An Admin can add one for each school year and semester.</div>'
      }</section>`;
    shell.querySelectorAll('[data-submit-tuition]').forEach(b => b.onclick = handle(() => {
      submitCashierTicket('Tuition', b.dataset.submitTuition);
      msg('Tuition checkout ticket sent to the cashier.');
    }));
    if (admin) {
      $("pay-plan").onchange = () => {
        $("pay-installments").disabled = $("pay-plan").value !== "Installment";
      };
      $("pay-plan").onchange();
      $("payAssessment").onsubmit = handle((e) => {
        if (!e.target.reportValidity()) return;
        const f = new FormData(e.target);
        atomic(
          "Created tuition assessment",
          () => {
            const s = student(f.get("studentId")),
              schoolYear = String(f.get("schoolYear")).trim(),
              semester = f.get("semester"),
              tuition = cents(f.get("tuitionFee")),
              other = cents(f.get("otherFee")),
              total = tuition + other,
              plan = f.get("plan"),
              count = plan === "Full" ? 1 : Number(f.get("installments")),
              due = f.get("due");
            if (
              !schoolYear ||
              total <= 0 ||
              total > 100000000 ||
              !Number.isInteger(count) ||
              count < 1 ||
              count > 12 ||
              !/^\d{4}-\d{2}-\d{2}$/.test(due)
            )
              throw Error("Enter valid fees, a due date, and 1–12 installments.");
            if (
              db.assessments.some(
                (x) =>
                  x.studentId === s.id &&
                  x.schoolYear === schoolYear &&
                  x.semester === semester,
              )
            )
              throw Error("This student already has an assessment for this term.");
            const [y, m, d] = due.split("-").map(Number),
              schedule = Array.from({ length: count }, (_, i) => {
                const last = new Date(Date.UTC(y, m + i, 0)).getUTCDate(),
                  date = new Date(Date.UTC(y, m - 1 + i, Math.min(d, last)))
                    .toISOString()
                    .slice(0, 10);
                return {
                  date,
                  amount: Math.floor(total / count) + (i < total % count ? 1 : 0),
                };
              });
            const x = {
              id: uid("FEE"),
              studentId: s.id,
              studentNumber: s.studentNumber,
              schoolYear,
              semester,
              plan,
              fees: [
                { label: "Tuition", amount: tuition },
                { label: String(f.get("otherLabel")).trim(), amount: other },
              ],
              schedule,
              createdAt: stamp(),
            };
            db.assessments.unshift(x);
            notify(
              s.studentNumber,
              "Tuition assessment ready",
              `${schoolYear} · ${semester} · ${pesos(total)} · First due ${due}`,
            );
          },
          ["Admin"],
        );
        render();
        msg("Tuition assessment created.");
      });
    }
    shell
      .querySelectorAll("[data-assessment]")
      .forEach(
        (b) =>
          (b.onclick = () => open("pay", { purpose: "Tuition", id: b.dataset.assessment })),
      );
    shell
      .querySelectorAll("[data-adjust]")
      .forEach((b) => (b.onclick = () => adjustmentForm(b.dataset.adjust)));
    shell
      .querySelectorAll("[data-cash-tuition]")
      .forEach(
        (b) =>
          (b.onclick = () => open("cash", { purpose: "Tuition", id: b.dataset.cashTuition })),
      );
    wireTransactionLinks();
  }
  function adjustmentForm(id) {
    guard(["Admin"]);
    const x = db.assessments.find((x) => x.id === id);
    $("payAdjust-" + id).innerHTML =
      `<form id="payAdjustment" class="pw-form" style="margin-top:14px">${select("direction", "Adjustment", ["Add fee", "Reduce fee"])}${input("adjustAmount", "Amount (₱)", "", "number", 'min="0.01" step="0.01"')}${input("adjustReason", "Reason")}<button class="pw-btn pw-primary" type="submit">Record authorized adjustment</button></form>`;
    $("payAdjustment").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target);
      atomic(
        "Adjusted tuition fees",
        () => {
          const amount =
              cents(f.get("adjustAmount")) * (f.get("direction") === "Reduce fee" ? -1 : 1),
            reason = String(f.get("adjustReason")).trim();
          if (
            !amount ||
            !reason ||
            balance(x) + amount < 0 ||
            assessedTotal(x) + amount > 100000000
          )
            throw Error("A reduction cannot exceed the remaining balance. Enter a reason.");
          db.adjustments.unshift({
            id: uid("ADJ"),
            at: stamp(),
            assessmentId: id,
            studentNumber: x.studentNumber,
            amount,
            reason,
            staff: account().name,
          });
          notify(
            x.studentNumber,
            "Tuition adjustment recorded",
            `${reason} · ${pesos(amount)}`,
          );
        },
        ["Admin"],
      );
      render();
      msg("Adjustment recorded with the responsible staff member.");
    });
  }
  function ordersView() {
    const a = guard(),
      staff = a.role !== "Student";
    $("payContent").innerHTML =
      `<section class="pw-card"><h2>Uniform orders</h2><div class="pw-toolbar">${input("orderSearch", "Search student, name, or order", "", "search")}${select("orderFilter", "Order status", ["All", "Awaiting Payment", "Paid", "Ready for Pickup", "Claimed", "Cancelled"])}</div><div id="payOrderList"></div></section>`;
    const draw = () => {
      const q = $("pay-orderSearch").value.trim().toLowerCase(),
        f = $("pay-orderFilter").value;
      const list = ownOrders().filter(
        (o) =>
          (f === "All" || orderStatus(o) === f) &&
          [o.id, o.studentNumber, o.recipient].join(" ").toLowerCase().includes(q),
      );
      $("payOrderList").innerHTML =
        list
          .map(
            (o) =>
              `<article class="pw-card"><div class="pay-line"><div><b>${esc(o.id)}</b><small style="display:block">${esc(o.recipient)} · ${esc(o.studentNumber)}</small></div>${badge(orderStatus(o))}</div>${table(
                [
                  "Uniform / type",
                  "Size",
                  "Quantity",
                  "Price each",
                  "Line total",
                  "Available stock",
                ],
                o.items.map((i) => [
                  esc(i.name),
                  esc(i.size || "Not recorded"),
                  i.qty,
                  money(i.price),
                  money(i.qty * i.price),
                  Proware.available(i.id, i.size),
                ]),
              )}<div class="pay-line"><b>Total amount</b><b>${money(o.total)}</b></div><p class="pw-muted">Payment: ${esc(o.paymentStatus || "Unpaid")} · Order date ${esc(o.created)}</p><div class="pay-actions">${!staff && orderStatus(o) === "Awaiting Payment" ? `<button class="pw-btn pw-primary" data-order-pay="${esc(o.id)}">Pay uniform order (demo)</button>` : ""}${orderStatus(o) === "Awaiting Payment" ? `<button class="pw-btn" data-order-cancel="${esc(o.id)}">Cancel unpaid order</button>` : ""}${staff && orderStatus(o) === "Awaiting Payment" ? `<button class="pw-btn" data-cash-order="${esc(o.id)}">Record payment</button>` : ""}${staff && orderStatus(o) === "Paid" ? `<button class="pw-btn pw-primary" data-ready="${esc(o.id)}">Mark Ready for Pickup</button>` : ""}${staff && orderStatus(o) === "Ready for Pickup" ? `<button class="pw-btn" data-handover="${esc(o.id)}">Review pickup & collection</button>` : ""}</div></article>`,
          )
          .join("") || '<div class="pw-empty">No matching uniform orders.</div>';
      shell
        .querySelectorAll("[data-cash-order]")
        .forEach(
          (b) =>
            (b.onclick = () => open("cash", { purpose: "Uniform", id: b.dataset.cashOrder })),
        );
      shell
        .querySelectorAll("[data-order-pay]")
        .forEach(
          (b) =>
            (b.onclick = () => open("pay", { purpose: "Uniform", id: b.dataset.orderPay })),
        );
      shell.querySelectorAll("[data-order-cancel]").forEach(
        (b) =>
          (b.onclick = handle(() => {
            atomic(
              "Cancelled unpaid order",
              () => {
                const o = orders.find((o) => o.id === b.dataset.orderCancel);
                if (!o || !owns(o.studentNumber) || orderStatus(o) !== "Awaiting Payment")
                  throw Error("Only unpaid orders can be cancelled.");
                Proware.releaseReservation(o, account().name);
                o.status = "Cancelled";
                for (const t of db.transactions.filter(t=>t.orderId===o.id&&t.status==='Pending')) {
                  t.status='Failed';t.events.push({at:stamp(),status:'Failed',source:account().name,reason:'Order cancelled'});
                }
                if(o.cashierTicket)o.cashierTicket.closedAt=stamp();
                notify(o.studentNumber, "Uniform order cancelled", o.id);
              },
              ["Student", "Cashier", "Admin"],
            );
            render();
            msg("Order cancelled; reserved stock released.");
          })),
      );
      shell.querySelectorAll("[data-ready]").forEach(
        (b) =>
          (b.onclick = handle(() => {
            atomic("Marked uniforms ready for pickup", () => {
              const o = orders.find((o) => o.id === b.dataset.ready);
              if (!o || o.status !== "Paid" || o.paymentStatus !== "Paid")
                throw Error("Payment must be successful first.");
              o.status = "Ready for Pickup";
              notify(
                o.studentNumber,
                "Uniforms ready for pickup",
                `${o.id} · Bring your receipt and student ID.`,
              );
            });
            render();
            msg("Student notified that uniforms are ready.");
          })),
      );
      shell.querySelectorAll("[data-handover]").forEach(
        (b) =>
          (b.onclick = () => {
            open("ticket", {purpose:"Uniform", id:b.dataset.handover});
          }),
      );
    };
    $("pay-orderSearch").oninput = draw;
    $("pay-orderFilter").onchange = draw;
    draw();
  }
  function paymentTarget() {
    guard(["Student"]);
    const { purpose, id } = selection || {};
    if (purpose === "Tuition") {
      const x = db.assessments.find((x) => x.id === id);
      if (!x || !owns(x.studentNumber) || balance(x) <= 0)
        throw Error("No outstanding tuition balance is available.");
      return {
        purpose,
        id,
        studentNumber: x.studentNumber,
        max: balance(x),
        label: `${x.schoolYear} · ${x.semester}`,
        breakdown: x.fees,
        assessment: x,
      };
    }
    const o = orders.find((o) => o.id === id);
    if (
      !o ||
      !owns(o.studentNumber) ||
      orderStatus(o) !== "Awaiting Payment" ||
      o.paymentStatus === "Paid"
    )
      throw Error("This order is not available for payment.");
    return {
      purpose: "Uniform",
      id,
      studentNumber: o.studentNumber,
      max: cents(o.total),
      label: o.id,
      breakdown: o.items.map((i) => ({
        label: `${i.name} · ${i.size} × ${i.qty}`,
        amount: cents(i.price * i.qty),
      })),
      order: o,
    };
  }
  // Tuition details stage, before creating any payment transaction.
  function tuitionPaymentForm(target, draft = {}) {
    const a=guard(['Student']),assessment=target.assessment;
    const names=a.name.trim().split(/\s+/),first=names.length>1?names.slice(0,-1).join(' '):a.name,last=names.length>1?names.at(-1):'';
    let covered=assessmentPaid(assessment);
    const terms=assessment.schedule.map((item,index)=>{const paid=Math.min(covered,item.amount);covered-=paid;return {index,date:item.date,outstanding:item.amount-paid,label:assessment.plan==='Full'?'Full Payment':index===0?'Downpayment':index===assessment.schedule.length-1?'Final Installment':index===1?'Midterm Installment':index===2?'Pre-Final Installment':'Installment '+(index+1)};});
    const next=terms.find(t=>t.outstanding>0),defaultTerm=draft.paymentTermIndex!==undefined && (draft.paymentTermIndex==='Full'||terms.some(t=>String(t.index)===draft.paymentTermIndex&&t.outstanding>0))?draft.paymentTermIndex:assessment.plan==='Full'?'Full':next?String(next.index):'Full';
    const years=[...new Set(['1st Year','2nd Year','3rd Year','4th Year',a.year,draft.year||a.year])];
    $('payContent').innerHTML=`<section class="tuition-payment-card"><header><h2>Tuition Payment Form</h2><p>Please review your student details and payment amount to proceed.</p></header><form id="tuitionDetailsForm"><div class="tuition-form-group"><label>Student Full Name</label><div class="tuition-form-columns"><div><input id="tuitionFirstName" value="${esc(draft.firstName ?? first)}" required maxlength="100" aria-label="First name"><small>First Name</small></div><div><input id="tuitionLastName" value="${esc(draft.lastName ?? last)}" maxlength="100" aria-label="Last name"><small>Last Name</small></div></div></div><div class="tuition-form-group tuition-form-narrow"><label for="tuitionStudentNumber">Student ID Number</label><input id="tuitionStudentNumber" value="${esc(draft.studentNumber || a.studentNumber)}" required maxlength="30"></div><div class="tuition-form-group tuition-form-narrow"><label for="tuitionEmail">Email Address</label><input id="tuitionEmail" type="email" value="${esc(draft.email || a.email)}" required maxlength="120"></div><div class="tuition-form-group tuition-form-narrow"><label for="tuitionCampus">School Campus</label><input id="tuitionCampus" list="tuitionCampusList" value="${esc(draft.campus||a.campus||'')}" placeholder="Enter or select your campus" maxlength="100" required><datalist id="tuitionCampusList">${[...new Set(db.accounts.filter(s=>s.role==='Student'&&s.campus).map(s=>s.campus))].map(c=>`<option value="${esc(c)}"></option>`).join('')}</datalist></div><div class="tuition-form-columns"><div class="tuition-form-group"><label for="tuitionYear">Year Level</label><select id="tuitionYear" required>${years.map(y=>`<option ${y===(draft.year||a.year)?'selected':''}>${esc(y)}</option>`).join('')}</select></div><div class="tuition-form-group"><label for="tuitionSection">Section</label><input id="tuitionSection" value="${esc(draft.section||a.section||'')}" placeholder="e.g., BSIT-301" maxlength="60" required></div></div><div class="tuition-form-columns"><div class="tuition-form-group"><label for="tuitionAmount">Payment Amount (₱)</label><input id="tuitionAmount" type="number" min="0.01" max="${target.max/100}" step="0.01" value="${(defaultTerm==='Full'?target.max:next.outstanding)/100}" required></div><div class="tuition-form-group"><label for="tuitionTerm">Payment Term</label><select id="tuitionTerm">${assessment.plan!=='Full'?terms.map(t=>`<option value="${t.index}" ${String(t.index)===defaultTerm?'selected':''} ${t.outstanding<=0?'disabled':''}>${esc(t.label)}${t.outstanding<=0?' · Paid':''}</option>`).join(''):''}<option value="Full" ${defaultTerm==='Full'?'selected':''}>Full remaining balance</option></select></div></div><p class="tuition-balance-note">${esc(assessment.schoolYear)} · ${esc(assessment.semester)} · Remaining balance: <b>${pesos(target.max)}</b></p><footer><button type="button" class="tuition-cancel" id="tuitionCancel">Cancel</button><button type="submit" class="tuition-proceed">Confirm & Proceed to Payment</button></footer></form></section>`;
    const update=()=>{const term=$('tuitionTerm').value,item=terms.find(t=>String(t.index)===term);$('tuitionAmount').value=(term==='Full'?target.max:item.outstanding)/100;$('tuitionAmount').max=(term==='Full'?target.max:item.outstanding)/100;$('tuitionAmount').readOnly=term==='Full';};$('tuitionTerm').onchange=update;update();if(draft.amount && draft.amount<=cents($('tuitionAmount').max))$('tuitionAmount').value=draft.amount/100;
    $('tuitionCancel').onclick=()=>{close();if(window.StudentDashboard)StudentDashboard.open('tuition');};
    $('tuitionDetailsForm').onsubmit=handle(e=>{
      if(!e.target.reportValidity())return;
      const live=paymentTarget(),amount=cents($('tuitionAmount').value),term=$('tuitionTerm').value,chosen=terms.find(t=>String(t.index)===term),campus=$('tuitionCampus').value.trim(),section=$('tuitionSection').value.trim();
      const enteredFirst=$('tuitionFirstName').value.trim(),enteredLast=$('tuitionLastName').value.trim(),enteredNumber=$('tuitionStudentNumber').value.trim(),enteredEmail=$('tuitionEmail').value.trim();
      if(!enteredFirst||!enteredNumber||enteredNumber.length>30||!/^\S+@\S+\.\S+$/.test(enteredEmail))throw Error('Enter a name, student ID number and valid email address.');
      if(!campus||!section||amount<=0||amount>live.max||(term==='Full'&&amount!==live.max)||(term!=='Full'&&(!chosen||amount>chosen.outstanding)))throw Error('Check the campus, section, payment term and outstanding amount.');
      if(!window.confirm('Confirm your tuition details and payment amount?'))return;
      selection={purpose:'Tuition',id:target.id,tuitionDetails:{firstName:enteredFirst,lastName:enteredLast,studentNumber:enteredNumber,email:enteredEmail,campus,section,year:$('tuitionYear').value,amount,paymentTerm:term==='Full'?'Full remaining balance':chosen.label,paymentTermIndex:term,paymentOption:term==='Full'?'Full':'Installment'}};
      paymentView();
    });
  }
  function paymentStatusView(){
    const t=getTransaction(selection);
    if(t.status==='Successful'&&t.receiptNumber){view='receipt';receiptView();return;}
    $('payContent').innerHTML=`<section class="tuition-payment-card tuition-status-card"><span class="tuition-status-symbol">${t.status==='Pending'?'◷':'×'}</span><h2>${t.status==='Pending'?'Payment awaiting verification':'Payment not confirmed'}</h2><p>${t.status==='Pending'?'Your payment reference has been submitted to the cashier. Your receipt will open here once the payment is verified.':'This payment was rejected. No successful receipt has been issued.'}</p><div class="pay-line"><span>Transaction number</span><b>${esc(t.id)}</b></div><div class="pay-line"><span>Reference</span><b>${esc(t.reference)}</b></div><div class="pay-line"><span>Amount submitted</span><b>${pesos(t.amount)}</b></div><div class="pay-line"><span>Status</span>${badge(t.status)}</div><p class="pw-muted">The tuition balance is updated only after verification.</p><div class="pay-actions"><button type="button" class="pw-btn" id="tuitionPaymentHistory">Payment history</button><button type="button" class="pw-btn" id="tuitionStatusBack">Back to dashboard</button></div></section>`;
    $('tuitionPaymentHistory').onclick=()=>open('transactions');$('tuitionStatusBack').onclick=()=>{close();if(window.StudentDashboard)StudentDashboard.open();};
  }

  function paymentView() {
    let target;
    try {
      target = paymentTarget();
    } catch (e) {
      view = "transactions";
      transactionsView();
      msg(e.message, true);
      return;
    }
    if (target.purpose === "Tuition" && !selection?.tuitionDetails) { tuitionPaymentForm(target, selection?.tuitionDraft || {}); return; }
    const reviewedTuition = target.purpose === "Tuition" ? clone(selection.tuitionDetails) : null;
    const a = guard(["Student"]),
      installment = target.assessment ? nextInstallment(target.assessment) : null;
    $("payContent").innerHTML =
      `<section class="pw-card" style="max-width:820px;margin:auto"><div class="pay-kicker">${target.purpose} payment</div><h2>Review payment</h2><p>${esc(a.name)} · ${esc(a.studentNumber)}<br>${esc(target.label)}</p>${target.breakdown.map((f) => `<div class="pay-line"><span>${esc(f.label)}</span><b>${pesos(f.amount)}</b></div>`).join("")}${target.assessment ? `<div class="pay-line"><span>Paid to date</span><b>${pesos(assessmentPaid(target.assessment))}</b></div>` : ""}<div class="pay-line"><span>Remaining amount due</span><b>${pesos(target.max)}</b></div><form id="payOnline" class="pw-form" style="margin-top:20px">${
        target.purpose === "Tuition"
          ? select(
              "payOption",
              "Payment option",
              [
                ["Full", "Full remaining balance"],
                ["Installment", "Next installment / partial payment"],
              ],
              target.assessment.plan,
            )
          : ""
      }${input("amount", "Amount to pay (₱)", (target.purpose === "Tuition" && target.assessment.plan === "Installment" ? installment.outstanding : target.max) / 100, "number", `min="0.01" max="${target.max / 100}" step="0.01" ${target.purpose === "Uniform" ? "readonly" : ""}`)}${select("method", "Payment gateway method", methods)}${select("demoResult", "Demo submission outcome", [["Pending", "Pending · await cashier verification"], ["Failed", "Rejected · simulate declined submission"]])}${input("digitalReference", "Digital payment reference (demo)")}<label class="pay-check pw-full"><input type="checkbox" id="pay-confirm" required>I reviewed the breakdown and understand this is a payment simulation.</label><button class="pw-btn pw-primary" type="submit">Confirm demo payment</button></form></section>`;
    if ($("pay-payOption"))
      $("pay-payOption").onchange = () => {
        $("pay-amount").value =
          ($("pay-payOption").value === "Full" ? target.max : installment.outstanding) / 100;
        $("pay-amount").readOnly = $("pay-payOption").value === "Full";
      };
    if ($("pay-payOption")) $("pay-payOption").onchange();
    if (reviewedTuition) {
      $('pay-payOption').value = reviewedTuition.paymentOption;
      $('pay-payOption').closest('.pw-field').hidden = true;
      $('pay-amount').value = reviewedTuition.amount / 100;
      $('pay-amount').readOnly = true;
      const summary = document.createElement('div');summary.className='tuition-review-summary';
      summary.innerHTML = `<strong>Student details confirmed</strong><p>${esc([reviewedTuition.firstName,reviewedTuition.lastName].filter(Boolean).join(" "))} · ${esc(reviewedTuition.studentNumber)}<br>${esc(reviewedTuition.email)}<br>${esc(reviewedTuition.campus)} · ${esc(reviewedTuition.year)} · ${esc(reviewedTuition.section)}<br>${esc(reviewedTuition.paymentTerm)} · ${pesos(reviewedTuition.amount)}${reviewedTuition.studentNumber!==a.studentNumber?'<br>Applied to your signed-in student account: '+esc(a.studentNumber):''}</p><button type="button" id="tuitionEditDetails" class="pw-btn">Edit details</button>`;
      $('payOnline').before(summary);
      $('tuitionEditDetails').onclick=()=>{selection={purpose:'Tuition',id:target.id,tuitionDraft:reviewedTuition};paymentView();};
    }
    $("payOnline").onsubmit = handle(async (e) => {
      if (!e.target.reportValidity()) return;
      const form = e.target,
        f = new FormData(form),
        submit = form.querySelector("button");
      submit.disabled = true;
      try {
        const liveTarget = paymentTarget(),
          amount = cents(f.get("amount")),
          method = f.get("method"),
          result = f.get("demoResult");
        if (
          amount < 1 ||
          amount > liveTarget.max ||
          (reviewedTuition && amount !== reviewedTuition.amount) ||
          (liveTarget.purpose === "Uniform" && amount !== liveTarget.max) ||
          (f.get("payOption") === "Full" && amount !== liveTarget.max) ||
          !methods.includes(method) ||
          !["Pending", "Failed"].includes(result)
        )
          throw Error("Check the payment amount and method.");
        const existing = db.transactions.find(
          (t) =>
            t.studentNumber === a.studentNumber &&
            t.purpose === target.purpose &&
            (target.purpose === "Tuition"
              ? t.assessmentId === target.id
              : t.orderId === target.id) &&
            t.status === "Pending",
        );
        if (existing)
          throw Error(
            "A payment is already pending. Resolve that transaction before retrying.",
          );
        let tx;
        atomic(
          "Submitted demo online payment",
          () => {
            tx = {
              id: uid("TXN"),
              at: stamp(),
              studentNumber: a.studentNumber,
              studentName: a.name,
              course: a.course,
              year: a.year,
              email: a.email,
              purpose: target.purpose,
              assessmentId: target.purpose === "Tuition" ? target.id : "",
              orderId: target.purpose === "Uniform" ? target.id : "",
              amount,
              method,
              status: "Pending",
              reference: String(f.get("digitalReference") || "").trim(),
              receiptNumber: "",
              gateway: "Demo gateway",
              paymentOption: f.get("payOption") || "Full",
              ...(reviewedTuition ? {tuitionDetails: reviewedTuition, studentName:[reviewedTuition.firstName,reviewedTuition.lastName].filter(Boolean).join(' '), submittedStudentNumber:reviewedTuition.studentNumber, email:reviewedTuition.email, campus: reviewedTuition.campus, section: reviewedTuition.section, year: reviewedTuition.year, paymentTerm: reviewedTuition.paymentTerm} : {}),
              events: [],
            };
            if (!tx.reference || db.transactions.some(t => t.reference.toLowerCase() === tx.reference.toLowerCase()))
              throw Error("Enter a unique digital payment reference.");
            tx.status = result;
            tx.events.push({at:stamp(),status:result,source:a.name});
            const r = ticketRecord(target.purpose, target.id);
            if (!r.cashierTicket || r.cashierTicket.closedAt) {
              r.cashierTicket = {submittedAt:stamp(),notes:[],acknowledgedAt:"",acknowledgedBy:""};
            }
            db.transactions.unshift(tx);
            notify(a.studentNumber, "Payment submitted", target.id + " · " + tx.id + " · " + (result === "Pending" ? "Awaiting verification" : "Rejected"));
            notify(a.studentNumber, "New checkout ticket", target.id + " · " + tx.id + " · " + a.name + " · Awaiting cashier review", "Cashier");
          },
          ["Student"],
        );
        // Verification is performed by an authenticated cashier, not this submission.
        open(reviewedTuition ? "paymentStatus" : "transactions", reviewedTuition ? tx.id : null);
        msg(
          "Demo payment " +
            result.toLowerCase() +
            ". " +
            (result === "Successful"
              ? "Electronic receipt is ready."
              : "No balance has been deducted."),
        );
      } finally {
        submit.disabled = false;
      }
    });
  }
  // Idempotent demo verifier. Real integrations must do this only on a trusted server,
  // after verifying the provider signature, currency, amount and payment ownership.
  function applyDemoResult(id, result) {
    guard(["Cashier", "Admin"]);
    const tx = getTransaction(id);
    if (tx.status !== "Pending") return;
    atomic(
      "Received demo gateway result",
      () => {
        if (!["Successful", "Pending", "Failed"].includes(result))
          throw Error("Invalid gateway result.");
        if (result === "Pending") return;
        const ref = tx.reference || "DEMO-" + tx.id;
        if (
          db.transactions.some(
            (t) => t.id !== id && t.reference.toLowerCase() === ref.toLowerCase(),
          )
        )
          throw Error("Duplicate gateway reference rejected.");
        if (result === "Successful") {
          tx.recordedBy = account().name;
          if (tx.purpose === "Tuition") {
            const x = db.assessments.find((x) => x.id === tx.assessmentId);
            if (!x || tx.amount < 1 || tx.amount > balance(x))
              throw Error("Payment exceeds the latest tuition balance.");
            tx.remainingBalance = balance(x) - tx.amount;
            if (tx.remainingBalance === 0 && x.cashierTicket) x.cashierTicket.closedAt = stamp();
          } else {
            const o = orders.find((o) => o.id === tx.orderId);
            if (
              !o ||
              orderStatus(o) !== "Awaiting Payment" ||
              o.paymentStatus === "Paid" ||
              tx.amount !== cents(o.total)
            )
              throw Error("This order has already been paid or changed.");
            tx.remainingBalance = 0;
            if (o.cashierTicket) o.cashierTicket.closedAt = stamp();
            Object.assign(o, {
              status: "Paid",
              paymentStatus: "Paid",
              payment: tx.method,
              amountReceived: tx.amount / 100,
              referenceNumber: ref,
              paidAt: stamp(),
              receiptNumber: "E-" + tx.id,
              change: 0,
            });
          }
          tx.receiptNumber = "E-" + tx.id;
          notify(
            tx.studentNumber,
            "Payment confirmed",
            `${tx.id} · ${tx.purpose} · ${pesos(tx.amount)} · Demo`,
          );
          notify(
            tx.studentNumber,
            "Online payment succeeded",
            `${tx.studentName} · ${tx.studentNumber} · ${tx.purpose} · ${pesos(tx.amount)} · ${tx.id}`,
            "Cashier",
          );
        }
        tx.status = result;
        tx.reference = ref;
        tx.verifiedAt = stamp();
        tx.events.push({ at: stamp(), status: result, source: "Simulated gateway" });
      },
      ["Cashier", "Admin"],
    );
  }
  function cashPaymentView() {
    guard(['Cashier','Admin']);
    const {purpose,id}=selection||{},record=ticketRecord(purpose,id);
    const maximum=purpose==='Tuition'?balance(record):(orderStatus(record)==='Awaiting Payment'?cents(record.total):0);
    if(maximum<=0)throw Error('Choose an unpaid ticket.');
    const s=db.accounts.find(a=>a.role==='Student'&&a.studentNumber===record.studentNumber);
    if(!s)throw Error('An administrator must create a student account before recording payment.');
    const token=uid('REQUEST');
    $('payContent').innerHTML=`<section class="pw-card"><h2>ITsCash · Record payment</h2><p>${esc(s.name)} · ${esc(s.studentNumber)} · ${esc(purpose)}<br>Outstanding: <b>${pesos(maximum)}</b></p><form id="payCash" class="pw-form">${select('staffMethod','Payment method',allMethods)}${purpose==='Tuition'?select('staffPlan','Payment option',['Full','Installment']):''}${input('cashAmount','Amount applied (₱)',maximum/100,'number',`min="0.01" max="${maximum/100}" step="0.01"`)}${input('cashReceived','Amount received (₱)','','number','min="0.01" step="0.01"')}${input('staffReference','Digital payment reference','','text','maxlength="120"')}${select('staffOutcome','Digital verification (simulation)',['Pending','Verified','Rejected'])}${input('cashReason','Transaction note / reason')}<output id="staffChange" class="pw-note pw-full" aria-live="polite"></output><label class="pay-check pw-full"><input id="pay-cashConfirm" type="checkbox" required>I have checked this payment. Digital outcomes are demonstration records.</label><button class="pw-btn pw-primary" type="submit">Record payment once</button></form></section>`;
    const refresh=()=>{const cash=$('pay-staffMethod').value==='Cash',full=purpose==='Uniform'||$('pay-staffPlan')?.value==='Full';$('pay-cashAmount').readOnly=full;if(full)$('pay-cashAmount').value=maximum/100;$('pay-staffReference').required=!cash;$('pay-staffReference').disabled=cash;$('pay-staffReference').closest('.pw-field').hidden=cash;$('pay-staffOutcome').disabled=cash;$('pay-staffOutcome').closest('.pw-field').hidden=cash;const a=Number($('pay-cashAmount').value),r=Number($('pay-cashReceived').value);$('staffChange').textContent=cash?(r>=a?'Cash change: '+money(r-a):'Insufficient cash: '+money(Math.max(0,a-r))):'Digital payments remain unpaid until verified. Enter the exact transfer amount.';};
    for(const k of ['staffMethod','staffPlan','cashAmount','cashReceived'])if($('pay-'+k))$('pay-'+k).oninput=refresh;refresh();
    $('payCash').onsubmit=handle(e=>{
      if(!e.target.reportValidity())return;
      const submit=e.target.querySelector('button[type="submit"]');submit.disabled=true;
      try{
        const f=new FormData(e.target);let tx;
        atomic('Recorded cashier payment for '+id,()=>{
          const live=ticketRecord(purpose,id),max=purpose==='Tuition'?balance(live):(orderStatus(live)==='Awaiting Payment'?cents(live.total):0);
          if(db.transactions.some(t=>t.requestToken===token))throw Error('This payment has already been recorded.');
          if(db.transactions.some(t=>t.status==='Pending'&&(purpose==='Tuition'?t.assessmentId===id:t.orderId===id)))throw Error('Resolve the payment awaiting verification before recording another.');
          const amount=cents(f.get('cashAmount')),received=cents(f.get('cashReceived')),method=f.get('staffMethod'),reference=String(f.get('staffReference')||'').trim(),note=String(f.get('cashReason')||'').trim(),plan=f.get('staffPlan')||'Full';
          if(!allMethods.includes(method)||!amount||amount>max||received<amount||!note||(plan==='Full'&&amount!==max)||(purpose==='Uniform'&&amount!==max))throw Error('Check amount received, payment option, outstanding balance and notes.');
          if(method!=='Cash'&&(!reference||received!==amount))throw Error('Enter the exact digital amount and its payment reference.');
          if(method!=='Cash'&&db.transactions.some(t=>t.reference.toLowerCase()===reference.toLowerCase()))throw Error('This payment reference has already been recorded.');
          const outcome=method==='Cash'?'Verified':f.get('staffOutcome');if(!['Pending','Verified','Rejected'].includes(outcome))throw Error('Invalid verification outcome.');
          const at=stamp(),txId=uid('TXN'),cash=method==='Cash';
          tx={id:txId,requestToken:token,at,studentNumber:s.studentNumber,studentName:s.name,course:s.course,year:s.year,email:s.email,purpose,assessmentId:purpose==='Tuition'?id:'',orderId:purpose==='Uniform'?id:'',amount,amountReceived:received,change:cash?received-amount:0,method,status:cash?'Successful':outcome==='Rejected'?'Failed':'Pending',reference:cash?'CASH-'+txId:reference,receiptNumber:cash?'E-'+txId:'',gateway:cash?'Manual cash record':'Cashier demo verification',recordedBy:account().name,paymentOption:plan,events:[{at,status:cash?'Successful':outcome==='Rejected'?'Failed':'Pending',source:account().name,reason:note}],remainingBalance:cash?max-amount:undefined,verifiedAt:cash?at:''};
          db.transactions.unshift(tx);
          live.cashierTicket||={submittedAt:at,notes:[]};live.cashierTicket.notes.push({at,by:account().name,text:note});
          if(cash){if(purpose==='Uniform')Object.assign(live,{status:'Paid',paymentStatus:'Paid',payment:method,amountReceived:received/100,change:tx.change/100,referenceNumber:tx.reference,receiptNumber:tx.receiptNumber,paidAt:at});if(max===amount)live.cashierTicket.closedAt=at;notify(s.studentNumber,'Payment confirmation',`${id} · ${tx.id} · ${pesos(amount)} received · Balance ${pesos(max-amount)}`);}
          else{notify(s.studentNumber,outcome==='Rejected'?'Payment rejected':'Payment awaiting verification',`${id} · ${tx.id} · ${reference}`);notify(s.studentNumber,'Digital payment verification request',`${id} · ${tx.id} · ${s.name} · ${reference}`,'Cashier');}
        });
        if(f.get('staffMethod')!=='Cash'&&f.get('staffOutcome')==='Verified')applyDemoResult(tx.id,'Successful');
        if (tx.status === 'Successful') open('receipt', tx.id); else open('transactions');
        msg('Payment recorded. Only verified payments update balances and have receipts.');
      }finally{submit.disabled=false;}
    });
  }
  function transactionTable(txs) {
    return table(
      [
        "Transaction / reference",
        "Student",
        "Purpose",
        "Amount",
        "Method",
        "Status",
        "Date",
        "Receipt",
      ],
      txs.map((t) => [
        esc(t.id) + "<small>" + esc(t.reference || "Awaiting gateway result") + "</small>",
        esc(t.studentNumber) + "<small>" + esc(t.studentName) + "</small>",
        esc(t.purpose),
        pesos(t.amount),
        esc(t.method),
        badge(t.status),
        esc(formatDate(t.at)),
        t.receiptNumber && ["Successful", "Refunded"].includes(t.status)
          ? `<button class="pw-btn" data-receipt="${esc(t.id)}">View receipt</button>`
          : "—",
      ]),
    );
  }
  function wireTransactionLinks() {
    shell
      .querySelectorAll("[data-receipt]")
      .forEach((b) => (b.onclick = () => open("receipt", b.dataset.receipt)));
  }
  function transactionsView() {
    const a = guard(),
      staff = a.role !== "Student";
    $("payContent").innerHTML =
      `<section class="pw-card"><h2>Payment history</h2><div class="pw-toolbar">${input("txSearch", "Search student, name, order, or reference", "", "search")}${select("txStatus", "Payment status", ["All", "Pending", "Successful", "Failed", "Refunded"])}</div><div id="payTransactions"></div></section>`;
    const draw = () => {
      const q = $("pay-txSearch").value.toLowerCase().trim(),
        status = $("pay-txStatus").value,
        txs = ownTransactions().filter(
          (t) =>
            (status === "All" || t.status === status) &&
            [t.id, t.studentNumber, t.studentName, t.orderId, t.reference]
              .join(" ")
              .toLowerCase()
              .includes(q),
        );
      $("payTransactions").innerHTML =
        transactionTable(txs) +
        txs
          .filter(
            (t) =>
              t.status === "Pending" || (a.role === "Admin" && t.status === "Successful"),
          )
          .map(
            (t) =>
              `<div class="pay-actions"><b>${esc(t.id)}</b>${staff && t.status === "Pending" ? `<button class="pw-btn" data-resolve="${esc(t.id)}" data-result="Successful">Verify payment (demo)</button><button class="pw-btn" data-resolve="${esc(t.id)}" data-result="Failed">Reject payment (demo)</button>` : ""}${a.role === "Admin" && t.status === "Successful" ? `<button class="pw-btn pw-danger" data-refund="${esc(t.id)}">Authorized refund</button>` : ""}</div><div id="payRefund-${esc(t.id)}"></div>`,
          )
          .join("");
      wireTransactionLinks();
      shell.querySelectorAll("[data-resolve]").forEach(
        (b) =>
          (b.onclick = handle(() => {
            applyDemoResult(b.dataset.resolve, b.dataset.result);
            render();
            msg("Simulated gateway result recorded once.");
          })),
      );
      shell
        .querySelectorAll("[data-refund]")
        .forEach((b) => (b.onclick = () => refundForm(b.dataset.refund)));
    };
    $("pay-txSearch").oninput = draw;
    $("pay-txStatus").onchange = draw;
    draw();
  }
  function refundForm(id) {
    guard(["Admin"]);
    const t = getTransaction(id);
    $("payRefund-" + id).innerHTML =
      `<form id="payRefund" class="pw-form" style="margin-top:14px">${input("refundReason", "Refund reason")}<p class="pw-muted">Full demo refund of ${pesos(t.amount)}. Claimed uniforms must first be fully returned through Proware.</p><button class="pw-btn pw-danger" type="submit">Confirm authorized demo refund</button></form>`;
    $("payRefund").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      const reason = $("pay-refundReason").value.trim();
      atomic(
        "Processed authorized demo refund",
        () => {
          if (t.status !== "Successful" || !reason)
            throw Error("Only a successful payment can be refunded. A reason is required.");
          if (t.purpose === "Uniform") {
            const o = orders.find((o) => o.id === t.orderId);
            if (!o) throw Error("Original uniform order is missing.");
            if (orderStatus(o) === "Claimed" && !Proware.fullyReturned(o.id))
              throw Error("Record the return of all issued uniforms in Proware first.");
            if (orderStatus(o) !== "Claimed") Proware.releaseReservation(o, account().name);
            o.status = "Cancelled";
            o.paymentStatus = "Refunded";
            o.refundedAt = stamp();
          }
          Object.assign(t, {
            status: "Refunded",
            refundReason: reason,
            refundedBy: account().name,
            refundedAt: stamp(),
            refundReference: "DEMO-REFUND-" + t.id,
          });
          t.events.push({ at: stamp(), status: "Refunded", source: account().name, reason });
          notify(
            t.studentNumber,
            "Demo refund recorded",
            `${t.id} · ${pesos(t.amount)} · ${reason}`,
          );
        },
        ["Admin"],
      );
      render();
      msg("Demo refund recorded. Balances and inventory were updated.");
    });
  }
  function receiptMarkup(t) {
    if (!t.receiptNumber || !["Successful", "Refunded"].includes(t.status)) throw Error("Receipt unavailable until payment is verified.");
    const r = t.purpose === 'Tuition' ? db.assessments.find(a=>a.id===t.assessmentId) : orders.find(o=>o.id===t.orderId);
    const breakdown = t.purpose === 'Uniform' ? (r?.items||[]).map(i=>[esc(i.name)+' · '+esc(i.size),i.qty,money(i.price),money(i.price*i.qty)]) : (r?.fees||[]).map(f=>[esc(f.label),'—','—',pesos(f.amount)]);
    return `<article class="pay-receipt"><p class="pay-kicker">STI SCHOOL PAYMENTS · DEMO ELECTRONIC RECEIPT</p><h2>${esc(t.receiptNumber)}</h2><p>${badge(t.status)} · This is a simulation receipt, not proof of an actual transfer.</p><dl>${[
      ["Student number", t.submittedStudentNumber || t.studentNumber],
      ...(t.submittedStudentNumber && t.submittedStudentNumber !== t.studentNumber ? [["Account student number", t.studentNumber]] : []),
      ["Full name", t.studentName],
      ["Course / grade level", t.course],
      ["Year level", t.year],
      ["Email address", t.email],
      ["Payment purpose", t.purpose],
      ...(t.purpose === 'Tuition' ? [["School campus", t.campus || "Not recorded"], ["Section", t.section || "Not recorded"], ["Payment term", t.paymentTerm || t.paymentOption]] : []),
      ["Order / assessment", t.orderId || t.assessmentId],
      ["Amount paid", pesos(t.amount)],
      ["Remaining balance after this payment", t.remainingBalance !== undefined ? pesos(t.remainingBalance) : (t.purpose === 'Tuition' && r ? pesos(balance(r)) + ' (current)' : pesos(0))],
      ["Payment method", t.method],
      ["Payment date", formatDate(t.verifiedAt || t.at)],
      ["Transaction number", t.id],
      ["Reference number", t.reference],
      ["Cash received", t.method === "Cash" ? pesos(t.amountReceived) : "Not applicable"],
      ["Change", t.method === "Cash" ? pesos(t.change) : "Not applicable"],
      ["Recorded / verified by", t.recordedBy || "Demo gateway"],
      ["Refund reason", t.refundReason || "Not applicable"],
    ]
      .map(([k, v]) => `<dt><b>${k}</b></dt><dd>${esc(v)}</dd>`)
      .join("")}</dl><h3>Payment breakdown</h3>${table(['Item / fee','Quantity','Unit price','Total'],breakdown)}</article>`;
  }
  function receiptDocument(t) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.receiptNumber)}</title><style>body{font:14px/1.6 system-ui;max-width:760px;margin:40px auto;padding:24px;color:#193348}dl{display:grid;grid-template-columns:180px 1fr;gap:10px}dd{margin:0;overflow-wrap:anywhere}@media print{body{margin:0}}</style></head><body>${receiptMarkup(t)}</body></html>`;
  }
  function receiptView() {
    let t;
    try {
      t = getTransaction(selection);
    } catch (e) {
      $("payContent").innerHTML =
        '<section class="pw-card"><h2>Receipt unavailable</h2><p>This receipt is not available for the signed-in account.</p></section>';
      msg(e.message, true);
      return;
    }
    if (!t.receiptNumber || !["Successful", "Refunded"].includes(t.status))
      throw Error("A receipt is available only after successful payment.");
    $("payContent").innerHTML =
      `<section class="pw-card">${t.purpose === 'Tuition' && t.status === 'Successful' ? '<div class="tuition-receipt-confirmed"><strong>Payment confirmed</strong><span>Your tuition payment has been verified. Your receipt is ready below.</span></div>' : ''}${receiptMarkup(t)}<div class="pay-actions">${btn("Download receipt", "download", true)}${btn("Print / Save as PDF", "print")}</div></section>`;
    shell.querySelector('[data-pay="download"]').onclick = handle(() => {
      getTransaction(t.id);
      download(receiptDocument(t), "receipt-" + t.receiptNumber + ".html", "text/html");
    });
    shell.querySelector('[data-pay="print"]').onclick = handle(() => {
      getTransaction(t.id);
      const w = window.open("", "_blank", "width=850,height=900");
      if (!w) throw Error("Allow popups to print the receipt.");
      w.document.write(receiptDocument(t));
      w.document.close();
      w.focus();
      w.print();
    });
  }
  function noticesView() {
    const a = guard(),
      staff = a.role !== "Student";
    const notices = db.notices.filter((n) =>
        staff
          ? n.audience === "Cashier"
          : n.audience === "Student" && n.studentNumber === a.studentNumber,
      ),
      upcoming = db.assessments
        .filter((x) => staff || x.studentNumber === a.studentNumber)
        .map((x) => ({ x, n: nextInstallment(x) }))
        .filter(
          ({ n }) =>
            n &&
            (new Date(n.date + "T00:00:00Z") - new Date(today() + "T00:00:00Z")) / 86400000 <=
              7,
        );
    $("payContent").innerHTML =
      `<section class="pw-card"><h2>Notifications</h2>${upcoming.map(({ x, n }) => `<div class="pw-note pw-warning"><b>${n.date < today() ? "Tuition overdue" : "Tuition due soon"}</b> · ${esc(x.studentNumber)} · ${esc(x.schoolYear)} / ${esc(x.semester)}<br>${pesos(n.outstanding)} due ${esc(n.date)}</div>`).join("")}${notices.map((n) => `<article class="pw-card ${n.readBy.includes(a.id) ? "" : "pay-unread"}"><b>${esc(n.title)}</b><p>${esc(n.text)}</p><small class="pw-muted">${esc(formatDate(n.at))}</small></article>`).join("") || '<p class="pw-muted">No payment notifications yet.</p>'}</section>`;
    notices.forEach((n) => {
      if (!n.readBy.includes(a.id)) n.readBy.push(a.id);
    });
    write();
  }
  function reviewsView() {
    guard(["Cashier", "Admin"]);
    $("payContent").innerHTML =
      `<section class="pw-card"><h2>Review payment discrepancies</h2><form id="payReview" class="pw-form">${select("reviewTx", "Transaction", [["", "Choose transaction"], ...db.transactions.map((t) => [t.id, t.id + " · " + t.studentNumber])], "", "required")}${input("reviewReason", "Discrepancy / review reason")}<button class="pw-btn pw-primary" type="submit">Open review</button></form></section><section class="pw-card">${table(
        ["Date", "Transaction", "Reason", "Opened by", "Status", "Resolution"],
        db.reviews.map((r) => [
          esc(formatDate(r.at)),
          esc(r.transactionId),
          esc(r.reason),
          esc(r.staff),
          esc(r.status),
          r.status === "Open"
            ? `<button class="pw-btn" data-review="${esc(r.id)}">Resolve review</button>`
            : esc(r.resolution) + "<small>" + esc(r.resolvedBy) + "</small>",
        ]),
      )}<div id="payReviewResolve"></div></section>`;
    $("payReview").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      atomic("Opened payment discrepancy review", () => {
        getTransaction($("pay-reviewTx").value);
        const reason = $("pay-reviewReason").value.trim();
        if (!reason) throw Error("Enter a review reason.");
        db.reviews.unshift({
          id: uid("REVIEW"),
          at: stamp(),
          transactionId: $("pay-reviewTx").value,
          reason,
          staff: account().name,
          status: "Open",
        });
      });
      render();
    });
    shell.querySelectorAll("[data-review]").forEach(
      (b) =>
        (b.onclick = () => {
          $("payReviewResolve").innerHTML =
            `<form id="payResolveReview" class="pw-form">${input("resolution", "Resolution / action taken")}<button class="pw-btn pw-primary">Save review resolution</button></form>`;
          $("payResolveReview").onsubmit = handle((e) => {
            if (!e.target.reportValidity()) return;
            atomic("Resolved payment discrepancy review", () => {
              const r = db.reviews.find((r) => r.id === b.dataset.review);
              Object.assign(r, {
                status: "Resolved",
                resolution: $("pay-resolution").value.trim(),
                resolvedBy: account().name,
                resolvedAt: stamp(),
              });
            });
            render();
          });
        }),
    );
  }
  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csv(headers, rows) {
    return (
      "\ufeff" +
      [headers, ...rows]
        .map((r) =>
          r
            .map((v) => {
              let s = String(v ?? "");
              if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
              return '"' + s.replaceAll('"', '""') + '"';
            })
            .join(","),
        )
        .join("\r\n")
    );
  }
  function reportsView() {
    guard(["Cashier", "Admin"]);
    $("payContent").innerHTML =
      `<section class="pw-card"><h2>Collection reports</h2><form id="payReports" class="pw-toolbar">${select("period", "Period", ["Daily", "Weekly", "Monthly"])}${input("reportDate", "Date", today(), "date")}${select("reportKind", "Report", ["Collections by purpose", "Collections by method", "Unpaid tuition balances", "Installment payments", "Refunds", "Manual adjustments"])}<button class="pw-btn pw-primary" type="submit">Generate</button><button class="pw-btn" type="button" id="payReportDownload">Download CSV</button></form><p id="payReportPeriod" class="pw-muted"></p><div id="payReport"></div></section>`;
    const generate = () => {
      const date = $("pay-reportDate").value;
      if (!date) throw Error("Choose a report date.");
      let from = date,
        to = date;
      const period = $("pay-period").value;
      if (period === "Weekly") {
        const d = new Date(date + "T00:00:00Z"),
          offset = (d.getUTCDay() + 6) % 7;
        d.setUTCDate(d.getUTCDate() - offset);
        from = d.toISOString().slice(0, 10);
        d.setUTCDate(d.getUTCDate() + 6);
        to = d.toISOString().slice(0, 10);
      }
      if (period === "Monthly") {
        from = date.slice(0, 7) + "-01";
        const [y, m] = date.split("-").map(Number);
        to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      }
      const range = (d) => dateKey(d) >= from && dateKey(d) <= to,
        tx = db.transactions.filter(
          (t) => ["Successful", "Refunded"].includes(t.status) && range(t.verifiedAt || t.at),
        ),
        kind = $("pay-reportKind").value;
      let headers, rows;
      if (kind === "Collections by purpose" || kind === "Collections by method") {
        const keys = kind === "Collections by purpose" ? ["Tuition", "Uniform"] : allMethods;
        headers = [
          kind === "Collections by purpose" ? "Purpose" : "Payment method",
          "Successful payments",
          "Amount (PHP)",
        ];
        rows = keys.map((k) => {
          const a = tx.filter(
            (t) => (kind === "Collections by purpose" ? t.purpose : t.method) === k,
          );
          return [k, a.length, (a.reduce((s, t) => s + t.amount, 0) / 100).toFixed(2)];
        });
      }
      if (kind === "Unpaid tuition balances") {
        headers = [
          "Student number",
          "Full name",
          "School year",
          "Semester",
          "Payment option",
          "Total assessed (PHP)",
          "Paid (PHP)",
          "Balance (PHP)",
          "Next due",
        ];
        rows = db.assessments
          .filter((a) => balance(a) > 0)
          .map((a) => [
            a.studentNumber,
            student(a.studentId).name,
            a.schoolYear,
            a.semester,
            a.plan,
            (assessedTotal(a) / 100).toFixed(2),
            (assessmentPaid(a) / 100).toFixed(2),
            (balance(a) / 100).toFixed(2),
            nextInstallment(a)?.date || "",
          ]);
      }
      if (kind === "Installment payments") {
        headers = [
          "Transaction",
          "Student number",
          "Assessment",
          "Amount (PHP)",
          "Date",
          "Method",
        ];
        rows = tx
          .filter((t) => t.purpose === "Tuition" && t.paymentOption === "Installment")
          .map((t) => [
            t.id,
            t.studentNumber,
            t.assessmentId,
            (t.amount / 100).toFixed(2),
            formatDate(t.verifiedAt),
            t.method,
          ]);
      }
      if (kind === "Refunds") {
        headers = [
          "Transaction",
          "Student number",
          "Purpose",
          "Amount (PHP)",
          "Refund date",
          "Refund reference",
          "Reason",
          "Authorized by",
        ];
        rows = db.transactions
          .filter((t) => t.status === "Refunded" && range(t.refundedAt))
          .map((t) => [
            t.id,
            t.studentNumber,
            t.purpose,
            (t.amount / 100).toFixed(2),
            formatDate(t.refundedAt),
            t.refundReference,
            t.refundReason,
            t.refundedBy,
          ]);
      }
      if (kind === "Manual adjustments") {
        headers = [
          "Adjustment",
          "Student number",
          "Amount (PHP)",
          "Date",
          "Reason",
          "Staff member",
        ];
        rows = db.adjustments
          .filter((x) => range(x.at))
          .map((x) => [
            x.id,
            x.studentNumber,
            (x.amount / 100).toFixed(2),
            formatDate(x.at),
            x.reason,
            x.staff,
          ]);
      }
      reportHeaders = headers;
      reportData = rows;
      reportTitle = kind;
      $("payReportPeriod").textContent =
        `${from} through ${to} · ${kind === "Unpaid tuition balances" ? "Current outstanding balances (date filters do not apply)" : "Gross demo collections before refunds; see the separate Refunds report"} · ${rows.length} rows`;
      $("payReport").innerHTML = table(
        headers,
        rows.map((r) => r.map(esc)),
      );
    };
    $("payReports").onsubmit = handle(() => generate());
    $("payReportDownload").onclick = handle(() => {
      guard(["Cashier", "Admin"]);
      generate();
      download(
        csv(reportHeaders, reportData),
        "school-payments-" + today() + ".csv",
        "text/csv",
      );
      log("Exported collection report", reportTitle);
      write();
    });
    generate();
  }
  function settlementsView() {
    guard(["Cashier", "Admin"]);
    $("payContent").innerHTML =
      `<section class="pw-card"><h2>Gateway settlement comparison</h2><p class="pw-muted">Import settlement data from the demo gateway or your own test file. Compare gross amounts in PHP before gateway fees; this does not connect to a provider account.</p><form id="paySettlement" class="pw-form">${field("settlementFile", "Settlement JSON file", '<input id="pay-settlementFile" type="file" accept=".json,application/json" required>')}<p class="pw-muted">Format: [{"reference":"DEMO-TXN-…","amount":1000,"method":"GCash","date":"2026-10-18","status":"Successful"}]</p><button class="pw-btn pw-primary">Import & compare</button><button class="pw-btn" id="paySettlementTemplate" type="button">Download test settlement file</button></form><div id="paySettlementResults" style="margin-top:18px"></div></section>`;
    const recordedSettlements = () =>
      db.transactions
        .filter((t) => t.method !== "Cash" && t.receiptNumber)
        .flatMap((t) => [
          {
            reference: t.reference,
            amount: t.amount,
            method: t.method,
            date: dateKey(t.verifiedAt),
            status: "Successful",
          },
          ...(t.status === "Refunded"
            ? [
                {
                  reference: t.refundReference,
                  amount: t.amount,
                  method: t.method,
                  date: dateKey(t.refundedAt),
                  status: "Refunded",
                },
              ]
            : []),
        ]);
    const compare = () => {
      const rows = [],
        seen = new Set(),
        recorded = recordedSettlements();
      for (const s of db.settlements) {
        const t = recorded.find((t) => t.reference === s.reference),
          same = t && t.amount === s.amount && t.method === s.method && t.status === s.status;
        seen.add(s.reference);
        rows.push([
          esc(s.reference),
          pesos(s.amount),
          esc(s.method),
          esc(s.status),
          t ? pesos(t.amount) : "—",
          esc(same ? "Matched" : t ? "Discrepancy" : "Gateway-only record"),
        ]);
      }
      for (const t of recorded.filter((t) => !seen.has(t.reference)))
        rows.push([
          esc(t.reference),
          "—",
          esc(t.method),
          esc(t.status),
          pesos(t.amount),
          "Recorded payment / refund missing from settlement",
        ]);
      $("paySettlementResults").innerHTML = table(
        [
          "Gateway reference",
          "Gateway gross",
          "Method",
          "Status",
          "Recorded amount",
          "Comparison",
        ],
        rows,
      );
    };
    $("paySettlementTemplate").onclick = handle(() => {
      guard(["Cashier", "Admin"]);
      download(
        JSON.stringify(
          recordedSettlements().map((t) => ({ ...t, amount: t.amount / 100 })),
          null,
          2,
        ),
        "demo-settlement.json",
        "application/json",
      );
    });
    $("paySettlement").onsubmit = handle(async (e) => {
      if (!e.target.reportValidity()) return;
      const f = $("pay-settlementFile").files[0];
      if (!f || f.size > 2000000) throw Error("Select a JSON file under 2 MB.");
      const list = JSON.parse(await f.text());
      if (
        !Array.isArray(list) ||
        list.length > 10000 ||
        new Set(list.map((x) => x.reference)).size !== list.length
      )
        throw Error("Use a settlement array with unique references.");
      const normalized = list.map((x) => {
        if (
          typeof x.reference !== "string" ||
          x.reference.length > 150 ||
          !methods.includes(x.method) ||
          !["Successful", "Refunded"].includes(x.status) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(x.date)
        )
          throw Error("Check settlement references, methods, dates, and statuses.");
        return { ...x, amount: cents(x.amount) };
      });
      atomic("Imported settlement comparison", () => {
        db.settlements = normalized;
      });
      compare();
      msg("Settlement records compared.");
    });
    compare();
  }
  function accountsView() {
    guard(["Admin"]);
    $("payContent").innerHTML =
      `<div class="pw-grid"><section class="pw-card"><h2>Students, cashiers & administrators</h2>${table(
        ["Name", "Username", "Role", "Student number", "Status", "Action"],
        db.accounts.map((a) => [
          esc(a.name),
          esc(a.username),
          esc(a.role),
          esc(a.studentNumber || "—"),
          a.active ? "Active" : "Disabled",
          `<button class="pw-btn" data-user="${esc(a.id)}">Manage</button>`,
        ]),
      )}</section><section class="pw-card"><h2 id="payAccountTitle">Add account</h2><form id="payAccount" class="pw-form">${input("accountName", "Full name")}${input("accountUsername", "Username", "", "text", 'pattern="[A-Za-z0-9._-]{3,40}"')}${select("accountRole", "Account role", ["Student", "Cashier", "Admin"])}${input("accountPassword", "Password", "", "password", 'minlength="8" autocomplete="new-password"')}${input("studentNumber", "Student number")}${input("course", "Course / grade level")}${input("year", "Year level")}${input("email", "Email address", "", "email")}<button class="pw-btn pw-primary" type="submit">Save account</button></form><div id="payAccountActions"></div></section></div>`;
    let edited = null;
    const roleChange = () => {
      const st = $("pay-accountRole").value === "Student";
      for (const key of ["studentNumber", "course", "year", "email"]) {
        $("pay-" + key).required = st;
        $("pay-" + key).closest(".pw-field").hidden = !st;
      }
    };
    $("pay-accountRole").onchange = roleChange;
    roleChange();
    shell.querySelectorAll("[data-user]").forEach(
      (b) =>
        (b.onclick = () => {
          const a = db.accounts.find((a) => a.id === b.dataset.user);
          edited = a.id;
          $("payAccountTitle").textContent = "Manage " + a.name;
          for (const [key, v] of Object.entries({
            accountName: a.name,
            accountUsername: a.username,
            accountRole: a.role,
            studentNumber: a.studentNumber || "",
            course: a.course || "",
            year: a.year || "",
            email: a.email || "",
          }))
            $("pay-" + key).value = v;
          $("pay-accountPassword").required = false;
          $("pay-accountPassword").value = "";
          $("pay-accountPassword").placeholder = "Leave blank to keep password";
          $("pay-accountRole").disabled = true;
          $("pay-studentNumber").readOnly = true;
          roleChange();
          $("payAccountActions").innerHTML =
            `<p class="pw-muted">Role and student number are fixed to preserve record ownership. Leave the password blank to keep it.</p><button class="pw-btn" id="payToggleAccount">${a.active ? "Disable" : "Enable"} account</button><button class="pw-btn" id="payNewAccount">Add another account</button>`;
          $("payNewAccount").onclick = () => accountsView();
          $("payToggleAccount").onclick = handle(() => {
            atomic(
              "Changed account access",
              () => {
                const t = db.accounts.find((a) => a.id === edited);
                if (t.id === session) throw Error("You cannot disable your own account.");
                if (
                  t.role === "Admin" &&
                  t.active &&
                  db.accounts.filter((a) => a.role === "Admin" && a.active).length <= 1
                )
                  throw Error("Keep one active Admin account.");
                t.active = !t.active;
              },
              ["Admin"],
            );
            render();
          });
        }),
    );
    $("payAccount").onsubmit = handle(async (e) => {
      guard(["Admin"]);
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target),
        password = String(f.get("accountPassword")),
        cred = password ? await credential(password) : null;
      atomic(
        "Saved payment account",
        () => {
          const existing = edited ? db.accounts.find((a) => a.id === edited) : null,
            role = existing?.role || f.get("accountRole"),
            name = String(f.get("accountName")).trim(),
            username = String(f.get("accountUsername")).trim().toLowerCase(),
            number = existing?.studentNumber || String(f.get("studentNumber") || "").trim();
          if (
            !name ||
            !/^[a-z0-9._-]{3,40}$/.test(username) ||
            !["Student", "Cashier", "Admin"].includes(role)
          )
            throw Error("Enter a name, valid username, and role.");
          if (db.accounts.some((a) => a.id !== edited && a.username === username))
            throw Error("Username already exists.");
          if (
            role === "Student" &&
            (!number ||
              db.accounts.some((a) => a.id !== edited && a.studentNumber === number))
          )
            throw Error("Student number is missing or already assigned.");
          const details = {
            name,
            username,
            role,
            ...(role === "Student"
              ? {
                  studentNumber: number,
                  course: String(f.get("course")).trim(),
                  year: String(f.get("year")).trim(),
                  email: String(f.get("email")).trim(),
                }
              : {}),
          };
          if (existing) Object.assign(existing, details, cred || {});
          else {
            if (!cred) throw Error("A new account requires a password.");
            db.accounts.push({ id: uid("USER"), active: true, ...details, ...cred });
          }
        },
        ["Admin"],
      );
      render();
      msg("Account saved. Students see only records assigned to their student number.");
    });
  }
  function activityView() {
    guard(["Admin"]);
    $("payContent").innerHTML =
      `<section class="pw-card"><h2>Activity log & backups</h2><p class="pw-muted">Download a complete school-system backup regularly and after substantial changes. A daily browser snapshot is also saved when the system is used. It includes payments, tuition, accounts, Proware inventory, and linked store records. Store it privately.</p><div class="pay-actions"><button class="pw-btn pw-primary" id="payBackup">Download full system backup</button><button class="pw-btn" id="payDailyBackup">Download daily browser snapshot</button></div><form id="payRestore" class="pw-form" style="margin-top:20px">${field("restoreFile", "Restore full system backup", '<input id="pay-restoreFile" type="file" accept=".json,application/json" required>')}${input("restoreConfirm", "Type RESTORE to replace current records", "", "text", 'pattern="RESTORE"')}<button class="pw-btn pw-danger">Restore backup</button></form></section><section class="pw-card">${table(
        ["Date", "Staff / account", "Activity", "Details"],
        db.activities.map((a) => [
          esc(formatDate(a.at)),
          esc(a.staff),
          esc(a.action),
          esc(a.detail),
        ]),
      )}</section>`;
    $("payDailyBackup").onclick = handle(() => {
      guard(["Admin"]);
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw)
        throw Error("No automatic snapshot is available. Download a full backup instead.");
      const b = JSON.parse(raw);
      download(
        raw,
        "school-daily-backup-" + dateKey(b.exportedAt) + ".json",
        "application/json",
      );
      msg("Daily snapshot from " + formatDate(b.exportedAt) + " downloaded.");
    });
    $("payBackup").onclick = handle(() => {
      guard(["Admin"]);
      log("Downloaded full system backup");
      write();
      download(
        JSON.stringify(fullSnapshot(), null, 2),
        "school-system-backup-" + today() + ".json",
        "application/json",
      );
      msg("Backup downloaded. Keep this file private.");
    });
    $("payRestore").onsubmit = handle(async (e) => {
      guard(["Admin"]);
      if (!e.target.reportValidity()) return;
      const f = $("pay-restoreFile").files[0];
      if (!f || f.size > 30000000) throw Error("Choose a backup under 30 MB.");
      const b = JSON.parse(await f.text());
      validateBackup(b);
      Proware.validateFullBackup(b);
      if (
        !confirm(
          "Replace all school payment, inventory, and store records? This will sign you out.",
        )
      )
        return;
      guard(["Admin"]);
      atomic(
        "Recovered system records",
        () => {
          const revision = db.revision;
          Proware.restoreFullBackup(b);
          db = clone(b.payments);
          db.revision = Math.max(db.revision, revision) + 1;
          log("Restored full system backup", f.name, "Admin recovery");
        },
        ["Admin"],
      );
      session = null;
      view = "dashboard";
      render();
      msg("System restored. Sign in using an account from this backup.");
    });
  }
  function validateBackup(b) {
    const fail = () => {
      throw Error("Invalid school-system backup. No records were changed.");
    };
    if (
      !b ||
      b.format !== "STI-FULL-SCHOOL-BACKUP" ||
      b.version !== 1 ||
      b.payments?.version !== 1
    )
      fail();
    const p = b.payments;
    for (const key of [
      "accounts",
      "assessments",
      "transactions",
      "notices",
      "activities",
      "reviews",
      "adjustments",
      "settlements",
    ])
      if (!Array.isArray(p[key])) fail();
    const text = (x, max = 1000) => typeof x === "string" && x.length <= max,
      safe = (x) => text(x) && /^[A-Za-z0-9._-]+$/.test(x),
      unique = (xs, k) => new Set(xs.map((x) => x[k])).size === xs.length;
    if (
      !whole(p.revision) ||
      !unique(p.accounts, "id") ||
      !unique(p.accounts, "username") ||
      !unique(p.assessments, "id") ||
      !unique(p.transactions, "id") ||
      !p.accounts.some((a) => a.role === "Admin" && a.active)
    )
      fail();
    for (const a of p.accounts)
      if (
        !safe(a.id) ||
        !text(a.name) ||
        !text(a.username) ||
        !["Student", "Cashier", "Admin"].includes(a.role) ||
        typeof a.active !== "boolean" ||
        !text(a.salt) ||
        !/^[a-f0-9]{64}$/.test(a.hash) ||
        (a.role === "Student" &&
          ["studentNumber", "course", "year", "email"].some((k) => !text(a[k])))
      )
        fail();
    const students = p.accounts.filter((a) => a.role === "Student");
    if (!unique(students, "studentNumber")) fail();
    for (const a of p.assessments)
      if (
        !safe(a.id) ||
        !students.some((s) => s.id === a.studentId && s.studentNumber === a.studentNumber) ||
        !text(a.schoolYear) ||
        !text(a.semester) ||
        !["Full", "Installment"].includes(a.plan) ||
        !Array.isArray(a.fees) ||
        a.fees.some((f) => !text(f.label) || !whole(f.amount)) ||
        !Array.isArray(a.schedule) ||
        a.schedule.some((s) => !whole(s.amount) || !/^\d{4}-\d{2}-\d{2}$/.test(s.date))
      )
        fail();
    for (const t of p.transactions)
      if (
        !safe(t.id) ||
        !students.some((a) => a.studentNumber === t.studentNumber) ||
        !["Tuition", "Uniform"].includes(t.purpose) ||
        !whole(t.amount) ||
        t.amount <= 0 ||
        !allMethods.includes(t.method) ||
        !["Pending", "Successful", "Failed", "Refunded"].includes(t.status) ||
        [
          "at",
          "studentNumber",
          "studentName",
          "course",
          "year",
          "email",
          "assessmentId",
          "orderId",
          "reference",
          "receiptNumber",
          "gateway",
          "paymentOption",
        ].some((k) => !text(t[k])) ||
        !Array.isArray(t.events)
      )
        fail();
    for (const t of p.transactions) {
      if (
        t.method === "Cash" &&
        (!whole(t.amountReceived) ||
          t.amountReceived < t.amount ||
          t.change !== t.amountReceived - t.amount)
      )
        fail();
      if (
        (t.purpose === "Tuition" &&
          !p.assessments.some(
            (a) => a.id === t.assessmentId && a.studentNumber === t.studentNumber,
          )) ||
        (t.purpose === "Uniform" &&
          !b.store?.orders?.some(
            (o) => o.id === t.orderId && o.studentNumber === t.studentNumber,
          ))
      )
        fail();
      if (
        ["Successful", "Refunded"].includes(t.status) &&
        (!t.receiptNumber || !t.reference || !Number.isFinite(Date.parse(t.verifiedAt)))
      )
        fail();
    }
    const receipts = p.transactions.filter((t) => t.receiptNumber);
    if (!unique(receipts, "receiptNumber") || !unique(receipts, "reference")) fail();
    for (const n of p.notices)
      if (
        ["id", "at", "studentNumber", "title", "text", "audience"].some((k) => !text(n[k])) ||
        !Array.isArray(n.readBy)
      )
        fail();
    for (const a of p.activities)
      if (["id", "at", "staff", "action", "detail"].some((k) => !text(a[k]))) fail();
    for (const a of p.adjustments)
      if (
        !safe(a.id) ||
        !p.assessments.some((x) => x.id === a.assessmentId) ||
        !Number.isSafeInteger(a.amount) ||
        ["at", "studentNumber", "reason", "staff"].some((k) => !text(a[k]))
      )
        fail();
    for (const r of p.reviews)
      if (
        !safe(r.id) ||
        !p.transactions.some((t) => t.id === r.transactionId) ||
        !["Open", "Resolved"].includes(r.status) ||
        ["at", "reason", "staff"].some((k) => !text(r[k]))
      )
        fail();
    for (const s of p.settlements)
      if (
        !text(s.reference) ||
        !whole(s.amount) ||
        !methods.includes(s.method) ||
        !text(s.date) ||
        !["Successful", "Refunded"].includes(s.status)
      )
        fail();
    for (const a of p.assessments) {
      const total =
          a.fees.reduce((s, f) => s + f.amount, 0) +
          p.adjustments
            .filter((x) => x.assessmentId === a.id)
            .reduce((s, x) => s + x.amount, 0),
        paid = p.transactions
          .filter((t) => t.assessmentId === a.id && t.status === "Successful")
          .reduce((s, t) => s + t.amount, 0);
      if (total < paid || total < 0) fail();
    }
  }
  // ITsCash ticket workflow. Monetary ledger values use integer centavos.
  function ticketRecord(purpose, id) {
    guard();
    const r = purpose === 'Tuition' ? db.assessments.find(x => x.id === id) : orders.find(x => x.id === id);
    if (!r || !owns(r.studentNumber)) throw Error('Ticket unavailable for this account.');
    return r;
  }
  function submitCashierTicket(purpose, id) {
    atomic('Submitted cashier checkout ticket', () => {
      const r = ticketRecord(purpose, id);
      const due = purpose === 'Tuition' ? balance(r) : (orderStatus(r) === 'Awaiting Payment' ? cents(r.total) : 0);
      if (due <= 0) throw Error('This record has no unpaid balance.');
      if (r.cashierTicket && !r.cashierTicket.closedAt) throw Error('This ticket is already in the cashier queue.');
      r.cashierTicket = {submittedAt:stamp(), notes:[], acknowledgedAt:'', acknowledgedBy:''};
      notify(r.studentNumber, 'New checkout ticket', `${purpose} · ${id} · ${pesos(due)} · Awaiting cashier acknowledgment`, 'Cashier');
    }, ['Student','Cashier','Admin']);
  }
  function ticketRows() {
    guard(['Cashier','Admin']);
    return [...orders.map(r=>({r,purpose:'Uniform'})),...db.assessments.map(r=>({r,purpose:'Tuition'}))].map(({r,purpose})=>{
      const s=db.accounts.find(a=>a.role==='Student'&&a.studentNumber===r.studentNumber);
      const tx=db.transactions.filter(t=>purpose==='Tuition'?t.assessmentId===r.id:t.orderId===r.id);
      const due=purpose==='Tuition'?balance(r):(r.paymentStatus==='Paid'?0:cents(r.total));
      const pending=tx.some(t=>t.status==='Pending');
      return {r,purpose,s,tx,due,status:purpose==='Uniform'&&orderStatus(r)==='Cancelled'?'Cancelled':pending?'Awaiting verification':due<=0?'Paid':purpose==='Tuition'&&assessmentPaid(r)>0?'Partially paid':'Unpaid',at:r.cashierTicket?.submittedAt||r.createdAt||(Number.isFinite(Date.parse(r.created)) ? r.created : '')};
    });
  }
  function dashboardViewWithTickets() {
    if (guard().role==='Student') return originalStudentDashboard();
    const all=ticketRows();
    $('payContent').innerHTML=`<section class="pw-card"><div class="pay-kicker">ITsCash</div><h2>Cashier dashboard</h2><div class="pw-toolbar">${input('deskSearch','Search ticket, student or reference','','search','aria-label="Search cashier tickets"')}${select('deskType','Transaction type',['All','Tuition','Uniform'])}${select('deskStatus','Payment status',['All','Unpaid','Partially paid','Awaiting verification','Paid','Cancelled'])}${input('deskDate','Ticket date','','date')}</div><div id="deskCounts" class="pw-stats"></div><div id="deskTickets"></div></section><section class="pw-card"><h2>Daily collections by method</h2><p class="pw-muted">Verified payments only · Asia/Manila · gross collections, before refunds</p>${input('dailyDate','Collection date',today(),'date')}<div id="deskCollections"></div></section>`;
    for(const id of ['deskSearch','deskDate']) $('pay-'+id).required=false;
    function draw(){
      const q=$('pay-deskSearch').value.trim().toLowerCase(),type=$('pay-deskType').value,status=$('pay-deskStatus').value,date=$('pay-deskDate').value;
      const rows=all.filter(x=>(type==='All'||x.purpose===type)&&(status==='All'||x.status===status)&&(!date||(x.at&&dateKey(x.at)===date))&&[x.r.id,x.r.studentNumber,x.s?.name,...x.tx.map(t=>t.reference)].join(' ').toLowerCase().includes(q));
      $('deskCounts').innerHTML=[['Pending checkout tickets',rows.filter(x=>x.r.cashierTicket&&!x.r.cashierTicket.acknowledgedAt&&!x.r.cashierTicket.closedAt&&x.due>0&&x.status!=='Cancelled').length],['Unpaid transactions',rows.filter(x=>x.due>0&&x.status!=='Cancelled').length],['Paid transactions',rows.reduce((n,x)=>n+x.tx.filter(t=>t.status==='Successful').length,0)],['Ready for Pickup',rows.filter(x=>x.purpose==='Uniform'&&orderStatus(x.r)==='Ready for Pickup').length],['Awaiting verification',rows.reduce((n,x)=>n+x.tx.filter(t=>t.status==='Pending').length,0)]].map(([k,v])=>`<div class="pw-stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
      $('deskTickets').innerHTML=table(['Ticket / type','Student','Payment status','Balance','Checkout','Action'],rows.map(x=>[esc(x.r.id)+'<small>'+x.purpose+'</small>',esc(x.r.studentNumber)+'<small>'+esc(x.s?.name||x.r.recipient||'')+'</small>',badge(x.status),pesos(x.due),x.r.cashierTicket?(x.r.cashierTicket.acknowledgedAt?'Acknowledged by '+esc(x.r.cashierTicket.acknowledgedBy):'Pending acknowledgment'):'Not submitted',`<button class="pw-btn" data-ticket="${esc(x.r.id)}" data-kind="${x.purpose}">Open ticket</button>`]));
      shell.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>open('ticket',{purpose:b.dataset.kind,id:b.dataset.ticket}));
    }
    for(const id of ['deskSearch','deskType','deskStatus','deskDate']) $('pay-'+id).oninput=draw;
    const collections=()=>{$('deskCollections').innerHTML=table(['Method','Verified payments','Amount collected'],allMethods.map(method=>{const list=db.transactions.filter(t=>t.method===method&&['Successful','Refunded'].includes(t.status)&&dateKey(t.verifiedAt||t.at)===$('pay-dailyDate').value);return [esc(method),list.length,pesos(list.reduce((n,t)=>n+t.amount,0))]}));};
    $('pay-dailyDate').onchange=collections;draw();collections();
  }
  const originalStudentDashboard=dashboardView;
  dashboardView=dashboardViewWithTickets;
  function ticketView(){
    guard(['Cashier','Admin']);
    const {purpose,id}=selection||{},r=ticketRecord(purpose,id),s=db.accounts.find(a=>a.role==='Student'&&a.studentNumber===r.studentNumber);
    const tx=db.transactions.filter(t=>purpose==='Tuition'?t.assessmentId===id:t.orderId===id);
    const due=purpose==='Tuition'?balance(r):(r.paymentStatus==='Paid'?0:cents(r.total));
    const history=db.notices.filter(n=>n.ticketId===id||n.text.includes(id)||tx.some(t=>n.text.includes(t.id)));
    $('payContent').innerHTML=`<section class="pw-card"><h2>${esc(purpose)} checkout ticket</h2><p>${esc(id)} · ${r.cashierTicket?.acknowledgedAt?'Acknowledged by '+esc(r.cashierTicket.acknowledgedBy):'Awaiting acknowledgment'}</p>${table(['Student number','Name','Program','Year level','Contact'],[[esc(r.studentNumber),esc(s?.name||r.recipient||''),esc(s?.course||r.course||''),esc(s?.year||r.yearLevel||''),esc(s?.email||r.customer||'')+'<small>'+esc(r.phone||s?.phone||'No phone recorded')+'</small>']])}${purpose==='Uniform'?table(['Uniform / type','Size','Quantity','Unit price','Line total'],r.items.map(i=>[esc(i.name)+'<small>'+esc(Proware.backupSnapshot().uniforms.find(u=>u.id===i.id)?.type||'Uniform')+'</small>',esc(i.size),i.qty,money(i.price),money(i.price*i.qty)])):table(['Total due','Previous payments','Remaining balance'],[[pesos(assessedTotal(r)),pesos(assessmentPaid(r)),pesos(balance(r))]])}<div class="pay-actions"><button class="pw-btn" id="ticketAck">Acknowledge ticket</button>${due>0&&!(purpose==='Uniform'&&orderStatus(r)==='Cancelled')?'<button class="pw-btn pw-primary" id="ticketPayment">Record payment</button>':''}${purpose==='Uniform'&&orderStatus(r)==='Ready for Pickup'?'<button class="pw-btn" id="ticketCollect">Record collection</button>':''}</div><h3>Transaction notes</h3><form id="ticketNoteForm" class="pw-form">${input('ticketNote','Note','','text','maxlength="1000"')}<button class="pw-btn">Save note</button></form>${(r.cashierTicket?.notes||[]).map(n=>`<p>${esc(n.text)}<small class="pw-muted"> · ${esc(n.by)} · ${esc(formatDate(n.at))}</small></p>`).join('')}<h3>Payments</h3>${transactionTable(tx)}<h3>Send notification</h3><form id="ticketNoticeForm" class="pw-form">${select('noticeTemplate','Message template',['Payment reminder','Payment confirmation','Payment verification request','Uniform pickup notice'])}${field('noticeText','Message','<textarea id="pay-noticeText" name="noticeText" required maxlength="1000"></textarea>')}<button class="pw-btn">Send in-app notification</button></form><h3>Notification history</h3>${history.map(n=>`<p><b>${esc(n.title)}</b> · ${esc(n.text)}<small> ${esc(formatDate(n.at))} · ${esc(n.sentBy||'System')} · ${esc(n.audience)}</small></p>`).join('')||'<p>No notifications for this ticket.</p>'}</section>`;
    $('ticketAck').disabled=!!r.cashierTicket?.acknowledgedAt;
    $('ticketAck').onclick=handle(()=>{atomic('Acknowledged checkout ticket '+id,()=>{r.cashierTicket||={submittedAt:stamp(),notes:[]};r.cashierTicket.acknowledgedAt=stamp();r.cashierTicket.acknowledgedBy=account().name;});render();});
    $('ticketNoteForm').onsubmit=handle(e=>{if(!e.target.reportValidity())return;const text=$('pay-ticketNote').value.trim();if(!text)throw Error('Enter a note.');atomic('Saved transaction note '+id,()=>{r.cashierTicket||={submittedAt:stamp(),notes:[]};r.cashierTicket.notes.push({at:stamp(),by:account().name,text});});render();});
    if($('ticketPayment'))$('ticketPayment').onclick=()=>open('cash',{purpose,id});
    if($('ticketCollect'))$('ticketCollect').onclick=handle(()=>{atomic('Recorded uniform collection '+id,()=>{if(!db.transactions.some(t=>t.orderId===id&&t.status==='Successful'))throw Error('A verified payment is required.');Proware.recordCashierCollection(id,account().name);notify(r.studentNumber,'Uniform collected',id+' · Collected from '+account().name);});render();msg('Collection recorded without another stock deduction.');});
    const template=()=>{const name=s?.name||r.recipient||r.studentNumber;const kind=$('pay-noticeTemplate').value;$('pay-noticeText').value=({ 'Payment reminder':`Hello ${name}, please settle the remaining ${pesos(due)} for ${id}.`,'Payment confirmation':`Hello ${name}, your verified payment for ${id} is confirmed. Remaining balance: ${pesos(due)}.`,'Payment verification request':`Hello ${name}, payment for ${id} is awaiting verification. Please check your payment reference.`,'Uniform pickup notice':`Hello ${name}, uniforms for ${id} are ready for pickup. Bring your student ID and receipt.`})[kind];};
    $('pay-noticeTemplate').onchange=template;template();
    $('ticketNoticeForm').onsubmit=handle(e=>{if(!e.target.reportValidity())return;const title=$('pay-noticeTemplate').value,text=$('pay-noticeText').value.trim();if(!text)throw Error('Enter a message.');atomic('Sent '+title+' '+id,()=>{if(title==='Payment confirmation'&&!tx.some(t=>t.status==='Successful'))throw Error('There is no verified payment to confirm.');if(title==='Uniform pickup notice'&&(purpose!=='Uniform'||orderStatus(r)!=='Ready for Pickup'))throw Error('Only orders ready for pickup can receive pickup notices.');notify(r.studentNumber,title,text);Object.assign(db.notices[0],{ticketId:id,sentBy:account().name});});render();msg('In-app notification sent.');});
    wireTransactionLinks();
  }
  function cashierInventoryView(){
    guard(['Cashier','Admin']);
    const inventory=Proware.backupSnapshot().uniforms;
    $('payContent').innerHTML=`<section class="pw-card"><h2>Uniform availability</h2><p class="pw-muted">Read-only inventory. Stock and price changes require authorized Proware staff or administrators. Reserved checkout quantities are already deducted.</p>${input('inventorySearch','Search uniform, type, program or size','','search')}<div id="inventoryCounts" class="pw-stats"></div><div id="inventoryTable"></div></section>`;
    $('pay-inventorySearch').required=false;
    const draw=()=>{const q=$('pay-inventorySearch').value.trim().toLowerCase();const rows=inventory.flatMap(u=>Object.entries(u.stock).filter(([size])=>size!=='Unassigned').map(([size,qty])=>({u,size,qty}))).filter(x=>[x.u.name,x.u.type,x.u.course,x.size].join(' ').toLowerCase().includes(q));const unassigned=inventory.reduce((n,u)=>n+(u.stock.Unassigned||0),0);$('inventoryCounts').innerHTML=[['Total units',rows.reduce((n,x)=>n+x.qty,0)+unassigned],['Low stock sizes',rows.filter(x=>x.qty>=1&&x.qty<=30).length],['Out of stock sizes',rows.filter(x=>x.qty===0).length],['Unallocated units (all)',unassigned]].map(([k,v])=>`<div class="pw-stat"><span>${k}</span><strong>${v}</strong></div>`).join('');$('inventoryTable').innerHTML=table(['Uniform','Type','Program','Size','Unit price','Available','Stock status'],rows.map(({u,size,qty})=>[esc(u.name),esc(u.type),esc(u.course),esc(size),u.price>0?money(u.price):'Price pending',qty,badge(qty===0?'Out of Stock':qty<=30?'Low Stock':'Available')]));};$('pay-inventorySearch').oninput=draw;draw();
  }
  function cashierAuditView(){guard(['Cashier','Admin']);$('payContent').innerHTML=`<section class="pw-card"><h2>Cashier activity log</h2>${table(['Date','Staff','Action','Details'],db.activities.map(x=>[esc(formatDate(x.at)),esc(x.staff),esc(x.action),esc(x.detail)]))}</section>`;}

  // Bind the existing store to the signed-in student's identity.
  const originalCheckout = renderCheckout,
    originalPlace = placeOrder;
  startCheckout = function () {
    if (!cartLines().length) {
      toast("Add an item to your cart before checking out.");
      return;
    }
    if (!account() || account().role !== "Student") {
      checkoutIntent = true;
      open();
      msg("Sign in with a Student account to place your uniform order.");
      return;
    }
    renderCheckout();
    closeModal("cartModal");
    openModal("checkoutModal");
  };
  renderCheckout = function () {
    originalCheckout();
    const a = account();
    if (a?.role === "Student") {
      for (const [id, value] of Object.entries({
        studentNumber: a.studentNumber,
        shipName: a.name,
        studentCourse: a.course,
        studentEmail: a.email,
      })) {
        if ($(id)) {
          $(id).value = value;
          $(id).readOnly = true;
        }
      }
      if ($("studentYear")) {
        $("studentYear").innerHTML = `<option>${esc(a.year)}</option>`;
      }
    }
  };
  placeOrder = function (e) {
    const a = account();
    if (!a || a.role !== "Student") {
      e.preventDefault();
      checkoutIntent = true;
      open();
      msg("Student sign-in is required to place an order.");
      return;
    }
    for (const [id, value] of Object.entries({
      studentNumber: a.studentNumber,
      shipName: a.name,
      studentCourse: a.course,
      studentEmail: a.email,
    })) {
      if ($(id)) $(id).value = value;
    }
    if ($("studentYear")) $("studentYear").value = a.year;
    const previous = new Set(orders.map((o) => o.id));
    originalPlace(e);
    const o = orders.find((o) => !previous.has(o.id));
    if (!o) return;
    o.status = "Awaiting Payment";
    o.paymentStatus = "Unpaid";
    o.studentAccountId = a.id;
    o.phone = a.phone || "";
    o.createdAt = stamp();
    o.cashierTicket = {submittedAt:stamp(),notes:[],acknowledgedAt:"",acknowledgedBy:""};
    notify(a.studentNumber, "New checkout ticket", o.id + " · Uniform · " + a.name + " · " + money(o.total), "Cashier");
    persist();
    notify(a.studentNumber, "Uniform order created", o.id + " · Awaiting Payment");
    write();
    const content = $("successContent");
    content.innerHTML = `<article class="ticket-slip"><h2>${esc(o.id)}</h2><p>Order created for ${esc(a.name)}. Stock is reserved while awaiting payment.</p><p>Total: <b>${money(o.total)}</b></p><button class="primary" id="payOrderNow">Pay online (demo)</button></article>`;
    $("payOrderNow").onclick = () => {
      closeModal("orderSuccessModal");
      open("pay", { purpose: "Uniform", id: o.id });
    };
  };
  openOrderManager = function () {
    open(account()?.role === "Student" ? "orders" : "dashboard");
  };
  manageButton.onclick = openOrderManager;
  openOrders = function () {
    open("orders");
  };
  openNotifications = function () {
    open("notices");
  };
  cashReceipt = function (orderId) {
    const o = orders.find((o) => o.id === orderId);
    if (!o || !account() || !owns(o.studentNumber)) {
      open();
      return;
    }
    const t = db.transactions.find((t) => t.orderId === orderId && t.receiptNumber);
    if (t) open("receipt", t.id);
    else {
      open("orders");
      msg("This legacy order has no electronic receipt in the new payment ledger.");
    }
  };
  orders.forEach((o) => {
    o.status = orderStatus(o);
  });
  persist();
  document.addEventListener("proware:issued", (e) => {
    const o = orders.find((o) => o.id === e.detail.orderId);
    if (!o) return;
    notify(o.studentNumber, "Uniform order claimed", `${o.id} · Issued by ${o.issuedBy}`);
    log("Uniform order claimed", o.id, o.issuedBy);
    write();
    if (!shell.hidden && account()) render();
  });
  shell.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
    if (e.key === "Tab") {
      const f = [...shell.querySelectorAll("button,input,select,textarea")].filter(
          (n) => !n.disabled && !n.closest("[hidden]"),
        ),
        first = f[0],
        last = f.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  document.addEventListener('student:data', () => {
    if (!shell.hidden && view === 'paymentStatus' && account()) paymentStatusView();
  });
  document.addEventListener("proware:updated", () => {
    if (!shell.hidden && account() && ["dashboard","orders","ticket"].includes(view)) render();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        db = JSON.parse(e.newValue);
        document.dispatchEvent(new CustomEvent('student:data'));
        if (!shell.hidden) render();
      } catch {}
    }
  });
  // Practice tuition is added only when the student has no assessment at all.
  function ensurePracticeTuition(a) {
    if (!a || a.role !== 'Student' || db.assessments.some(x=>x.studentNumber===a.studentNumber)) return false;
    const [year,month,day]=today().split('-').map(Number),academicStart=month>=6?year:year-1;
    const schedule=Array.from({length:4},(_,index)=>{
      const last=new Date(Date.UTC(year,month+index,0)).getUTCDate();
      return {date:new Date(Date.UTC(year,month-1+index,Math.min(day,last))).toISOString().slice(0,10),amount:500000};
    });
    db.assessments.unshift({id:uid('FEE-DEMO'),studentId:a.id,studentNumber:a.studentNumber,
      schoolYear:academicStart+'–'+(academicStart+1),semester:'1st Semester · Demo',plan:'Installment',
      fees:[{label:'Sample tuition for payment testing',amount:2000000}],schedule,createdAt:stamp(),demoAssessment:true});
    notify(a.studentNumber,'Sample tuition ready','₱20,000 sample tuition · Four ₱5,000 installments. You can test a full or installment payment.');
    return true;
  }
  // Student-facing profile API: return only this student's public profile and records.
  function publicStudent() {
    const a=account();
    if(a?.role!=='Student')return null;
    const {hash,salt,...profile}=a;
    return clone(profile);
  }
  function profileFields(data) {
    const fields={};
    for(const key of ['name','course','year','email','phone','gender','dateOfBirth'])fields[key]=String(data[key]||'').trim();
    if(!fields.name||!fields.course||!fields.year||!/^\S+@\S+\.\S+$/.test(fields.email)||!/^[0-9+() -]{7,20}$/.test(fields.phone))throw Error('Complete your name, program, year, email and phone number.');
    if(fields.dateOfBirth&&(!Number.isFinite(Date.parse(fields.dateOfBirth))||fields.dateOfBirth>today()))throw Error('Enter a valid date of birth.');
    if(fields.gender&&!['Male','Female','Other','Prefer not to say'].includes(fields.gender))throw Error('Choose a valid gender option.');
    if(data.avatar!==undefined){if(data.avatar&&!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(data.avatar))throw Error('Choose a JPEG or PNG profile image.');if(String(data.avatar||'').length>180000)throw Error('Profile image is too large.');fields.avatar=data.avatar||'';}
    return fields;
  }
  async function studentSignIn(username,password) {
    const a=db.accounts.find(a=>a.active&&a.role==='Student'&&a.username===String(username).trim().toLowerCase());
    if(!a||await hashPassword(password,a.salt)!==a.hash)throw Error('Student username or password is incorrect.');
    session=a.id;ensurePracticeTuition(a);log('Student signed in');write();close();
    document.dispatchEvent(new CustomEvent('student:session'));
    return publicStudent();
  }
  async function studentRegister(data,password) {
    const username=String(data.username||'').trim().toLowerCase(),number=String(data.studentNumber||'').trim();
    if(!/^[a-z0-9._-]{3,40}$/.test(username)||!number||number.length>30)throw Error('Enter a valid username and student number.');
    const details=profileFields(data),cred=await credential(password);
    const latest=JSON.parse(localStorage.getItem(KEY)||'null');
    if(latest&&latest.revision!==db.revision){db=latest;throw Error('Account records changed. Please try again.');}
    if(db.accounts.some(a=>a.username===username||a.studentNumber===number))throw Error('That username or student number already has an account.');
    const before=clone(db),priorSession=session;
    try{const a={id:uid('USER'),username,studentNumber:number,role:'Student',active:true,...details,...cred};db.accounts.push(a);session=a.id;ensurePracticeTuition(a);log('Student registered');write();close();}catch(e){db=before;session=priorSession;throw e;}
    document.dispatchEvent(new CustomEvent('student:session'));
    return publicStudent();
  }
  function saveStudentProfile(data) {
    guard(['Student']);const details=profileFields(data);
    atomic('Updated student profile',()=>Object.assign(account(),details),['Student']);
    document.dispatchEvent(new CustomEvent('student:session'));
    return publicStudent();
  }
  function studentSignOut(){guard(['Student']);log('Student signed out');write();session=null;currentUser=null;persist();close();document.dispatchEvent(new CustomEvent('student:session'));}
  function studentPurchases(){return publicStudent()?clone(ownOrders()):[];}
  function studentCancelOrder(id){
    atomic('Student cancelled uniform order '+id,()=>{
      const o=ticketRecord('Uniform',id);
      if(orderStatus(o)!=='Awaiting Payment'||o.paymentStatus==='Paid')throw Error('Only unpaid orders can be cancelled.');
      Proware.releaseReservation(o,account().name);o.status='Cancelled';if(o.cashierTicket)o.cashierTicket.closedAt=stamp();
      db.transactions.filter(t=>t.orderId===id&&t.status==='Pending').forEach(t=>{t.status='Failed';t.events.push({at:stamp(),status:'Failed',source:account().name,reason:'Order cancelled'});});
      notify(o.studentNumber,'Order cancelled',id);
    },['Student']);
  }
  function studentOrderReceipt(id){guard(['Student']);const o=ticketRecord('Uniform',id),t=db.transactions.find(t=>t.orderId===o.id&&t.receiptNumber&&['Successful','Refunded'].includes(t.status));if(!t)throw Error('A receipt is available after payment is verified.');open('receipt',t.id);}

  function studentFinancialData() {
    const a=guard(['Student']);
    const assessments=db.assessments.filter(x=>x.studentNumber===a.studentNumber).map(x=>{
      const paid=assessmentPaid(x);let cumulative=0,firstUnpaid=true;
      const schedule=x.schedule.map((i,index)=>{
        const applied=Math.min(i.amount,Math.max(0,paid-cumulative));cumulative+=i.amount;
        const outstanding=i.amount-applied;let status=outstanding===0?'Paid':applied>0?'Partially paid':firstUnpaid?'Pending':'Upcoming';
        if(outstanding>0)firstUnpaid=false;
        return {...i,index,paid:applied,outstanding,status};
      });
      return {...clone(x),total:assessedTotal(x),paid,balance:balance(x),schedule,nextDue:nextInstallment(x)};
    }).sort((x,y)=>String(y.createdAt||'').localeCompare(String(x.createdAt||'')));
    return {profile:publicStudent(),assessments,transactions:clone(ownTransactions()),orders:clone(ownOrders()),notices:clone(db.notices.filter(n=>n.audience==='Student'&&n.studentNumber===a.studentNumber))};
  }
  function studentReadNotifications(){guard(['Student']);atomic('Student viewed notifications',()=>{for(const n of db.notices.filter(n=>n.audience==='Student'&&n.studentNumber===account().studentNumber))if(!n.readBy.includes(account().id))n.readBy.push(account().id);},['Student']);}

  // Existing saved students also receive a sample assessment on this update,
  // without replacing real assessments or resetting prior practice payments.
  let practiceTuitionAdded=false;
  for (const a of db.accounts) if (ensurePracticeTuition(a)) practiceTuitionAdded=true;
  if (practiceTuitionAdded) {log('Added missing sample tuition','Only students without assessments','System');write();}
  return {open, studentSession:publicStudent, studentSignIn, studentRegister, saveStudentProfile, studentSignOut, studentPurchases, studentCancelOrder, studentOrderReceipt, studentFinancialData, studentReadNotifications};
})();
