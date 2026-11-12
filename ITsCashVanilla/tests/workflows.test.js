import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as s from "../shared/scripts/store.js";
class MemoryStorage {
  data = new Map();
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    this.data.set(k, String(v));
  }
  removeItem(k) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}
globalThis.localStorage = new MemoryStorage();
const student = {
  id: "student",
  role: "Student",
  name: "Student One",
  username: "one",
  studentNumber: "2026-1",
  course: "BSIT",
  year: "1",
  email: "one@example.com",
  phone: "09123456789",
  active: true,
};
const contact = {
  name: student.name,
  course: student.course,
  year: student.year,
  email: student.email,
  phone: student.phone,
};
function fixture() {
  s.commit((db) => {
    db.accounts = [
      student,
      { ...student, id: "other", username: "two", email: "two@example.com", studentNumber: "2026-2" },
      { id: "cashier", username: "cashier", role: "Cashier", name: "Cashier", active: true },
      { id: "proware", username: "proware", role: "Proware", name: "Proware", active: true },
      { id: "admin", username: "admin", role: "Admin", name: "Administrator", active: true },
    ];
    db.products[0].price = 72000;
    db.products[0].stock = { M: 10, Unassigned: 0 };
    db.products[0].sizes = ["M"];
    db.assessments = [
      {
        id: "term",
        studentId: "student",
        studentNumber: "2026-1",
        schoolYear: "2026–2027",
        semester: "1st",
        plan: "Installment",
        fees: [{ label: "Tuition", amount: 1000000 }],
        schedule: [
          { date: "2026-11-30", amount: 500000 },
          { date: "2026-12-30", amount: 500000 },
        ],
      },
    ];
  });
  return s.getState().products[0].id;
}
function order(productId, qty = 2) {
  s.putCart("student", productId, "M", qty);
  return s.placeOrder("student", contact, "Cash");
}
function cash(
  purpose,
  recordId,
  amount,
  reference = "cash-ref",
  received = amount,
) {
  return s.beginPayment("cashier", purpose, recordId, {
    amount,
    received,
    method: "Cash",
    reference,
    option: "Installment",
  });
}
beforeEach(() => {
  localStorage.clear();
  s.resetMemoryForTests();
});
test("uniform checkout reserves size stock once and creates a cashier ticket", () => {
  const p = fixture();
  const id = order(p);
  assert.equal(s.getState().products[0].stock.M, 8);
  assert.equal(s.getState().carts.student.length, 0);
  assert.equal(s.getState().tickets[0].recordId, id);
  assert.equal(s.getState().orders[0].total, 144000);
});
test("cancellation restores reserved stock and cannot be repeated", () => {
  const p = fixture();
  const id = order(p);
  s.cancelOrder("student", id);
  assert.equal(s.getState().products[0].stock.M, 10);
  assert.throws(() => s.cancelOrder("student", id), /Only unpaid/);
});
test("stock change between cart and checkout prevents overselling atomically", () => {
  const p = fixture();
  s.putCart("student", p, "M", 5);
  s.saveStock("proware", p, { M: 2, Unassigned: 0 }, 720);
  assert.throws(
    () => s.placeOrder("student", contact, "Cash"),
    /Stock changed/,
  );
  assert.equal(s.getState().orders.length, 0);
  assert.equal(s.getState().products[0].stock.M, 2);
  assert.equal(s.getState().carts.student[0].qty, 5);
});
test("cash payments calculate change, reduce tuition balance, and reject duplicate references", () => {
  fixture();
  const id = cash("Tuition", "term", 2500, "REF-1", 3000);
  const t = s.getState().transactions.find((t) => t.id === id);
  assert.equal(t.change, 50000);
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 750000);
  assert.ok(t.receiptNumber);
  assert.throws(
    () => cash("Tuition", "term", 2500, "ref-1"),
    /already been recorded/,
  );
  assert.equal(s.getState().transactions.length, 1);
});
test("insufficient cash and overpayments are rejected without ledger changes", () => {
  fixture();
  assert.throws(() => cash("Tuition", "term", 3000, "a", 2000), /insufficient/);
  assert.throws(() => cash("Tuition", "term", 11000, "b"), /remaining balance/);
  assert.equal(s.getState().transactions.length, 0);
});
test("digital payment remains pending until verified and blocks duplicate pending attempts", () => {
  fixture();
  const id = s.beginPayment("student", "Tuition", "term", {
    amount: 2000,
    method: "GCash",
    reference: "G-1",
  });
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 1000000);
  assert.throws(
    () =>
      s.beginPayment("student", "Tuition", "term", {
        amount: 2000,
        method: "Maya",
        reference: "G-2",
      }),
    /already pending/,
  );
  s.resolvePayment("student", id, "Successful");
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 800000);
  assert.throws(
    () => s.resolvePayment("student", id, "Successful"),
    /no longer pending/,
  );
});
test("failed payment keeps balance intact and allows a fresh reference", () => {
  fixture();
  const id = s.beginPayment("student", "Tuition", "term", {
    amount: 2000,
    method: "GCash",
    reference: "G-1",
  });
  s.resolvePayment("student", id, "Failed");
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 1000000);
  s.beginPayment("student", "Tuition", "term", {
    amount: 2000,
    method: "Maya",
    reference: "G-2",
  });
  assert.equal(s.getState().transactions.length, 2);
});
test("uniform orders require full payment before pickup and claiming", () => {
  const p = fixture();
  const id = order(p);
  assert.throws(
    () => s.setOrderStatus("cashier", id, "Ready for Pickup"),
    /Only paid/,
  );
  assert.throws(() => cash("Uniform", id, 100), /full payment/);
  cash("Uniform", id, 1440);
  s.setOrderStatus("cashier", id, "Ready for Pickup");
  s.setOrderStatus("proware", id, "Claimed");
  assert.equal(s.getState().orders[0].status, "Claimed");
  assert.equal(s.getState().products[0].stock.M, 8);
});
test("students cannot modify inventory, record cash, or access other student records", () => {
  const p = fixture();
  assert.throws(() => s.saveStock("student", p, { M: 30 }, 720), /authorized/);
  assert.throws(
    () =>
      s.beginPayment("other", "Tuition", "term", {
        amount: 10,
        method: "GCash",
        reference: "x",
      }),
    /another student/,
  );
  assert.throws(
    () =>
      s.beginPayment("student", "Tuition", "term", {
        amount: 10,
        method: "Cash",
        received: 10,
      }),
    /cashier ticket/,
  );
});
test("inventory rejects negative/fractional stock and updates price and quantities together", () => {
  const p = fixture();
  assert.throws(
    () => s.saveStock("proware", p, { M: -1 }, 700),
    /whole number/,
  );
  assert.throws(
    () => s.saveStock("proware", p, { M: 1.5 }, 700),
    /whole number/,
  );
  s.saveStock("proware", p, { M: 30, Unassigned: 0 }, 750.25);
  assert.equal(s.getState().products[0].price, 75025);
  assert.equal(s.totalStock(s.getState().products[0]), 30);
});
test("admin refund restores tuition balance; cashier cannot refund", () => {
  fixture();
  const id = cash("Tuition", "term", 2000);
  assert.throws(() => s.refundPayment("cashier", id), /authorized/);
  s.refundPayment("admin", id);
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 1000000);
  assert.equal(s.getState().transactions[0].status, "Refunded");
});
test("stale cross-tab changes are rejected and refresh the state", () => {
  const p = fixture();
  const newer = structuredClone(s.getState());
  newer.revision++;
  newer.products[0].stock.M = 2;
  localStorage.setItem(s.KEY, JSON.stringify(newer));
  assert.throws(() => s.putCart("student", p, "M", 3), /another tab/);
  assert.equal(s.getState().products[0].stock.M, 2);
});
test("ticket submissions cannot duplicate an open ticket; acknowledgment and notes persist", () => {
  fixture();
  const id = s.submitTicket("student", "Tuition", "term");
  assert.throws(
    () => s.submitTicket("student", "Tuition", "term"),
    /already in the cashier queue/,
  );
  s.ticketNote("cashier", id, "Student requested installment payment.", true);
  assert.ok(s.getState().tickets[0].acknowledgedAt);
  assert.equal(s.getState().tickets[0].notes.length, 1);
});
test("legacy migration preserves stock, cents ledger, reservation flag, and untouched original keys", () => {
  const old = {
    version: 1,
    revision: 2,
    accounts: [student],
    assessments: [
      {
        id: "oldterm",
        studentNumber: "2026-1",
        fees: [{ label: "Tuition", amount: 10000 }],
        schedule: [],
      },
    ],
    transactions: [],
    notices: [],
  };
  localStorage.setItem("sti_school_payments_v1", JSON.stringify(old));
  localStorage.setItem(
    "sti_proware_v1",
    JSON.stringify({
      uniforms: [
        {
          id: "uniform-gray-shirt",
          name: "Old Polo",
          code: "OLD",
          price: 123.45,
          stock: { M: 5, Unassigned: 2 },
        },
      ],
      accounts: [],
    }),
  );
  localStorage.setItem(
    "marketly_orders",
    JSON.stringify([
      {
        id: "OLD-ORDER",
        recipient: "Student One",
        studentNumber: "2026-1",
        total: 123.45,
        prowareReserved: true,
        status: "Awaiting Payment",
        items: [
          {
            id: "uniform-gray-shirt",
            name: "Old Polo",
            price: 123.45,
            qty: 1,
            size: "M",
          },
        ],
      },
    ]),
  );
  const db = s.getState();
  assert.equal(db.products[0].price, 12345);
  assert.equal(db.products[0].stock.M, 5);
  assert.equal(db.orders[0].reserved, true);
  assert.equal(db.orders[0].name, "Student One");
  assert.equal(db.assessments[0].fees[0].amount, 10000);
  assert.deepEqual(
    JSON.parse(localStorage.getItem("sti_school_payments_v1")),
    old,
  );
});
test("admin provisioning hashes passwords and students sign in by email", async () => {
  fixture();
  const fields = {
    ...contact,
    email: " Assigned@School.edu.ph ",
    username: "student.test",
    studentNumber: "123",
    role: "Student",
  };
  const id = await s.register(
    fields,
    "Password123!",
    "admin",
  );
  assert.equal(await s.signIn(" ASSIGNED@SCHOOL.EDU.PH ", "Password123!", "student"), id);
  const account = s.getState().accounts.find(a => a.id === id);
  assert.equal(account.email, "assigned@school.edu.ph");
  assert.equal(account.password, undefined);
  assert.ok(account.salt);
  await assert.rejects(s.signIn(account.email, "bad", "student"), /incorrect/);
  await assert.rejects(s.signIn("student.test", "Password123!", "student"), /incorrect/);
  await assert.rejects(s.signIn("unknown@school.edu.ph", "Password123!", "student"), /incorrect/);
  await assert.rejects(
    s.signIn(account.email, "Password123!", "cashier"),
    /cannot access/,
  );
  await assert.rejects(
    s.register(
      { ...fields, username: "different.student", studentNumber: "456" },
      "Password123!",
      "admin",
    ),
    /school email is already registered/,
  );
  s.commit(db => { db.accounts.find(a => a.id === id).active = false; });
  await assert.rejects(s.signIn(account.email, "Password123!", "student"), /incorrect/);
});
test("students cannot self-register, including when no accounts exist", async () => {
  const fields = { ...student, username: "new.student", email: "new@school.edu.ph" };
  await assert.rejects(s.register(fields, "Password123!"), /authorized/);
  assert.equal(s.getState().accounts.length, 0);
  fixture();
  const before = JSON.stringify(s.getState());
  for (const actor of [null, "student", "cashier", "proware", "missing"]) {
    await assert.rejects(s.register(fields, "Password123!", actor), /authorized/);
  }
  assert.equal(JSON.stringify(s.getState()), before);
});
test("student provisioning requires an email and prevents duplicate usernames", async () => {
  fixture();
  for (const email of ["", "invalid", "a@@school.edu.ph", "a b@school.edu.ph"]) {
    await assert.rejects(s.register({ ...student, username: "new.student", email }, "Password123!", "admin"), /school email/);
  }
  await assert.rejects(s.register({ ...student, email: "new@school.edu.ph" }, "Password123!", "admin"), /username is already registered/);
});
test("students edit only username, phone, gender and birthdate; school identity stays unchanged", () => {
  fixture();
  s.updateProfile("student", { username: "new.student", phone: "09998887777", gender: "Other", dateOfBirth: "2001-05-14",
    name: "Forged name", email: "other@school.edu.ph", studentNumber: "Forged number", course: "Forged course", year: "Forged year", role: "Admin", avatar: "Forged photo" });
  const updated = s.getState().accounts.find(a => a.id === "student");
  assert.equal(updated.username, "new.student");
  assert.equal(updated.phone, "09998887777");
  assert.equal(updated.gender, "Other");
  assert.equal(updated.dateOfBirth, "2001-05-14");
  for (const key of ["name", "email", "studentNumber", "course", "year", "role", "avatar"])
    assert.equal(updated[key], student[key]);
  assert.throws(() => s.updateProfile("student", { username: "two" }), /already registered/);
  assert.throws(() => s.updateProfile("student", { username: "bad username" }), /3–50/);
  assert.throws(() => s.updateProfile("student", { dateOfBirth: "2999-01-01" }), /valid date/);
  assert.throws(() => s.updateProfile("cashier", { username: "cashier.alias" }), /authorized/);
});
test("all roles can change only their own picture through the demo picture editor", () => {
  fixture();
  const avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  s.updateAvatar("proware", avatar);
  assert.equal(s.getState().accounts.find(a => a.id === "proware").avatar, avatar);
  assert.equal(s.getState().accounts.find(a => a.id === "student").avatar, undefined);
  for (const actor of ["student", "cashier", "admin"]) {
    s.updateAvatar(actor, avatar);
    assert.equal(s.getState().accounts.find(a => a.id === actor).avatar, avatar);
    s.updateAvatar(actor, "");
  }
  assert.throws(() => s.updateAvatar("missing", avatar), /authorized/);
  assert.throws(() => s.updateAvatar("proware", "data:image/svg+xml;base64,PHN2Zz4="), /JPEG or PNG/);
  s.updateAvatar("proware", "");
  assert.equal(s.getState().accounts.find(a => a.id === "proware").avatar, "");
});
test("corrupt saved records are not silently replaced", () => {
  localStorage.setItem(s.KEY, "{bad");
  assert.throws(s.getState, /left untouched/);
  assert.equal(localStorage.getItem(s.KEY), "{bad");
});


