import { catalog } from "../data/catalog.js";
const KEY = "itscash_vanilla_v1";
const copy = (value) => structuredClone(value);
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const now = () => (/* @__PURE__ */ new Date()).toISOString();
const totalStock = (product) => Object.values(product.stock).reduce((sum, n) => sum + n, 0);
const money = (cents2) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
  (cents2 || 0) / 100
);
const dateText = (value) => value ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—";
function cents(value) {
  const n = Number(value);
  const result = Math.round(n * 100);
  if (!Number.isFinite(n) || n < 0 || result > 1e8 || !Number.isSafeInteger(result))
    throw Error("Enter an amount from ₱0 to ₱1,000,000.");
  return result;
}
function read(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return copy(fallback);
  try {
    return JSON.parse(raw);
  } catch {
    throw Error(
      `Saved records (${key}) could not be read. They have been left untouched.`
    );
  }
}
function fresh() {
  return {
    version: 2,
    revision: 0,
    products: copy(catalog),
    accounts: [],
    assessments: [],
    transactions: [],
    orders: [],
    notices: [],
    carts: {},
    saved: {},
    movements: [],
    tickets: [],
    migrated: false
  };
}
function legacyImage(value) {
  return value?.includes("/assets/images/") ? new URL("../../assets/images/" + value.split("/").at(-1), import.meta.url).href : value || "";
}
function migrateLegacy() {
  const db = fresh();
  const pay = read("sti_school_payments_v1", null);
  const inventory = read("sti_proware_v1", null);
  const oldProducts = read("marketly_products", []);
  const oldOrders = read("marketly_orders", []);
  if (!pay && !inventory && !oldProducts.length && !oldOrders.length) return db;
  db.migrated = true;
  db.legacySnapshot = {
    payments: pay,
    inventory,
    products: oldProducts,
    orders: oldOrders,
    cart: read("marketly_cart", []),
    saved: read("marketly_saved", []),
    notifications: read("marketly_notifications", [])
  };
  for (const product of db.products) {
    const old = oldProducts.find((p) => p.id === product.id);
    const uniform = inventory?.uniforms?.find((p) => p.id === product.id);
    if (old) {
      product.price = cents(old.price || 0);
      product.image = legacyImage(old.image || product.image);
    }
    if (uniform) {
      product.price = cents(uniform.price || 0);
      product.stock = copy(uniform.stock);
      product.code = uniform.code;
      product.name = uniform.name;
    } else if (old)
      product.stock.Unassigned = Math.max(0, Number(old.stock) || 0);
  }
  for (const uniform of inventory?.uniforms || []) {
    if (!db.products.some((p) => p.id === uniform.id))
      db.products.push({
        ...uniform,
        sizes: Object.keys(uniform.stock).filter((s) => s !== "Unassigned"),
        price: cents(uniform.price),
        image: "",
        program: uniform.course,
        programs: [uniform.course],
        category: uniform.type,
        description: uniform.course
      });
  }
  db.accounts = copy(pay?.accounts || []);
  for (const account of inventory?.accounts || []) {
    const duplicate = db.accounts.find((a) => a.username === account.username);
    db.accounts.push({
      ...account,
      id: `inventory:${account.id}`,
      username: duplicate ? `${account.username}.inventory` : account.username,
      role: account.role === "Admin" ? "Admin" : "Proware"
    });
  }
  db.assessments = copy(pay?.assessments || []).map((a) => ({
    ...a,
    fees: a.fees || [],
    schedule: a.schedule || [],
    adjustments: (pay?.adjustments || []).filter((x) => x.assessmentId === a.id).reduce((n, x) => n + x.amount, 0)
  }));
  db.transactions = copy(pay?.transactions || []);
  db.notices = copy(pay?.notices || []);
  db.movements = copy(inventory?.movements || []);
  db.orders = copy(oldOrders).map((o) => ({
    ...o,
    at: o.createdAt || o.at || now(),
    total: cents(o.total),
    name: o.name || o.recipient || o.studentName || "",
    email: o.email || o.studentEmail || "",
    course: o.course || o.studentCourse || "",
    year: o.year || o.studentYear || "",
    reserved: Boolean(o.prowareReserved),
    status: { Pending: "Awaiting Payment", Completed: "Claimed" }[o.status] || o.status,
    items: (o.items || []).map((i) => ({
      ...i,
      productId: i.productId || i.id,
      price: cents(i.price),
      image: legacyImage(i.image)
    })),
    paid: o.paymentStatus === "Paid"
  }));
  for (const [purpose, records] of [
    ["Tuition", db.assessments],
    ["Uniform", db.orders]
  ])
    for (const record of records)
      if (record.cashierTicket && !record.cashierTicket.closedAt)
        db.tickets.push({
          ...record.cashierTicket,
          id: `ticket:${record.id}`,
          purpose,
          recordId: record.id,
          studentNumber: record.studentNumber,
          at: record.cashierTicket.submittedAt,
          notes: record.cashierTicket.notes || []
        });
  return db;
}
let state;
const listeners = /* @__PURE__ */ new Set();
function getState() {
  if (!state) state = read(KEY, null) || migrateLegacy();
  return state;
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emit() {
  for (const listener of listeners) listener();
}
function refresh() {
  state = read(KEY, null) || migrateLegacy();
  emit();
}
function resetMemoryForTests() {
  state = void 0;
}
function commit(change) {
  const previous = getState();
  const latest = read(KEY, null);
  if (latest && latest.revision !== previous.revision) {
    state = latest;
    emit();
    throw Error(
      "Records changed in another tab. Review the refreshed screen and try again."
    );
  }
  const next = copy(previous);
  const result = change(next);
  next.revision++;
  localStorage.setItem(KEY, JSON.stringify(next));
  state = next;
  emit();
  return result;
}
function requireRole(db, actor, roles) {
  const account = db.accounts.find((a) => a.id === actor && a.active !== false);
  if (!account || !roles.includes(account.role))
    throw Error("Sign in with an authorized account.");
  return account;
}
const staffRoles = ["Cashier", "Admin"];
function owner(db, actor, number) {
  const a = requireRole(db, actor, ["Student", ...staffRoles]);
  if (a.role === "Student" && a.studentNumber !== number)
    throw Error("This record belongs to another student.");
  return a;
}
function notice(db, number, title, text) {
  db.notices.unshift({
    id: id("NOTICE"),
    at: now(),
    studentNumber: number,
    title,
    text,
    audience: "Student",
    readBy: []
  });
}
function cashierNotice(db, number, title, text, details = {}) {
  db.notices.unshift({
    id: id("NOTICE"), at: now(), studentNumber: number, title, text,
    audience: "Cashier", readBy: [], ...details
  });
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 15e4,
      hash: "SHA-256"
    },
    key,
    256
  );
  return Array.from(
    new Uint8Array(bits),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");
}
async function credentials(password) {
  if (password.length < 8)
    throw Error("Use a password with at least 8 characters.");
  const salt = id("SALT");
  return { salt, hash: await passwordHash(password, salt) };
}
function addAccount(db, fields, credential) {
  const username = fields.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username))
    throw Error(
      "Username must contain 3–50 letters, numbers, dots, underscores, or hyphens."
    );
  if (db.accounts.some((a2) => a2.username.toLowerCase() === username))
    throw Error("That username is already registered.");
  if (!fields.name?.trim())
    throw Error("Enter the account holder’s full name.");
  if (fields.role === "Student" && (!fields.studentNumber?.trim() || db.accounts.some(
    (a2) => a2.role === "Student" && a2.studentNumber === fields.studentNumber.trim()
  )))
    throw Error("Enter a unique student number.");
  const a = {
    ...fields,
    username,
    name: fields.name.trim(),
    studentNumber: fields.studentNumber?.trim() || "",
    ...credential,
    id: id("ACCOUNT"),
    active: true,
    createdAt: now()
  };
  db.accounts.push(a);
  return a.id;
}
async function register(fields, password, actor = null) {
  const credential = await credentials(password);
  return commit((db) => {
    if (fields.role !== "Student") {
      if (db.accounts.some((a) => a.role === "Admin" && a.active !== false))
        requireRole(db, actor, ["Admin"]);
      else if (fields.role !== "Admin")
        throw Error("Create the first administrator first.");
    }
    return addAccount(db, fields, credential);
  });
}
async function signIn(username, password, workspace) {
  const account = getState().accounts.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase() && a.active !== false
  );
  if (!account || await passwordHash(password, account.salt) !== account.hash)
    throw Error("Username or password is incorrect.");
  const roles = workspace === "student" ? ["Student"] : workspace === "cashier" ? ["Cashier", "Admin"] : ["Proware", "Inventory Staff", "Admin"];
  if (!roles.includes(account.role))
    throw Error(`This account cannot access the ${workspace} workspace.`);
  return account.id;
}
function updateProfile(actor, fields) {
  return commit((db) => {
    const a = requireRole(db, actor, ["Student"]);
    for (const key of ["name", "email", "phone", "course", "year"])
      if (!fields[key]?.trim())
        throw Error("Complete your name, email, phone, course, and year.");
    for (const key of [
      "name",
      "email",
      "phone",
      "course",
      "year",
      "gender",
      "dateOfBirth",
      "avatar"
    ])
      if (key in fields) a[key] = fields[key];
  });
}
function toggleSaved(actor, productId) {
  commit((db) => {
    requireRole(db, actor, ["Student"]);
    const saved = db.saved[actor] ||= [];
    const i = saved.indexOf(productId);
    i < 0 ? saved.push(productId) : saved.splice(i, 1);
  });
}
function putCart(actor, productId, size, qty) {
  commit((db) => {
    requireRole(db, actor, ["Student"]);
    const p = db.products.find((p2) => p2.id === productId);
    if (!p || !Number.isSafeInteger(qty) || qty < 0 || qty > 999)
      throw Error("Enter a valid quantity.");
    const cart = db.carts[actor] ||= [];
    const i = cart.findIndex(
      (x) => x.productId === productId && x.size === size
    );
    if (!qty) {
      if (i >= 0) cart.splice(i, 1);
      return;
    }
    if (p.price <= 0 || !p.sizes.includes(size) || qty > (p.stock[size] || 0))
      throw Error("This quantity or size is not available.");
    const line = { productId, size, qty };
    i < 0 ? cart.push(line) : cart.splice(i, 1, line);
  });
}
function placeOrder(actor, contact, method) {
  return commit((db) => {
    const a = requireRole(db, actor, ["Student"]);
    const cart = db.carts[actor] || [];
    if (!cart.length) throw Error("Your cart is empty.");
    for (const key of ["name", "email", "phone", "course", "year"])
      if (!contact[key]?.trim())
        throw Error("Complete the checkout contact details.");
    if (!["Cash", "GCash", "Maya", "Online bank"].includes(method))
      throw Error("Choose a payment method.");
    const items = cart.map((line) => {
      const p = db.products.find((p2) => p2.id === line.productId);
      if (!p || !Number.isSafeInteger(line.qty) || line.qty <= 0 || p.price <= 0 || (p.stock[line.size] || 0) < line.qty)
        throw Error("Stock changed. Please review your cart.");
      return { ...line, name: p.name, image: p.image, price: p.price };
    });
    const order = {
      ...contact,
      id: id("ORDER"),
      at: now(),
      studentNumber: a.studentNumber,
      studentId: a.id,
      items,
      total: items.reduce((s, i) => s + i.price * i.qty, 0),
      method,
      status: "Awaiting Payment",
      paid: false,
      reserved: true
    };
    for (const line of items) {
      const p = db.products.find((p2) => p2.id === line.productId);
      p.stock[line.size] -= line.qty;
      db.movements.unshift({
        id: id("MOV"),
        at: now(),
        name: p.name,
        size: line.size,
        delta: -line.qty,
        kind: "Order reservation",
        reference: order.id,
        staff: a.name
      });
    }
    db.orders.unshift(order);
    db.carts[actor] = [];
    db.tickets.unshift({
      id: id("TICKET"),
      purpose: "Uniform",
      recordId: order.id,
      studentNumber: a.studentNumber,
      at: now(),
      notes: []
    });
    notice(
      db,
      a.studentNumber,
      "Uniform order placed",
      `${order.id} · ${money(order.total)} · Awaiting payment.`
    );
    cashierNotice(db, a.studentNumber, "New uniform order",
      `${a.name} placed ${order.id} for ${money(order.total)}. Awaiting payment.`,
      { recordId: order.id, purpose: "Uniform", status: "Awaiting Payment" });
    return order.id;
  });
}
function restoreOrderStock(db, order, actor) {
  if (!order.reserved) return;
  for (const line of order.items) {
    const p = db.products.find((p2) => p2.id === line.productId);
    if (p) {
      p.stock[line.size] = (p.stock[line.size] || 0) + line.qty;
      db.movements.unshift({
        id: id("MOV"),
        at: now(),
        name: p.name,
        size: line.size,
        delta: line.qty,
        kind: "Order cancelled",
        reference: order.id,
        staff: actor.name
      });
    }
  }
  order.reserved = false;
}
function cancelOrder(actor, orderId) {
  commit((db) => {
    const o = db.orders.find((o2) => o2.id === orderId);
    if (!o) throw Error("Order not found.");
    const a = owner(db, actor, o.studentNumber);
    if (o.status !== "Awaiting Payment" || paidFor(db, "Uniform", o.id) || db.transactions.some((t) => t.orderId === o.id && t.status === "Pending"))
      throw Error(
        "Only unpaid orders without pending payments can be cancelled."
      );
    restoreOrderStock(db, o, a);
    o.status = "Cancelled";
    notice(db, o.studentNumber, "Order cancelled", o.id);
  });
}
function paidFor(db, purpose, recordId) {
  return db.transactions.filter(
    (t) => t.purpose === purpose && (purpose === "Tuition" ? t.assessmentId : t.orderId) === recordId && t.status === "Successful"
  ).reduce((s, t) => s + t.amount, 0);
}
function assessedTotal(a) {
  return a.fees.reduce((s, f) => s + f.amount, 0) + (a.adjustments || 0);
}
function dueFor(db, purpose, recordId) {
  const r = (purpose === "Tuition" ? db.assessments : db.orders).find(
    (x) => x.id === recordId
  );
  if (!r) throw Error("Record not found.");
  if (r.status === "Cancelled") return 0;
  const total = purpose === "Tuition" ? assessedTotal(r) : r.total;
  return Math.max(0, total - paidFor(db, purpose, recordId));
}
function createAssessment(actor, fields) {
  return commit((db) => {
    requireRole(db, actor, staffRoles);
    const a = db.accounts.find(
      (a2) => a2.id === fields.studentId && a2.role === "Student"
    );
    if (!a) throw Error("Choose a student.");
    const fees = fields.fees.map((f) => ({
      label: f.label.trim(),
      amount: cents(f.amount)
    }));
    const total = fees.reduce((s, f) => s + f.amount, 0);
    if (!total || fees.some((f) => !f.label))
      throw Error("Add a fee name and a positive total.");
    if (db.assessments.some(
      (x) => x.studentNumber === a.studentNumber && x.schoolYear === fields.schoolYear && x.semester === fields.semester
    ))
      throw Error("An assessment already exists for this student and term.");
    const count = fields.plan === "Full" ? 1 : 3;
    const schedule = Array.from({ length: count }, (_, i) => {
      const d = /* @__PURE__ */ new Date(fields.dueDate + "T00:00:00+08:00");
      d.setUTCMonth(d.getUTCMonth() + i);
      return {
        date: d.toISOString(),
        amount: Math.floor(total / count) + (i < total % count ? 1 : 0)
      };
    });
    const assessment = {
      id: id("TERM"),
      studentId: a.id,
      studentNumber: a.studentNumber,
      schoolYear: fields.schoolYear,
      semester: fields.semester,
      plan: fields.plan,
      fees,
      schedule,
      at: now()
    };
    db.assessments.unshift(assessment);
    notice(
      db,
      a.studentNumber,
      "Tuition assessment added",
      `${assessment.schoolYear} · ${assessment.semester} · ${money(total)}`
    );
    return assessment.id;
  });
}
function submitTicket(actor, purpose, recordId) {
  return commit((db) => {
    const r = (purpose === "Tuition" ? db.assessments : db.orders).find(
      (r2) => r2.id === recordId
    );
    if (!r) throw Error("Record not found.");
    owner(db, actor, r.studentNumber);
    if (dueFor(db, purpose, recordId) <= 0)
      throw Error("This record has no unpaid balance.");
    if (db.tickets.some((t) => t.recordId === recordId && !t.closedAt))
      throw Error("This record is already in the cashier queue.");
    const ticket = {
      id: id("TICKET"),
      purpose,
      recordId,
      studentNumber: r.studentNumber,
      at: now(),
      notes: []
    };
    db.tickets.unshift(ticket);
    return ticket.id;
  });
}
function ticketNote(actor, ticketId, text, acknowledge = false) {
  commit((db) => {
    const a = requireRole(db, actor, staffRoles);
    const t = db.tickets.find((t2) => t2.id === ticketId);
    if (!t) throw Error("Ticket not found.");
    if (acknowledge && !t.acknowledgedAt) {
      t.acknowledgedAt = now();
      t.acknowledgedBy = a.name;
    }
    if (text.trim())
      t.notes.push({ text: text.trim(), at: now(), staff: a.name });
  });
}
function beginPayment(actor, purpose, recordId, values) {
  return commit((db) => {
    const r = (purpose === "Tuition" ? db.assessments : db.orders).find(
      (r2) => r2.id === recordId
    );
    if (!r) throw Error("Record not found.");
    const a = owner(db, actor, r.studentNumber);
    const due = dueFor(db, purpose, recordId);
    const amount = cents(values.amount);
    if (!due || !amount || amount > due)
      throw Error(
        "Enter a positive payment no greater than the remaining balance."
      );
    if (purpose === "Tuition" && values.option === "Full" && amount !== due)
      throw Error("Full payment must match the remaining balance.");
    if (purpose === "Uniform" && amount !== due)
      throw Error("Uniform orders require full payment.");
    if (!["Cash", "GCash", "Maya", "Online bank"].includes(values.method))
      throw Error("Choose a payment method.");
    if (values.method === "Cash" && a.role === "Student")
      throw Error("Submit a cashier ticket for cash payments.");
    if (db.transactions.some(
      (t2) => (purpose === "Tuition" ? t2.assessmentId : t2.orderId) === recordId && t2.status === "Pending"
    ))
      throw Error("A payment for this record is already pending.");
    const reference = values.reference?.trim() || (values.method === "Cash" ? id("CASH") : "");
    if (!reference) throw Error("Enter the digital payment reference.");
    if (db.transactions.some(
      (t2) => t2.reference?.toLowerCase() === reference.toLowerCase()
    ))
      throw Error("This payment reference has already been recorded.");
    const received = values.method === "Cash" ? cents(values.received) : amount;
    if (received < amount) throw Error("Amount received is insufficient.");
    const t = {
      id: id("TXN"),
      at: now(),
      purpose,
      assessmentId: purpose === "Tuition" ? recordId : "",
      orderId: purpose === "Uniform" ? recordId : "",
      studentNumber: r.studentNumber,
      studentName: db.accounts.find((a2) => a2.studentNumber === r.studentNumber)?.name || r.name,
      amount,
      method: values.method,
      reference,
      amountReceived: received,
      change: received - amount,
      status: values.method === "Cash" ? "Successful" : "Pending",
      staff: a.name,
      paymentOption: values.option || "Installment"
    };
    if (t.status === "Successful") {
      t.receiptNumber = id("RECEIPT");
      t.verifiedAt = now();
    }
    db.transactions.unshift(t);
    // Digital student payments also belong in the cashier queue.
    if (a.role === "Student" && !db.tickets.some(ticket => ticket.recordId === recordId && !ticket.closedAt)) {
      db.tickets.unshift({ id: id("TICKET"), purpose, recordId,
        studentNumber: r.studentNumber, at: now(), notes: [] });
    }
    finishPayment(db, t);
    return t.id;
  });
}
function finishPayment(db, t) {
  const recordId = t.purpose === "Tuition" ? t.assessmentId : t.orderId;
  if (t.status === "Successful") {
    if (t.purpose === "Uniform") {
      const order = db.orders.find((o) => o.id === recordId);
      if (dueFor(db, "Uniform", recordId) === 0) {
        order.status = "Paid";
        order.paid = true;
      }
    }
    if (dueFor(db, t.purpose, recordId) === 0)
      for (const ticket of db.tickets.filter(
        (x) => x.recordId === recordId && !x.closedAt
      ))
        ticket.closedAt = now();
  }
  notice(
    db,
    t.studentNumber,
    `Payment ${t.status.toLowerCase()}`,
    `${t.purpose} · ${money(t.amount)} · ${t.id}`
  );
  cashierNotice(db, t.studentNumber, `${t.purpose} payment ${t.status.toLowerCase()}`,
    `${t.studentName} - ${money(t.amount)} via ${t.method}. Reference: ${t.reference}. ${t.status === "Pending" ? "Awaiting verification; balance is unchanged." : `Status: ${t.status}. Remaining balance: ${money(dueFor(db, t.purpose, recordId))}.`}`,
    { recordId, transactionId: t.id, purpose: t.purpose, status: t.status });
}
function resolvePayment(actor, transactionId, result) {
  commit((db) => {
    const t = db.transactions.find((t2) => t2.id === transactionId);
    if (!t) throw Error("Transaction not found.");
    owner(db, actor, t.studentNumber);
    if (t.status !== "Pending" || !["Successful", "Failed"].includes(result))
      throw Error("This payment is no longer pending.");
    if (result === "Successful" && t.amount > dueFor(
      db,
      t.purpose,
      t.purpose === "Tuition" ? t.assessmentId : t.orderId
    ))
      throw Error("The remaining balance has changed.");
    t.status = result;
    if (result === "Successful") {
      t.receiptNumber = id("RECEIPT");
      t.verifiedAt = now();
    }
    finishPayment(db, t);
  });
}
function refundPayment(actor, transactionId) {
  commit((db) => {
    requireRole(db, actor, ["Admin"]);
    const t = db.transactions.find((t2) => t2.id === transactionId);
    if (!t || t.status !== "Successful")
      throw Error("Choose a successful payment.");
    if (t.purpose === "Uniform") {
      const o = db.orders.find((o2) => o2.id === t.orderId);
      if (["Claimed", "Ready for Pickup"].includes(o.status))
        throw Error("This order is already ready or claimed.");
      o.status = "Awaiting Payment";
      o.paid = false;
    }
    t.status = "Refunded";
    t.refundedAt = now();
    notice(
      db,
      t.studentNumber,
      "Payment refunded",
      `${t.id} · ${money(t.amount)}`
    );
  });
}
function setOrderStatus(actor, orderId, status) {
  commit((db) => {
    requireRole(db, actor, ["Cashier", "Admin", "Proware"]);
    const o = db.orders.find((o2) => o2.id === orderId);
    const transitions = {
      Paid: "Ready for Pickup",
      "Ready for Pickup": "Claimed"
    };
    if (!o || transitions[o.status] !== status || dueFor(db, "Uniform", orderId) > 0)
      throw Error("Only paid orders can move to the next pickup status.");
    o.status = status;
    notice(
      db,
      o.studentNumber,
      status === "Ready for Pickup" ? "Uniform ready for pickup" : "Uniform claimed",
      o.id
    );
  });
}
function saveStock(actor, productId, stock, price) {
  commit((db) => {
    const a = requireRole(db, actor, ["Proware", "Admin", "Inventory Staff"]);
    const p = db.products.find((p2) => p2.id === productId);
    if (!p) throw Error("Uniform not found.");
    for (const size of [...p.sizes, "Unassigned"]) {
      const qty = Number(stock[size] || 0);
      if (!Number.isSafeInteger(qty) || qty < 0 || qty > 1e6)
        throw Error("Stock must be a whole number from 0 to 1,000,000.");
      const delta = qty - (p.stock[size] || 0);
      if (delta)
        db.movements.unshift({
          id: id("MOV"),
          at: now(),
          name: p.name,
          size,
          delta,
          kind: "Stock update",
          staff: a.name
        });
      p.stock[size] = qty;
    }
    p.price = cents(price);
  });
}
function markRead(actor) {
  commit((db) => {
    const a = requireRole(db, actor, ["Student", ...staffRoles, "Proware"]);
    for (const n of db.notices) {
      const visible = a.role === "Student"
        ? n.audience !== "Cashier" && n.studentNumber === a.studentNumber
        : staffRoles.includes(a.role) && n.audience === "Cashier";
      if (visible) {
        n.readBy ||= [];
        if (!n.readBy.includes(a.id)) n.readBy.push(a.id);
      }
    }
  });
}
function sendNotice(actor, number, title, text) {
  commit((db) => {
    requireRole(db, actor, staffRoles);
    if (!number || !title.trim() || !text.trim())
      throw Error("Complete the student, title, and message.");
    notice(db, number, title.trim(), text.trim());
  });
}
let accountSetup;
function initializeAccounts() {
  if (getState().roleAccountsVersion >= 2) return Promise.resolve();
  if (accountSetup) return accountSetup;
  accountSetup = (async () => {
    const definitions = [
      ["student", "Student123!", "Student"],
      ["cashier", "Cashier123!", "Cashier"],
      ["proware", "Proware123!", "Proware"],
      ["cashier2", "123456789", "Cashier", true],
      ["proware2", "123456789", "Proware", true]
    ];
    const prepared = await Promise.all(definitions.map(async ([username, password, role, requested = false]) => ({
      username,
      role,
      requested,
      credential: await credentials(password)
    })));
    commit((db) => {
      if (db.roleAccountsVersion >= 2) return;
      for (const entry of prepared) {
        const existing = db.accounts.find((a) => a.username.toLowerCase() === entry.username);
        const previous = db.accounts.find((a) => a.demo && a.username === `demo.${entry.username}`);
        if (existing && entry.requested) {
          Object.assign(existing, { role: entry.role, active: true, ...entry.credential });
          delete existing.demo;
        } else if (previous && !existing) {
          Object.assign(previous, { username: entry.username, name: `${entry.role} User`, ...entry.credential });
          delete previous.demo;
        } else if (!existing) {
          addAccount(db, {
            username: entry.username,
            role: entry.role,
            name: `${entry.role} User`,
            studentNumber: entry.role === "Student" ? `LOCAL-${id("STUDENT")}` : "",
            course: "BS Information Technology",
            year: "1st year",
            email: `${entry.username}@example.com`,
            phone: "09123456789"
          }, entry.credential);
        }
      }
      for (const account of db.accounts) {
        if (account.demo) account.active = false;
      }
      db.roleAccountsInitialized = true;
      db.roleAccountsVersion = 2;
    });
  })().finally(() => {
    accountSetup = void 0;
  });
  return accountSetup;
}
export {
  KEY,
  assessedTotal,
  beginPayment,
  cancelOrder,
  cents,
  commit,
  createAssessment,
  dateText,
  dueFor,
  fresh,
  getState,
  id,
  initializeAccounts,
  markRead,
  migrateLegacy,
  money,
  now,
  paidFor,
  passwordHash,
  placeOrder,
  putCart,
  refresh,
  refundPayment,
  register,
  resetMemoryForTests,
  resolvePayment,
  saveStock,
  sendNotice,
  setOrderStatus,
  signIn,
  submitTicket,
  subscribe,
  ticketNote,
  toggleSaved,
  totalStock,
  updateProfile
};