test("role accounts initialize once and enforce workspace access", async () => {
  await Promise.all([s.initializeAccounts(), s.initializeAccounts()]);
  for (const [username, password] of [
    ["student", "Student123!"],
    ["cashier", "Cashier123!"],
    ["proware", "Proware123!"],
  ]) {
    const identifier = `${username}@example.com`;
    const accountId = await s.signIn(identifier, password, username);
    assert.ok(accountId);
    assert.equal(await s.signIn(identifier, password), accountId);
    await assert.rejects(s.signIn(identifier, password, "unrecognized"), /cannot access/);
    assert.equal(await s.signIn(` ${identifier.toUpperCase()} `, password, username), accountId);
    await assert.rejects(s.signIn(username, password, username), /incorrect/);
    await assert.rejects(s.signIn(identifier, "wrong-password", username), /incorrect/);
    const other = username === "student" ? "cashier" : "student";
    await assert.rejects(s.signIn(identifier, password, other), /cannot access/);
  }
  const snapshot = JSON.stringify(s.getState());
  await s.initializeAccounts();
  assert.equal(JSON.stringify(s.getState()), snapshot);
  assert.equal(s.getState().accounts.filter((a) => ["student", "cashier", "proware"].includes(a.username)).length, 3);
});


test("requested staff accounts upgrade saved browsers and retain records", async () => {
  s.commit(db => { db.roleAccountsInitialized = true; db.notices.push({id: "preserved-notice"}); });
  await s.initializeAccounts();
  for (const [username, workspace] of [["Cashier2", "cashier"], ["Proware2", "proware"]]) {
    const email = `${username}@example.com`;
    const id = await s.signIn(email, "123456789", workspace);
    assert.ok(id);
    await assert.rejects(s.signIn(email, "123456789", workspace === "cashier" ? "proware" : "cashier"), /cannot access/);
    const account = s.getState().accounts.find(a => a.id === id);
    assert.equal(account.password, undefined);
    assert.ok(account.hash);
  }
  assert.ok(s.getState().notices.some(n => n.id === "preserved-notice"));
  const snapshot = JSON.stringify(s.getState());
  await s.initializeAccounts();
  assert.equal(JSON.stringify(s.getState()), snapshot);
});

test("email-only admin setup and staff provisioning enforce unique emails across roles", async () => {
  const admin = await s.register({ role: "Admin", name: "School Admin", email: " ADMIN@SCHOOL.EDU.PH " }, "Admin123!");
  for (const workspace of ["cashier", "proware"]) {
    assert.equal(await s.signIn("admin@school.edu.ph", "Admin123!", workspace), admin);
  }
  for (const role of ["Cashier", "Proware"]) {
    const fields = { role, name: `${role} Staff`, email: `${role}@school.edu.ph` };
    await assert.rejects(s.register(fields, "Password123!"), /authorized/);
    for (const email of ["", "invalid", "staff@@school.edu.ph"]) {
      await assert.rejects(s.register({ ...fields, email }, "Password123!", admin), /school email/);
    }
    const accountId = await s.register(fields, "Password123!", admin);
    assert.equal(await s.signIn(fields.email, "Password123!", role.toLowerCase()), accountId);
    await assert.rejects(s.register({ ...fields, email: " ADMIN@SCHOOL.EDU.PH " }, "Password123!", admin), /email is already registered/);
    s.commit(db => { db.accounts.find(a => a.id === accountId).active = false; });
    await assert.rejects(s.signIn(fields.email, "Password123!", role.toLowerCase()), /incorrect/);
  }
});

test("existing staff sign in by their saved email without resetting passwords or records", async () => {
  await s.initializeAccounts();
  s.commit(db => {
    db.accounts.find(a => a.username === "cashier2").email = "saved.cashier@school.edu.ph";
    db.accounts.find(a => a.username === "proware2").email = "saved.proware@school.edu.ph";
    db.notices.push({ id: "keep-this-notice" });
  });
  const before = JSON.stringify(s.getState());
  await s.initializeAccounts();
  assert.equal(JSON.stringify(s.getState()), before);
  for (const workspace of ["cashier", "proware"]) {
    assert.ok(await s.signIn(`saved.${workspace}@school.edu.ph`, "123456789", workspace));
    await assert.rejects(s.signIn(`${workspace}2@example.com`, "123456789", workspace), /incorrect/);
  }
});


test("student orders notify Cashier without marking student notices read", () => {
  const productId = fixture();
  const orderId = order(productId);
  const alert = s.getState().notices.find(notice => notice.audience === "Cashier" && notice.recordId === orderId);
  assert.ok(alert);
  assert.equal(alert.status, "Awaiting Payment");
  s.markRead("student");
  assert.deepEqual(s.getState().notices.find(notice => notice.id === alert.id).readBy, []);
  s.markRead("cashier");
  assert.deepEqual(s.getState().notices.find(notice => notice.id === alert.id).readBy, ["cashier"]);
  assert.ok(s.getState().notices.filter(notice => notice.audience === "Student").every(notice => !notice.readBy.includes("cashier")));
});

test("digital tuition payments reach Cashier queue and preserve pending balances", () => {
  fixture();
  const id = s.beginPayment("student", "Tuition", "term", {method: "GCash", amount: "100", reference: "student-digital", option: "Installment"});
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 1000000);
  assert.equal(s.getState().tickets.filter(ticket => ticket.recordId === "term").length, 1);
  assert.ok(s.getState().notices.some(notice => notice.audience === "Cashier" && notice.transactionId === id && notice.status === "Pending"));
  s.resolvePayment("student", id, "Successful");
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 990000);
  assert.ok(s.getState().notices.some(notice => notice.audience === "Cashier" && notice.transactionId === id && notice.status === "Successful"));
  assert.equal(s.getState().tickets.filter(ticket => ticket.recordId === "term").length, 1);
});

test("failed tuition payment alerts Cashier without reducing balance", () => {
  fixture();
  const id = s.beginPayment("student", "Tuition", "term", {method: "Maya", amount: "100", reference: "student-failed", option: "Installment"});
  s.resolvePayment("student", id, "Failed");
  assert.equal(s.dueFor(s.getState(), "Tuition", "term"), 1000000);
  assert.ok(s.getState().notices.some(notice => notice.audience === "Cashier" && notice.transactionId === id && notice.status === "Failed"));
});
