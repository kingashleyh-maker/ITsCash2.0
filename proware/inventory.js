/* Proware: size-level inventory, staff access, issuance, and recovery.
 * This single-file prototype stores data on this browser. Real access control,
 * shared transactions, and private student records require a trusted server.
 */
const Proware = (() => {
  "use strict";
  const KEY = "sti_proware_v1";
  const SCHEMA = 1;
  const LOW_STOCK_LIMIT = 30;
  const types = ["Polo", "Blouse", "Pants", "Skirt", "Physical education uniform", "Blazer", "Accessory", "Chef jacket", "NSTP uniform"];
  const $ = (id) => document.getElementById(id);
  const now = () => new Date().toISOString();
  const uid = (prefix) => prefix + "-" + crypto.randomUUID();
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const integer = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
  const dateText = (value) =>
    value ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—";
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  let state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    state = null;
  }
  if (!state) {
    state = {
      schema: SCHEMA,
      revision: 0,
      uniforms: [],
      movements: [],
      issues: [],
      exchanges: [],
      accounts: [],
      activities: [],
    };
    products
      .filter(
        (p) =>
          p.id.startsWith("uniform-") || ["Uniforms", "Shirts", "Pants"].includes(p.category),
      )
      .forEach((p, i) => {
        const sizes = [...new Set(["XS", ...(p.sizes || ["S", "M", "L", "XL"])])];
        const stock = Object.fromEntries(sizes.map((s) => [s, 0]));
        stock.Unassigned = Math.max(0, Math.floor(Number(p.stock) || 0));
        const u = {
          id: p.id,
          code: "STI-" + String(i + 1).padStart(3, "0"),
          name: p.name,
          type: /pants/i.test(p.name)
            ? "Pants"
            : /NSTP|PE\b/i.test(p.name)
              ? "Physical education uniform"
              : "Polo",
          course: "All courses / grade levels",
          price: p.price,
          threshold: LOW_STOCK_LIMIT,
          stock,
        };
        state.uniforms.push(u);
        state.movements.push({
          id: uid("MOV"),
          at: now(),
          date: today(),
          uniformId: u.id,
          code: u.code,
          name: u.name,
          size: "Unassigned",
          kind: "Opening balance",
          qty: stock.Unassigned,
          delta: stock.Unassigned,
          balance: stock.Unassigned,
          reason: "Existing stock; allocate to confirmed sizes",
          staff: "System migration",
          reference: "",
        });
      });
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  // Add only missing catalog records, preserving staff prices and size counts.
  let catalogAdded = false;
  for (const item of campusUniformCatalog) {
    let u = state.uniforms.find(u => u.id === item.id);
    if (!u) {
      u = {id:item.id, code:"STI-" + item.id.slice(8).toUpperCase(),
        name:item.name, type:item.type, course:item.program, price:0,
        threshold:LOW_STOCK_LIMIT,
        stock:Object.fromEntries(item.sizes.map(size => [size, 0]))};
      state.uniforms.push(u);
      catalogAdded = true;
    }
    // Correct initial generic migration metadata for these new photo listings.
    if (u.course === "All courses / grade levels") {
      u.type = item.type;
      u.course = item.program;
      catalogAdded = true;
    }
  }
  if (catalogAdded) {
    state.revision++;
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  let session = null,
    view = "overview",
    editId = null,
    returnToOrder = null;
  let reportRows = [],
    reportColumns = [],
    reportName = "";
  let busy = false;
  const app = document.createElement("section");
  app.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
    if (e.key === "Tab") {
      const nodes = [...app.querySelectorAll("button,input,select,textarea,a[href]")].filter(
        (n) => !n.disabled && !n.closest("[hidden]"),
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  app.id = "pwApp";
  app.hidden = true;
  app.setAttribute("role", "dialog");
  app.setAttribute("aria-modal", "true");
  app.setAttribute("aria-label", "Proware inventory");
  document.body.append(app);
  const entry = document.createElement("button");
  entry.type = "button";
  entry.className = "pw-entry";
  entry.textContent = "Proware · Inventory";
  entry.onclick = () => open();
  // Removed duplicate Proware shortcut; use the workspace navigation.
  // Proware is a separate authenticated workspace, not a cashier role switch.
  const oldRole = $("omRole");
  [...oldRole.options].filter((o) => o.value === "Proware").forEach((o) => o.remove());
  const roleEntry = document.createElement("button");
  roleEntry.type = "button";
  roleEntry.textContent = "Open Proware";
  roleEntry.onclick = () => open();
  document.querySelector(".om-top > div:last-child").append(roleEntry);

  function user() {
    return state.accounts.find((a) => a.id === session && a.active);
  }
  function requireStaff(admin = false) {
    const a = user();
    if (!a) throw Error("Sign in to Proware first.");
    if (admin && a.role !== "Admin") throw Error("Only an Admin can do this.");
    return a;
  }
  function activity(action, details = "", actor = user()?.name || "System") {
    state.activities.unshift({ id: uid("ACT"), at: now(), staff: actor, action, details });
  }
  function uniform(id) {
    const u = state.uniforms.find((u) => u.id === id);
    if (!u) throw Error("Uniform record not found.");
    return u;
  }
  function total(u) {
    return Object.values(u.stock).reduce((s, n) => s + n, 0);
  }
  function syncProducts() {
    state.uniforms.forEach((u) => {
      u.threshold = LOW_STOCK_LIMIT;
      let p = products.find((p) => p.id === u.id);
      if (!p) {
        p = {
          id: u.id,
          category: u.type === "Pants" ? "Pants" : u.type === "Skirt" ? "Uniforms" : "Shirts",
          rating: 0,
          reviews: 0,
          seller: "STI Campus Store",
          location: "Campus",
          description: u.course,
          emoji: "👕",
          tag: "Campus uniform",
        };
        products.push(p);
      }
      if (!p.image) p.image = (window.campusPhotoCatalog || []).find(x=>x.id===p.id)?.image || seedProducts.find(x=>x.id===p.id)?.image;
      Object.assign(p, {
        category: u.type === "Pants" ? "Pants" : u.type === "Skirt" ? "Uniforms" : "Shirts",
        name: u.name,
        price: u.price,
        stock: total(u),
        sizes: Object.keys(u.stock).filter((s) => s !== "Unassigned"),
        description: u.course,
      });
    });
  }
  // Refresh every visible stock display from the same inventory snapshot.
  function refreshInventoryDisplays() {
    syncProducts();
    updateHeader();
    renderProducts();
    if (document.getElementById("cartModal").classList.contains("show")) renderCart();
    if (document.getElementById("productModal").classList.contains("show") && currentProduct) {
      const size = document.getElementById("detailSize")?.value;
      const quantity = Number(document.getElementById("detailQty")?.value || 1);
      showProduct(currentProduct.id);
      const sizes = document.getElementById("detailSize");
      if (sizes && [...sizes.options].some(o => o.value === size && !o.disabled)) {
        sizes.value = size;
        sizes.dispatchEvent(new Event("change", {bubbles:true}));
      }
      const input = document.getElementById("detailQty");
      if (input) input.value = Math.max(1, Math.min(quantity, Number(input.max) || 1));
    }
    if (!app.hidden && view === "overview" && user()) overviewView();
    document.dispatchEvent(new CustomEvent("proware:updated"));
  }
  function reloadLatestInventory() {
    try {
      const incoming = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!incoming || incoming.schema !== SCHEMA || incoming.revision <= state.revision) return;
      state = incoming;
      refreshInventoryDisplays();
      if (!app.hidden) render();
    } catch (error) {
      message("Inventory could not be refreshed. Reopen this page to try again.", true);
    }
  }
  function save() {
    const keys = [
      KEY,
      "marketly_products",
      "marketly_cart",
      "marketly_saved",
      "marketly_orders",
      "marketly_notifications",
      "marketly_user",
    ];
    const previous = keys.map((k) => [k, localStorage.getItem(k)]);
    try {
      state.revision++;
      syncProducts();
      persist();
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      for (const [k, v] of previous) {
        if (v === null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      }
      throw Error("The change could not be saved. Free browser storage and try again.");
    }
    refreshInventoryDisplays();
  }
  function commit(action, fn, admin = false) {
    requireStaff(admin);
    if (busy) throw Error("Please wait for the current change to finish.");
    const disk = JSON.parse(localStorage.getItem(KEY) || "null");
    if (disk && disk.revision !== state.revision) {
      state = disk;
      throw Error("Inventory changed in another tab. Reopen this form and try again.");
    }
    busy = true;
    const before = copy(state),
      beforeOrders = copy(orders),
      beforeProducts = copy(products);
    try {
      fn();
      activity(action);
      save();
    } catch (e) {
      state = before;
      orders = beforeOrders;
      products = beforeProducts;
      throw e;
    } finally {
      busy = false;
    }
  }
  function movement(
    u,
    size,
    delta,
    kind,
    reason,
    reference = "",
    qty = Math.abs(delta),
    actor = user()?.name || "Student checkout",
    date = today(),
  ) {
    if (!Object.hasOwn(u.stock, size)) throw Error("Choose a valid size.");
    const next = u.stock[size] + delta;
    if (!integer(next))
      throw Error("Not enough available stock for " + u.name + " · " + size + ".");
    u.stock[size] = next;
    state.movements.unshift({
      id: uid("MOV"),
      at: now(),
      date,
      uniformId: u.id,
      code: u.code,
      name: u.name,
      size,
      kind,
      qty,
      delta,
      balance: next,
      reason,
      staff: actor,
      reference,
    });
  }
  function message(text, error = false) {
    const m = $("pwMessage");
    if (m) {
      m.textContent = text;
      m.style.background = error ? "#ffeded" : "#e1f3ec";
      m.style.color = error ? "#a92c35" : "#145c46";
    } else toast(text);
  }
  function handle(fn) {
    return async (event) => {
      event.preventDefault();
      try {
        await fn(event);
      } catch (e) {
        message(e.message, true);
      }
    };
  }
  function field(name, label, control, full = false) {
    return `<div class="pw-field ${full ? "pw-full" : ""}"><label for="pw-${name}">${label}</label>${control}</div>`;
  }
  function input(name, label, value = "", type = "text", extra = "") {
    return field(
      name,
      label,
      `<input id="pw-${name}" name="${name}" type="${type}" value="${esc(value)}" required maxlength="120" ${extra}>`,
    );
  }
  function select(name, label, options, value = "", extra = "") {
    return field(
      name,
      label,
      `<select id="pw-${name}" name="${name}" ${extra}>${options
        .map((o) => {
          const [v, t] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(t)}</option>`;
        })
        .join("")}</select>`,
    );
  }
  function uniformSelect(name = "uniformId", label = "Uniform", value = "") {
    return select(
      name,
      label,
      [
        ["", "Choose a uniform"],
        ...state.uniforms.map((u) => [u.id, `${u.code} · ${u.name}`]),
      ],
      value,
      "required",
    );
  }
  function sizeSelect(name = "size", label = "Size") {
    return select(name, label, [["", "Choose a size"]], "", "required");
  }
  function bindSizes(
    uniformName = "uniformId",
    sizeName = "size",
    includeUnassigned = false,
  ) {
    const a = $("pw-" + uniformName),
      b = $("pw-" + sizeName);
    const update = () => {
      const u = state.uniforms.find((u) => u.id === a.value);
      b.innerHTML =
        '<option value="">Choose a size</option>' +
        (u
          ? Object.keys(u.stock)
              .filter((s) => includeUnassigned || s !== "Unassigned")
              .map(
                (s) =>
                  `<option value="${esc(s)}">${esc(s)} · ${u.stock[s]} available</option>`,
              )
              .join("")
          : "");
    };
    a.onchange = update;
    update();
  }
  function button(text, action, cls = "") {
    return `<button type="button" class="pw-btn ${cls}" data-action="${action}">${text}</button>`;
  }
  function table(columns, rows) {
    return `<div class="pw-table-wrap"><table class="pw-table"><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}" class="pw-empty">No records to show.</td></tr>`}</tbody></table></div>`;
  }
  function stockBadge(u, size) {
    const q = u.stock[size];
    return `<span class="pw-pill ${q === 0 ? "out" : q <= LOW_STOCK_LIMIT ? "low" : ""}">${q === 0 ? "Out of stock" : q <= LOW_STOCK_LIMIT ? "Low stock" : "Available"}</span>`;
  }
  function open(next = "overview") {
    view = next;
    app.hidden = false;
    document.body.style.overflow = "hidden";
    render();
    app.querySelector("input,button")?.focus();
  }
  function close() {
    app.hidden = true;
    if (
      !manager.classList.contains("open") &&
      !document.querySelector(".modal-backdrop.show")
    )
      document.body.style.overflow = "";
    entry.focus();
  }
  function render() {
    const a = user();
    app.innerHTML = `<header class="pw-top"><div><h1>Proware <span style="color:#74d5bf">/ Inventory</span></h1><small>STI CAMPUS STORE · Uniform inventory, stock, and prices</small></div><div class="pw-tools">${a ? `<span>${esc(a.name)} · ${esc(a.role)}</span>${button("Sign out", "logout")}` : ""}${a ? button("Back to store", "close") : ""}</div></header><div id="pwMessage" class="pw-message" role="status" aria-live="polite"></div><div class="pw-wrap">${
      a
        ? `<nav class="pw-nav" aria-label="Proware sections">${[
            ["overview", "Overview"],
            ["uniforms", "Uniforms & stock"],
          ]
            .map(([id, label]) => button(label, "nav:" + id, view === id ? "active" : ""))
            .join("")}</nav><div id="pwContent"></div>`
        : '<div id="pwContent"></div>'
    }<p class="pw-muted">Local browser prototype · Staff sessions end on refresh. Keep backups secure; they contain student records. Shared access and server-enforced privacy require a backend.</p></div>`;
    app.querySelectorAll("[data-action]").forEach(
      (b) =>
        (b.onclick = handle(() => {
          const act = b.dataset.action;
          if (act === "close") close();
          else if (act === "logout") {
            activity("Signed out");
            save();
            session = null;
            render();
          } else if (act.startsWith("nav:")) {
            view = act.slice(4);
            editId = null;
            render();
          }
        })),
    );
    if (!a) {
      authView();
      return;
    }
    (
      ({
        overview: overviewView,
        uniforms: uniformsView,
        stock: stockView,
        issues: issuesView,
        returns: returnsView,
        reports: reportsView,
        accounts: accountsView,
        backup: backupView,
      })[view] || overviewView
    )();
  }

  // Passwords are salted and derived, never stored in clear text.
  async function passwordHash(password, salt) {
    if (!crypto.subtle)
      throw Error("Staff login requires a secure browser context (HTTPS or localhost).");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new TextEncoder().encode(salt),
        iterations: 150000,
      },
      key,
      256,
    );
    return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function credentials(password) {
    if (password.length < 8) throw Error("Use a password with at least 8 characters.");
    const salt = uid("SALT");
    return { salt, hash: await passwordHash(password, salt) };
  }
  function authView() {
    const setup = !state.accounts.some(a=>a.role === "Admin" && a.active);
    $("pwContent").innerHTML =
      `<div class="pw-auth pw-card"><h2>${setup ? "Set up your Admin account" : "Staff sign in"}</h2><p class="pw-muted">${setup ? "Create the first administrator to start managing inventory." : "Use an Admin or Inventory Staff account."}</p><form id="pwAuth" class="pw-form">${setup ? input("name", "Full name") : ""}${input("username", "Username", "", "text", 'autocomplete="username" pattern="[A-Za-z0-9._-]{3,40}"')}${input("password", "Password", "", "password", 'minlength="8" autocomplete="' + (setup ? "new-password" : "current-password") + '"')}${setup ? input("confirm", "Confirm password", "", "password", 'minlength="8" autocomplete="new-password"') : ""}<button class="pw-btn pw-primary" type="submit">${setup ? "Create Admin account" : "Sign in"}</button></form></div>`;
    $("pwAuth").insertAdjacentHTML("afterend", `<details class="pw-note" style="margin-top:20px"><summary>First time here? Set up demo access</summary><p>Create Proware test accounts for this local prototype. Existing accounts, uniform stock, prices and records are preserved. These public passwords are for practice only.</p><button type="button" class="pw-btn" id="pwSetupDemo">Create demo accounts</button><div id="pwDemoAccounts" aria-live="polite"></div></details>`);
    $("pwSetupDemo").onclick = handle(async (e) => {
      const button=e.currentTarget;
      button.disabled=true;
      try {
        const definitions=[
          {username:"demo.admin",password:"Admin123!",name:"Demo Proware Administrator",role:"Admin"},
          {username:"demo.inventory",password:"Inventory123!",name:"Demo Inventory Staff",role:"Inventory Staff"}
        ];
        const prepared=[];
        for(const d of definitions){
          const existing=state.accounts.find(a=>a.username===d.username);
          if(existing&&!existing.demoAccount)throw Error("A regular account already uses "+d.username+". It was not changed; ask its administrator for access.");
          const {password,...details}=d;
          prepared.push({...details,...await credentials(password),id:existing?.id||uid("STAFF"),active:true,demoAccount:true});
        }
        const latest=JSON.parse(localStorage.getItem(KEY)||"null");
        if(latest&&latest.revision!==state.revision){state=latest;throw Error("Inventory records changed in another tab. Reopen sign-in and try again.");}
        const before=copy(state);
        try{
          for(const a of prepared){const index=state.accounts.findIndex(x=>x.id===a.id);if(index<0)state.accounts.push(a);else state.accounts[index]=a;}
          activity("Created or reset public demo accounts","Demo accounts only; other accounts and inventory unchanged","Local demo setup");
          save();
        }catch(err){state=before;throw err;}
        render();
        $("pwSetupDemo").closest("details").open=true;
        $("pwDemoAccounts").innerHTML=table(["Role","Username","Password"],definitions.map(d=>[esc(d.role),esc(d.username),esc(d.password)]));
        $("pw-username").value="demo.admin";
        $("pw-password").value="";
        message("Proware demo accounts are ready. Sign in using an account below.");
      }finally{button.disabled=false;}
    });
    $("pwAuth").onsubmit = handle(async (e) => {
      const form = e.target;
      if (!form.reportValidity()) return;
      const data = new FormData(form),
        username = String(data.get("username")).trim().toLowerCase(),
        password = String(data.get("password"));
      const submit = form.querySelector("button");
      submit.disabled = true;
      try {
        if (setup) {
          if (state.accounts.some(a=>a.role === "Admin" && a.active)) throw Error("Admin setup is already complete.");
          if (state.accounts.some(a=>a.username === username)) throw Error("Choose another username; this one already exists.");
          if (password !== data.get("confirm")) throw Error("Passwords do not match.");
          const cred = await credentials(password);
          const a = {
            id: uid("STAFF"),
            name: String(data.get("name")).trim(),
            username,
            role: "Admin",
            active: true,
            ...cred,
          };
          if (!a.name) throw Error("Enter a full name.");
          state.accounts.push(a);
          session = a.id;
          activity("Created initial Admin account");
          save();
        } else {
          const a = state.accounts.find((a) => a.username === username && a.active);
          const hash = await passwordHash(password, a?.salt || "invalid-account");
          if (!a || hash !== a.hash) {
            activity("Failed sign-in", username, "Unauthenticated");
            save();
            throw Error("Username or password is incorrect.");
          }
          session = a.id;
          activity("Signed in");
          save();
        }
        render();
        if (returnToOrder) {
          view = "issues";
          render();
          message("Select the paid order and record the uniform handover.");
        }
      } finally {
        submit.disabled = false;
      }
    });
  }
  function overviewView() {
    const variants = state.uniforms.flatMap((u) =>
      Object.keys(u.stock)
        .filter((s) => s !== "Unassigned")
        .map((size) => ({ u, size })),
    );
    const low = variants.filter(({ u, size }) => u.stock[size] <= LOW_STOCK_LIMIT);
    const unassigned = state.uniforms.reduce((s, u) => s + (u.stock.Unassigned || 0), 0);
    $("pwContent").innerHTML = `<div class="pw-stats">${[
      ["Available units", state.uniforms.reduce((s, u) => s + total(u), 0)],
      ["Uniform records", state.uniforms.length],
      ["Low / out-of-stock sizes", low.length],
      ["Issued units", state.issues.reduce((s, i) => s + i.qty, 0)],
    ]
      .map(([t, n]) => `<div class="pw-stat"><span>${t}</span><strong>${n}</strong></div>`)
      .join(
        "",
      )}</div>${unassigned ? `<div class="pw-note pw-warning">${unassigned} existing units have no confirmed size. Use <b>Uniforms & stock → Edit stock</b> to enter confirmed quantities by size and update the Unassigned quantity after counting.</div>` : ""}<div class="pw-grid"><section class="pw-card"><h2>Stock alerts</h2><p class="pw-muted">Status updates automatically per size: 0 = Out of stock, 1–30 = Low stock, 31+ = Available.</p>${table(
      ["Uniform", "Size", "Available", "Status"],
      low.map(({ u, size }) => [
        esc(u.code) + "<small>" + esc(u.name) + "</small>",
        esc(size),
        u.stock[size],
        stockBadge(u, size),
      ]),
    )}</section><section class="pw-card"><h2>Latest stock movements</h2>${table(
      ["Date", "Uniform / size", "Movement", "Quantity", "Staff"],
      state.movements
        .slice(0, 10)
        .map((m) => [
          esc(dateText(m.at)),
          esc(m.code) + " / " + esc(m.size),
          esc(m.kind),
          (m.delta > 0 ? "+" : "") + m.delta,
          esc(m.staff),
        ]),
    )}</section></div>`;
  }
  function uniformsView() {
    const admin = user().role === "Admin";
    $("pwContent").innerHTML =
      `<section class="pw-card"><div class="pw-toolbar"><div style="flex:1"><h2>Uniform information</h2><p class="pw-muted">Available quantities are tracked separately for every size. Low stock: 30 units or fewer; zero units: Out of stock.</p></div>${admin ? button("Add uniform", "new", "pw-primary") : ""}</div><div class="pw-toolbar">${input("search", "Search name, code, or size", "", "search", 'placeholder="e.g. STI-001 or M"')}${select("stockFilter", "Stock status", ["All sizes", "Low stock", "Out of stock"])}</div><div id="pwUniformTable"></div></section><div id="pwUniformEditor"></div>`;
    function draw() {
      const q = $("pw-search").value.toLowerCase().trim(),
        filter = $("pw-stockFilter").value;
      const rows = [];
      state.uniforms.forEach((u) =>
        Object.entries(u.stock).forEach(([s, n]) => {
          if (!`${u.code} ${u.name} ${s}`.toLowerCase().includes(q)) return;
          if (filter === "Low stock" && !(n > 0 && n <= LOW_STOCK_LIMIT)) return;
          if (filter === "Out of stock" && n !== 0) return;
          rows.push([
            esc(u.code),
            esc(u.name) + "<small>" + esc(u.type) + "</small>",
            esc(u.course),
            esc(s),
              n,
            stockBadge(u, s),
            `<button class="pw-btn pw-primary" data-stock-price="${esc(u.id)}" data-size="${esc(s)}">Edit stock</button>${admin ? ` <button class="pw-btn" data-edit="${esc(u.id)}">Edit details</button>` : ""}`,
          ]);
        }),
      );
      $("pwUniformTable").innerHTML = table(
        [
          "Code",
          "Uniform",
          "Course / grade",
          "Size",
            "Available",
          "Status",
          "Record",
        ],
        rows,
      );
      app
        .querySelectorAll("[data-edit]")
        .forEach((b) => (b.onclick = () => uniformEditor(b.dataset.edit)));
      app
        .querySelectorAll("[data-stock-price]")
        .forEach(
          (b) => (b.onclick = () => stockPriceEditor(b.dataset.stockPrice, b.dataset.size)),
        );
    }
    $("pw-search").oninput = draw;
    $("pw-stockFilter").onchange = draw;
    app
      .querySelector('[data-action="new"]')
      ?.addEventListener("click", () => uniformEditor());
    draw();
  }
  function stockPriceEditor(id, initialSize) {
    requireStaff();
    const u = uniform(id);
    $("pwUniformEditor").innerHTML = `<section class="pw-card"><div class="pay-kicker">${esc(u.code)}</div><h2>Edit stock · ${esc(u.name)}</h2><p class="pw-muted">Set the available quantity for the selected size. Stock reserved by existing orders is kept separate.</p><form id="pwStockPriceForm" class="pw-form">${select("editSize", "Size", Object.keys(u.stock), initialSize, "required")}${input("availableStock", "Available quantity", u.stock[initialSize] ?? 0, "number", 'min="0" max="1000000" step="1"')}<p id="pwEditSummary" class="pw-note pw-full"></p><button class="pw-btn pw-primary" type="submit">Update stock</button><button class="pw-btn" id="pwCancelStockPrice" type="button">Cancel</button></form></section>`;
    const summary = () => {
      $("pwEditSummary").textContent = "Current available stock: " + uniform(id).stock[$("pw-editSize").value];
    };
    $("pw-editSize").onchange = () => {
      $("pw-availableStock").value = uniform(id).stock[$("pw-editSize").value];
      summary();
    };
    summary();
    $("pwCancelStockPrice").onclick = () => { $("pwUniformEditor").innerHTML = ""; };
    $("pwStockPriceForm").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      const size = $("pw-editSize").value, quantity = Number($("pw-availableStock").value);
      if (!Object.hasOwn(uniform(id).stock, size) || !integer(quantity)) throw Error("Enter a whole available quantity from 0 to 1,000,000.");
      if (quantity === uniform(id).stock[size]) throw Error("No stock changes to save.");
      if (!window.confirm("Would you like to update the stock?")) return;
      commit("Updated uniform stock", () => {
        const current = uniform(id), oldStock = current.stock[size];
        movement(current, size, quantity - oldStock, "Stock adjustment", "Confirmed stock update", uid("EDIT"));
        activity("Stock update details", current.code + " · " + size + " · " + oldStock + " → " + quantity);
      });
      render();
      message("Stock updated. Store and cashier availability are synchronized.");
    });
    $("pwUniformEditor").scrollIntoView({ behavior: "smooth", block: "start" });
    $("pw-availableStock").focus();
  }
  function uniformEditor(id) {
    requireStaff(true);
    const u = id ? uniform(id) : null;
    editId = id || null;
    $("pwUniformEditor").innerHTML =
      `<section class="pw-card"><h2>${u ? "Edit uniform" : "Add uniform"}</h2><form id="pwUniformForm" class="pw-form">${input("code", "Uniform code", u?.code || "")}${input("name", "Uniform name", u?.name || "")}${select("type", "Uniform type", types, u?.type || "Polo")}${input("course", "Applicable course or grade level", u?.course || "All courses / grade levels")}${input("price", "Selling price (₱)", u?.price ?? 0, "number", 'min="0" max="1000000" step="0.01"')}${input("threshold", "Low-stock threshold per size", LOW_STOCK_LIMIT, "number", "readonly")}${input(
        "sizes",
        "Sizes (comma-separated)",
        u
          ? Object.keys(u.stock)
              .filter((s) => s !== "Unassigned")
              .join(", ")
          : "XS, S, M, L, XL, XXL",
      )}<p class="pw-muted">Receive units in the stock section. Sizes with stock or history must be retained.</p><button class="pw-btn pw-primary" type="submit">Save uniform</button></form></section>`;
    $("pwUniformForm").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target);
      commit(
        "Saved uniform record",
        () => {
          const code = String(f.get("code")).trim().toUpperCase(),
            name = String(f.get("name")).trim(),
            course = String(f.get("course")).trim(),
            sizes = [
              ...new Set(
                String(f.get("sizes"))
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean),
              ),
            ],
            price = Number(f.get("price")),
            threshold = LOW_STOCK_LIMIT;
          if (!/^[A-Z0-9._-]{2,40}$/.test(code) || !name || !course)
            throw Error(
              "Enter a name, course, and code using 2–40 letters, numbers, dots, dashes, or underscores.",
            );
          if (state.uniforms.some((x) => x.id !== editId && x.code === code))
            throw Error("Uniform code is already in use.");
          if (
            !types.includes(f.get("type")) ||
            !sizes.length ||
            sizes.length > 20 ||
            sizes.some((s) => s === "UNASSIGNED" || !/^[A-Z0-9][A-Z0-9 ._-]{0,15}$/.test(s))
          )
            throw Error("Enter 1–20 valid sizes, up to 16 characters each.");
          if (!Number.isFinite(price) || price < 0 || price > 1000000 || !integer(threshold))
            throw Error("Enter a valid price and whole-number stock threshold.");
          if (u) {
            const removed = Object.keys(u.stock).filter(
              (s) => s !== "Unassigned" && !sizes.includes(s),
            );
            if (
              removed.some(
                (s) =>
                  u.stock[s] > 0 ||
                  state.movements.some((m) => m.uniformId === u.id && m.size === s),
              )
            )
              throw Error("Keep sizes with stock or movement history.");
            Object.assign(u, {
              code,
              name,
              course,
              type: f.get("type"),
              price: Math.round(price * 100) / 100,
              threshold,
            });
            removed.forEach((s) => delete u.stock[s]);
            sizes.forEach((s) => (u.stock[s] ??= 0));
          } else
            state.uniforms.push({
              id: uid("uniform"),
              code,
              name,
              course,
              type: f.get("type"),
              price: Math.round(price * 100) / 100,
              threshold,
              stock: Object.fromEntries(sizes.map((s) => [s, 0])),
            });
        },
        true,
      );
      render();
      message("Uniform record saved.");
    });
    $("pwUniformEditor").scrollIntoView({ behavior: "smooth" });
  }
  function stockView() {
    const admin = user().role === "Admin";
    $("pwContent").innerHTML =
      `<section class="pw-card"><h2>Receive stock & adjustments</h2><p class="pw-muted">Every change records the quantity, date, reason, balance, and signed-in staff member.</p><form id="pwStockForm" class="pw-form">${select("kind", "Action", ["Receive stock", "Record damaged stock", ...(admin ? ["Increase adjustment", "Decrease adjustment", "Allocate unassigned stock"] : [])])}${uniformSelect()}${sizeSelect()}${input("qty", "Quantity", 1, "number", 'min="1" max="1000000" step="1"')}${input("date", "Delivery / movement date", today(), "date", `max="${today()}"`)}${input("reference", "Delivery or adjustment reference", "", "text", 'placeholder="e.g. delivery receipt number"')}${input("reason", "Reason", "", "text", 'placeholder="Required for audit history"')}<button class="pw-btn pw-primary" type="submit">Record movement</button></form></section><section class="pw-card"><h2>Recent movements</h2>${movementTable(state.movements.slice(0, 40))}</section>`;
    bindSizes();
    $("pwStockForm").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target),
        kind = f.get("kind"),
        qty = Number(f.get("qty"));
      commit(kind, () => {
        const u = uniform(f.get("uniformId")),
          size = f.get("size"),
          reason = String(f.get("reason")).trim(),
          ref = String(f.get("reference")).trim(),
          date = String(f.get("date"));
        if (
          !integer(qty) ||
          qty < 1 ||
          !reason ||
          !ref ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          date > today()
        )
          throw Error("Enter a positive whole quantity, date, reference, and reason.");
        if (
          [
            "Increase adjustment",
            "Decrease adjustment",
            "Allocate unassigned stock",
          ].includes(kind)
        )
          requireStaff(true);
        if (kind === "Allocate unassigned stock") {
          movement(
            u,
            "Unassigned",
            -qty,
            "Size allocation",
            reason,
            ref,
            qty,
            user().name,
            date,
          );
          movement(u, size, qty, "Size allocation", reason, ref, qty, user().name, date);
        } else {
          const sign = ["Receive stock", "Increase adjustment"].includes(kind) ? 1 : -1;
          movement(u, size, sign * qty, kind, reason, ref, qty, user().name, date);
        }
      });
      render();
      message("Stock movement recorded.");
    });
  }
  function movementTable(items) {
    return table(
      [
        "Date",
        "Code / uniform",
        "Size",
        "Movement",
        "Quantity",
        "Change",
        "Balance",
        "Reason / reference",
        "Staff",
      ],
      items.map((m) => [
        esc(m.date),
        esc(m.code) + "<small>" + esc(m.name) + "</small>",
        esc(m.size),
        esc(m.kind),
        m.qty,
        (m.delta > 0 ? "+" : "") + m.delta,
        m.balance,
        esc(m.reason) + "<small>" + esc(m.reference) + "</small>",
        esc(m.staff),
      ]),
    );
  }
  function issuesView() {
    const eligible = orders.filter(
      (o) =>
        o.paymentStatus === "Paid" &&
        o.status === "Ready for Pickup" &&
        !state.issues.some((i) => i.orderId === o.id),
    );
    $("pwContent").innerHTML =
      `<div class="pw-grid"><section class="pw-card"><h2>Issue uniforms to a student</h2><p class="pw-muted">Use this form for a direct issue. Paid checkout orders use the handover form alongside it.</p><form id="pwIssueForm" class="pw-form">${input("studentNumber", "Student number")}${input("studentName", "Full name")}${input("course", "Course / grade level")}${input("year", "Year level")}${uniformSelect()}${sizeSelect()}${input("qty", "Quantity", 1, "number", 'min="1" max="1000000" step="1"')}${input("date", "Date issued", today(), "date", `max="${today()}"`)}${input("reference", "Issuance reference / reason")}<button class="pw-btn pw-primary" type="submit">Issue uniform</button></form></section><section class="pw-card"><h2>Hand over a paid order</h2><p class="pw-muted">Checkout has already reserved these units. Handover records the student and staff member without another stock deduction.</p><form id="pwOrderIssue" class="pw-form">${select("orderId", "Paid order", [["", "Choose a paid order"], ...eligible.map((o) => [o.id, `${o.id} · ${o.recipient}`])], returnToOrder || "", "required")}<div id="pwOrderPreview" class="pw-full"></div><button class="pw-btn pw-primary" type="submit">Confirm uniform handover</button></form></section></div><section class="pw-card"><h2>Student issuance records</h2><div class="pw-toolbar">${input("issueSearch", "Search student or issuance", "", "search")}</div><div id="pwIssueTable"></div></section>`;
    bindSizes();
    const draw = () => {
      const q = $("pw-issueSearch").value.toLowerCase().trim();
      $("pwIssueTable").innerHTML = issueTable(
        state.issues.filter((i) =>
          [i.id, i.studentNumber, i.studentName, i.code, i.uniformName, i.orderId]
            .join(" ")
            .toLowerCase()
            .includes(q),
        ),
      );
    };
    $("pw-issueSearch").oninput = draw;
    draw();
    const preview = () => {
      const o = orders.find((o) => o.id === $("pw-orderId").value);
      $("pwOrderPreview").innerHTML = o
        ? `<div class="pw-note"><b>${esc(o.recipient)}</b> · ${esc(o.studentNumber)}<br>${esc(o.course)} · ${esc(o.yearLevel)}<br>${o.items.map((i) => esc(i.name) + " · " + esc(i.size || "Size missing") + " × " + i.qty).join("<br>")}</div>`
        : "";
    };
    $("pw-orderId").onchange = preview;
    preview();
    $("pwIssueForm").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target);
      commit("Issued uniform", () => {
        const u = uniform(f.get("uniformId")),
          qty = Number(f.get("qty")),
          size = f.get("size"),
          date = String(f.get("date"));
        const student = {
          studentNumber: String(f.get("studentNumber")).trim(),
          studentName: String(f.get("studentName")).trim(),
          course: String(f.get("course")).trim(),
          year: String(f.get("year")).trim(),
        };
        if (
          Object.values(student).some((x) => !x) ||
          !integer(qty) ||
          qty < 1 ||
          date > today()
        )
          throw Error("Complete student details and enter a valid quantity and date.");
        const ref = String(f.get("reference")).trim();
        if (!ref) throw Error("Enter an issuance reference or reason.");
        const id = uid("ISS");
        movement(u, size, -qty, "Student issue", ref, id, qty, user().name, date);
        state.issues.unshift({
          id,
          at: now(),
          date,
          ...student,
          uniformId: u.id,
          code: u.code,
          uniformName: u.name,
          type: u.type,
          size,
          qty,
          returned: 0,
          staff: user().name,
          reference: ref,
          orderId: "",
        });
      });
      render();
      message("Uniform issued and stock updated.");
    });
    $("pwOrderIssue").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      commit("Handed over paid order", () => {
        const o = orders.find((o) => o.id === $("pw-orderId").value);
        if (
          !o ||
          o.paymentStatus !== "Paid" ||
          o.status !== "Ready for Pickup" ||
          state.issues.some((i) => i.orderId === o.id)
        )
          throw Error("Choose a paid order that has not been issued.");
        const lines = o.items.map((i) => ({
          i,
          u: state.uniforms.find((u) => u.id === i.id),
        }));
        if (lines.some(({ i, u }) => !u || !i.size || !Object.hasOwn(u.stock, i.size)))
          throw Error("This order needs confirmed uniform sizes before inventory handover.");
        lines.forEach(({ i, u }) => {
          const id = uid("ISS");
          movement(u, i.size, 0, "Paid order handover", "Reserved at checkout", o.id, i.qty);
          state.issues.unshift({
            id,
            at: now(),
            date: today(),
            studentNumber: o.studentNumber || "",
            studentName: o.recipient || "",
            course: o.course || "",
            year: o.yearLevel || "",
            uniformId: u.id,
            code: u.code,
            uniformName: u.name,
            type: u.type,
            size: i.size,
            qty: i.qty,
            returned: 0,
            staff: user().name,
            reference: o.id,
            orderId: o.id,
          });
        });
        o.status = "Claimed";
        o.prowareReserved = false;
        o.prowareIssued = true;
        o.issuedBy = user().name;
        o.issuedAt = now();
      });
      returnToOrder = null;
      renderOrders();
      render();
      document.dispatchEvent(
        new CustomEvent("proware:issued", { detail: { orderId: state.issues[0].orderId } }),
      );
      message("Handover recorded. Order marked Claimed.");
    });
  }
  function issueTable(items) {
    return table(
      [
        "Issuance / original sale",
        "Student number",
        "Full name",
        "Course / grade",
        "Year",
        "Uniform / type",
        "Size",
        "Issued",
        "Returned",
        "Date issued",
        "Issued by",
      ],
      items.map((i) => [
        esc(i.id) + "<small>" + esc(i.orderId || i.reference) + "</small>",
        esc(i.studentNumber),
        esc(i.studentName),
        esc(i.course),
        esc(i.year),
        esc(i.code) + " · " + esc(i.uniformName) + "<small>" + esc(i.type) + "</small>",
        esc(i.size),
        i.qty,
        i.returned,
        esc(i.date),
        esc(i.staff),
      ]),
    );
  }
  function returnsView() {
    const eligible = state.issues.filter((i) => i.returned < i.qty);
    $("pwContent").innerHTML =
      `<section class="pw-card"><h2>Returns & size exchanges</h2><p class="pw-muted">Select the original issuance or completed sale. Inspect the returned uniform before making it available again. This records inventory only; refunds remain a cashier action.</p><form id="pwReturnForm" class="pw-form">${select("issueId", "Original issuance / sale", [["", "Choose original issuance"], ...eligible.map((i) => [i.id, `${i.studentNumber} · ${i.uniformName} · ${i.size} · ${i.qty - i.returned} returnable · ${i.id}`])], "", "required")}${select("returnAction", "Action", ["Size exchange", "Return only"])}${input("qty", "Quantity", 1, "number", 'min="1" max="1000000" step="1"')}${select(
        "condition",
        "Returned condition",
        [
          ["Resalable", "Resalable — add to available stock"],
          ["Damaged", "Damaged — keep out of available stock"],
        ],
      )}${sizeSelect("replacementSize", "Replacement size")}${input("reason", "Return / exchange reason")}<div id="pwReturnPreview" class="pw-full"></div><button class="pw-btn pw-primary" type="submit">Record return / exchange</button></form></section><section class="pw-card"><h2>Return & exchange history</h2>${table(
        [
          "Date",
          "Original issuance / sale",
          "Uniform",
          "Returned size",
          "Replacement size",
          "Quantity",
          "Condition",
          "Reason",
          "Staff",
        ],
        state.exchanges.map((x) => [
          esc(dateText(x.at)),
          esc(x.issueId) + "<small>" + esc(x.orderId) + "</small>",
          esc(x.code) + " · " + esc(x.uniformName),
          esc(x.fromSize),
          esc(x.toSize || "Return only"),
          x.qty,
          esc(x.condition),
          esc(x.reason),
          esc(x.staff),
        ]),
      )}</section>`;
    const update = () => {
      const i = state.issues.find((i) => i.id === $("pw-issueId").value),
        u = i ? uniform(i.uniformId) : null,
        isExchange = $("pw-returnAction").value === "Size exchange";
      $("pw-replacementSize").disabled = !isExchange;
      $("pw-replacementSize").required = isExchange;
      $("pw-replacementSize").closest(".pw-field").hidden = !isExchange;
      $("pw-replacementSize").innerHTML =
        '<option value="">Choose replacement size</option>' +
        (u
          ? Object.keys(u.stock)
              .filter((s) => s !== "Unassigned" && s !== i.size)
              .map(
                (s) =>
                  `<option value="${esc(s)}">${esc(s)} · ${u.stock[s]} available</option>`,
              )
              .join("")
          : "");
      $("pwReturnPreview").innerHTML = i
        ? `<div class="pw-note">${esc(i.studentName)} · ${esc(i.studentNumber)}<br>${esc(i.uniformName)} · ${esc(i.size)}<br>${i.qty - i.returned} units may still be returned. A replacement creates a linked issuance record.</div>`
        : "";
    };
    $("pw-issueId").onchange = update;
    $("pw-returnAction").onchange = update;
    update();
    $("pwReturnForm").onsubmit = handle((e) => {
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target);
      commit("Processed return / exchange", () => {
        const i = state.issues.find((i) => i.id === f.get("issueId"));
        if (!i) throw Error("Choose the original issuance.");
        const u = uniform(i.uniformId),
          qty = Number(f.get("qty")),
          condition = f.get("condition"),
          exchange = f.get("returnAction") === "Size exchange",
          toSize = exchange ? f.get("replacementSize") : "",
          reason = String(f.get("reason")).trim();
        if (!integer(qty) || qty < 1 || qty > i.qty - i.returned || !reason)
          throw Error("Enter a quantity within the remaining issuance and a reason.");
        if (!["Resalable", "Damaged"].includes(condition))
          throw Error("Inspect the returned condition.");
        if (
          exchange &&
          (!Object.hasOwn(u.stock, toSize) || toSize === i.size || u.stock[toSize] < qty)
        )
          throw Error("Choose a different size with enough replacement stock.");
        const id = uid("RET");
        movement(
          u,
          i.size,
          condition === "Resalable" ? qty : 0,
          condition === "Resalable" ? "Resalable return" : "Damaged return",
          reason,
          id,
          qty,
        );
        if (exchange) {
          movement(u, toSize, -qty, "Exchange replacement", reason, id, qty);
          state.issues.unshift({
            ...i,
            id: uid("ISS"),
            at: now(),
            date: today(),
            size: toSize,
            qty,
            returned: 0,
            staff: user().name,
            reference: id,
            orderId: "",
            originalIssueId: i.id,
          });
        }
        i.returned += qty;
        state.exchanges.unshift({
          id,
          at: now(),
          issueId: i.id,
          orderId: i.orderId || i.reference,
          uniformId: u.id,
          code: u.code,
          uniformName: u.name,
          fromSize: i.size,
          toSize,
          qty,
          condition,
          reason,
          staff: user().name,
        });
      });
      render();
      message("Return / exchange recorded. Inventory updated.");
    });
  }
  function reportsView() {
    $("pwContent").innerHTML =
      `<section class="pw-card"><h2>Inventory reports</h2><form id="pwReportForm" class="pw-toolbar">${select("report", "Report", ["Available stock", "Low / out-of-stock", "Stock-in", "Stock-out", "Student issuance", "Damaged items", "Inventory adjustments", "All movements", "Staff activity"])}${field("from", "From date", '<input id="pw-from" name="from" type="date">')}${field("to", "To date", '<input id="pw-to" name="to" type="date">')}<button class="pw-btn pw-primary" type="submit">Generate report</button><button class="pw-btn" type="button" id="pwExportReport">Download CSV</button></form><p id="pwReportInfo" class="pw-muted"></p><div id="pwReportTable"></div></section>`;
    function generate() {
      requireStaff();
      const name = $("pw-report").value,
        from = $("pw-from").value,
        to = $("pw-to").value;
      if (from && to && from > to) throw Error("From date must be on or before To date.");
      const range = (d) => (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to);
      let columns, rows;
      if (["Available stock", "Low / out-of-stock"].includes(name)) {
        columns = [
          "Uniform code",
          "Uniform name",
          "Type",
          "Course / grade level",
          "Size",
          "Selling price",
          "Available quantity",
          "Low-stock threshold",
        ];
        rows = state.uniforms.flatMap((u) =>
          Object.entries(u.stock)
            .filter(([s, n]) => name === "Available stock" || n <= LOW_STOCK_LIMIT)
            .map(([s, n]) => [u.code, u.name, u.type, u.course, s, u.price, n, u.threshold]),
        );
      } else if (name === "Student issuance") {
        columns = [
          "Issuance ID",
          "Original sale / reference",
          "Student number",
          "Full name",
          "Course / grade",
          "Year",
          "Uniform code",
          "Uniform name",
          "Type",
          "Size",
          "Quantity issued",
          "Quantity returned",
          "Date issued",
          "Staff member",
        ];
        rows = state.issues
          .filter((i) => range(i.date))
          .map((i) => [
            i.id,
            i.orderId || i.reference,
            i.studentNumber,
            i.studentName,
            i.course,
            i.year,
            i.code,
            i.uniformName,
            i.type,
            i.size,
            i.qty,
            i.returned,
            i.date,
            i.staff,
          ]);
      } else if (name === "Staff activity") {
        columns = ["Date and time", "Staff member", "Action", "Details"];
        rows = state.activities
          .filter((a) => range(a.at))
          .map((a) => [dateText(a.at), a.staff, a.action, a.details]);
      } else {
        columns = [
          "Movement ID",
          "Date",
          "Uniform code",
          "Uniform name",
          "Size",
          "Movement",
          "Quantity",
          "Stock change",
          "Balance after",
          "Reason",
          "Reference",
          "Staff member",
        ];
        let items = state.movements.filter((m) => range(m.date));
        if (name === "Stock-in") items = items.filter((m) => m.delta > 0);
        if (name === "Stock-out") items = items.filter((m) => m.delta < 0);
        if (name === "Damaged items")
          items = items.filter((m) =>
            ["Record damaged stock", "Damaged return"].includes(m.kind),
          );
        if (name === "Inventory adjustments")
          items = items.filter((m) => /adjustment|allocation/i.test(m.kind));
        rows = items.map((m) => [
          m.id,
          m.date,
          m.code,
          m.name,
          m.size,
          m.kind,
          m.qty,
          m.delta,
          m.balance,
          m.reason,
          m.reference,
          m.staff,
        ]);
      }
      reportColumns = columns;
      reportRows = rows;
      reportName = name;
      $("pwReportInfo").textContent =
        `${rows.length} record(s) · ${name}${["Available stock", "Low / out-of-stock"].includes(name) ? " · Current snapshot; date filters apply to history reports." : ""}`;
      $("pwReportTable").innerHTML = table(
        columns,
        rows.map((r) => r.map(esc)),
      );
    }
    $("pwReportForm").onsubmit = handle(() => generate());
    $("pwExportReport").onclick = handle(() => {
      requireStaff();
      generate();
      const csv = [reportColumns, ...reportRows]
        .map((row) =>
          row
            .map((v) => {
              let s = String(v ?? "");
              if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
              return '"' + s.replaceAll('"', '""') + '"';
            })
            .join(","),
        )
        .join("\r\n");
      download(
        "\ufeff" + csv,
        "proware-" + reportName.toLowerCase().replaceAll(" ", "-") + "-" + today() + ".csv",
        "text/csv",
      );
      activity("Exported report", reportName);
      save();
    });
    generate();
  }
  function accountsView() {
    requireStaff(true);
    $("pwContent").innerHTML =
      `<div class="pw-grid"><section class="pw-card"><h2>Staff accounts</h2><p class="pw-muted">Admins manage records, adjustments, reports, accounts, and recovery. Inventory Staff receive stock, edit stock and selling prices with a reason, record damage, issue uniforms, process exchanges, and view reports.</p>${table(
        ["Name", "Username", "Role", "Status", "Action"],
        state.accounts.map((a) => [
          esc(a.name),
          esc(a.username),
          esc(a.role),
          a.active ? "Active" : "Disabled",
          `<button class="pw-btn" data-account="${esc(a.id)}">Manage</button>`,
        ]),
      )}</section><section class="pw-card"><h2 id="pwAccountHeading">Add staff account</h2><form id="pwAccountForm" class="pw-form">${input("accountName", "Full name")}${input("accountUsername", "Username", "", "text", 'pattern="[A-Za-z0-9._-]{3,40}" autocomplete="off"')}${select("accountRole", "Role", ["Inventory Staff", "Admin"])}${input("accountPassword", "Password", "", "password", 'minlength="8" autocomplete="new-password"')}<button class="pw-btn pw-primary" type="submit">Save account</button></form><div id="pwAccountActions"></div></section></div>`;
    let selected = null;
    app.querySelectorAll("[data-account]").forEach(
      (b) =>
        (b.onclick = () => {
          const a = state.accounts.find((a) => a.id === b.dataset.account);
          selected = a.id;
          $("pwAccountHeading").textContent = "Manage " + a.name;
          $("pw-accountName").value = a.name;
          $("pw-accountUsername").value = a.username;
          $("pw-accountRole").value = a.role;
          $("pw-accountPassword").value = "";
          $("pw-accountPassword").required = false;
          $("pw-accountPassword").placeholder = "Leave blank to keep password";
          $("pwAccountActions").innerHTML =
            `<p class="pw-muted">Leave the password blank to keep it, or enter a new password to reset it.</p><button class="pw-btn ${a.active ? "pw-danger" : ""}" id="pwToggleAccount">${a.active ? "Disable account" : "Enable account"}</button><button class="pw-btn" id="pwNewAccount">Add another account</button>`;
          $("pwNewAccount").onclick = () => accountsView();
          $("pwToggleAccount").onclick = handle(() => {
            commit(
              "Changed account status",
              () => {
                const target = state.accounts.find((a) => a.id === selected);
                if (target.id === session)
                  throw Error("You cannot disable your current account.");
                if (
                  target.active &&
                  target.role === "Admin" &&
                  state.accounts.filter((a) => a.active && a.role === "Admin").length <= 1
                )
                  throw Error("Keep at least one active Admin account.");
                target.active = !target.active;
              },
              true,
            );
            render();
            message("Account status updated.");
          });
        }),
    );
    $("pwAccountForm").onsubmit = handle(async (e) => {
      requireStaff(true);
      if (!e.target.reportValidity()) return;
      const f = new FormData(e.target),
        password = String(f.get("accountPassword")),
        cred = password ? await credentials(password) : null;
      commit(
        "Saved staff account",
        () => {
          const name = String(f.get("accountName")).trim(),
            username = String(f.get("accountUsername")).trim().toLowerCase(),
            role = f.get("accountRole");
          if (
            !name ||
            !/^[a-z0-9._-]{3,40}$/.test(username) ||
            !["Admin", "Inventory Staff"].includes(role)
          )
            throw Error("Enter a name, valid username (3–40 characters), and role.");
          if (state.accounts.some((a) => a.id !== selected && a.username === username))
            throw Error("Username already exists.");
          if (selected) {
            const a = state.accounts.find((a) => a.id === selected);
            if (
              a.role === "Admin" &&
              role !== "Admin" &&
              a.active &&
              state.accounts.filter((a) => a.role === "Admin" && a.active).length <= 1
            )
              throw Error("Keep at least one active Admin account.");
            Object.assign(a, { name, username, role }, cred || {});
          } else {
            if (!cred) throw Error("A new account needs a password.");
            state.accounts.push({
              id: uid("STAFF"),
              name,
              username,
              role,
              active: true,
              ...cred,
            });
          }
        },
        true,
      );
      render();
      message("Staff account saved.");
    });
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
  function backupView() {
    requireStaff(true);
    if (typeof CashierSystem !== "undefined") {
      $("pwContent").innerHTML =
        '<section class="pw-card"><h2>Full school-system backup</h2><p>Back up inventory together with tuition, payments, user accounts, and orders to keep all records consistent.</p><button class="pw-btn pw-primary" id="pwFullBackup">Open school-system backup & recovery</button><p class="pw-muted">Sign in with a payments Admin account to export or restore the complete system.</p></section>';
      $("pwFullBackup").onclick = () => {
        close();
        CashierSystem.open("activity");
      };
      return;
    }
    $("pwContent").innerHTML =
      `<section class="pw-card"><h2>Backup & recovery</h2><p>Back up uniform records, stock, movements, student issuance, exchanges, staff accounts, activity, and linked store orders.</p><div class="pw-note pw-warning">Backups contain student information and staff password hashes. Store them privately. Recovery replaces the current inventory and linked store records and signs everyone out in this tab.</div><button class="pw-btn pw-primary" id="pwBackup">Download backup</button></section><section class="pw-card"><h2>Restore a backup</h2><form id="pwRestoreForm" class="pw-form">${field("restore", "Proware backup file", '<input id="pw-restore" type="file" accept=".json,application/json" required>')}${field("restoreConfirm", "Confirmation", '<input id="pw-restoreConfirm" required placeholder="Type RESTORE" pattern="RESTORE" autocomplete="off">')}<button class="pw-btn pw-danger" type="submit">Restore selected backup</button></form></section>`;
    $("pwBackup").onclick = handle(() => {
      requireStaff(true);
      activity("Downloaded backup");
      save();
      const payload = {
        format: "STI-PROWARE-BACKUP",
        schema: SCHEMA,
        exportedAt: now(),
        inventory: state,
        store: { products, orders, cart, saved, notifications, currentUser },
      };
      download(
        JSON.stringify(payload, null, 2),
        "proware-backup-" + today() + ".json",
        "application/json",
      );
      message("Backup downloaded.");
    });
    $("pwRestoreForm").onsubmit = handle(async (e) => {
      requireStaff(true);
      if (!e.target.reportValidity()) return;
      const file = $("pw-restore").files[0];
      if (!file || file.size > 30000000) throw Error("Choose a backup under 30 MB.");
      const b = JSON.parse(await file.text());
      validateBackup(b);
      if (!confirm("Replace current inventory and linked store records with this backup?"))
        return;
      requireStaff(true);
      const previous = copy({
        state,
        products,
        orders,
        cart,
        saved,
        notifications,
        currentUser,
      });
      try {
        state = b.inventory;
        state.revision = Math.max(state.revision, previous.state.revision) + 1;
        products = b.store.products;
        orders = b.store.orders;
        cart = b.store.cart;
        saved = b.store.saved;
        notifications = b.store.notifications;
        currentUser = null;
        activity("Restored backup", file.name, "Admin recovery");
        save();
        session = null;
        returnToOrder = null;
        render();
        message("Backup restored. Sign in with an account from the backup.");
        renderOrders();
      } catch (err) {
        ({ state, products, orders, cart, saved, notifications, currentUser } = previous);
        save();
        throw err;
      }
    });
  }
  function validateBackup(b) {
    const fail = () => {
      throw Error("This is not a valid Proware backup. No records were changed.");
    };
    if (
      !b ||
      b.format !== "STI-PROWARE-BACKUP" ||
      b.schema !== SCHEMA ||
      !b.inventory ||
      !b.store
    )
      fail();
    const s = b.inventory,
      t = b.store;
    if (s.schema !== SCHEMA || !integer(s.revision)) fail();
    for (const key of [
      "uniforms",
      "movements",
      "issues",
      "exchanges",
      "accounts",
      "activities",
    ])
      if (!Array.isArray(s[key])) fail();
    for (const key of ["products", "orders", "cart", "saved", "notifications"])
      if (!Array.isArray(t[key])) fail();
    const unique = (items, key) => new Set(items.map((x) => x[key])).size === items.length;
    const text = (x, max = 500) => typeof x === "string" && x.length <= max;
    const safeId = (x) => text(x) && /^[A-Za-z0-9._-]+$/.test(x);
    if (
      !unique(s.uniforms, "id") ||
      !unique(s.uniforms, "code") ||
      !unique(s.accounts, "id") ||
      !unique(s.accounts, "username") ||
      !unique(s.issues, "id") ||
      !unique(t.products, "id") ||
      !unique(t.orders, "id")
    )
      fail();
    for (const u of s.uniforms) {
      if (
        !safeId(u.id) ||
        !text(u.code) ||
        !text(u.name) ||
        !text(u.course) ||
        !types.includes(u.type) ||
        !Number.isFinite(u.price) ||
        u.price < 0 ||
        u.price > 1000000 ||
        !integer(u.threshold) ||
        !u.stock ||
        Array.isArray(u.stock) ||
        typeof u.stock !== "object" ||
        !Object.keys(u.stock).length ||
        Object.entries(u.stock).some(
          ([k, v]) =>
            !text(k, 16) ||
            (k !== "Unassigned" && !/^[A-Z0-9][A-Z0-9 ._-]{0,15}$/.test(k)) ||
            ["__proto__", "constructor", "prototype"].includes(k) ||
            !integer(v),
        )
      )
        fail();
    }
    for (const a of s.accounts)
      if (
        !text(a.id) ||
        !text(a.name) ||
        !text(a.username) ||
        !["Admin", "Inventory Staff"].includes(a.role) ||
        typeof a.active !== "boolean" ||
        !text(a.salt) ||
        typeof a.hash !== "string" ||
        !/^[a-f0-9]{64}$/.test(a.hash)
      )
        fail();
    if (!(s.accounts.length === 0 || s.accounts.some((a) => a.active && a.role === "Admin")))
      fail();
    const hasUniform = (id) => s.uniforms.some((u) => u.id === id);
    for (const i of s.issues)
      if (
        !text(i.id) ||
        !hasUniform(i.uniformId) ||
        !text(i.size, 16) ||
        !Object.hasOwn(s.uniforms.find((u) => u.id === i.uniformId).stock, i.size) ||
        !integer(i.qty) ||
        !i.qty ||
        !integer(i.returned) ||
        i.returned > i.qty ||
        [
          "studentNumber",
          "studentName",
          "course",
          "year",
          "code",
          "uniformName",
          "type",
          "date",
          "staff",
          "reference",
          "orderId",
        ].some((k) => !text(i[k]))
      )
        fail();
    for (const m of s.movements)
      if (
        !text(m.id) ||
        !hasUniform(m.uniformId) ||
        !integer(m.qty) ||
        !Number.isSafeInteger(m.delta) ||
        !integer(m.balance) ||
        ["at", "date", "code", "name", "size", "kind", "reason", "staff", "reference"].some(
          (k) => !text(m[k]),
        )
      )
        fail();
    for (const x of s.exchanges)
      if (
        !text(x.id) ||
        !hasUniform(x.uniformId) ||
        !s.issues.some((i) => i.id === x.issueId) ||
        !integer(x.qty) ||
        !["Resalable", "Damaged"].includes(x.condition) ||
        [
          "at",
          "issueId",
          "orderId",
          "code",
          "uniformName",
          "fromSize",
          "toSize",
          "reason",
          "staff",
        ].some((k) => !text(x[k]))
      )
        fail();
    for (const a of s.activities)
      if (["id", "at", "staff", "action", "details"].some((k) => !text(a[k], 1000))) fail();
    for (const p of t.products)
      if (
        !safeId(p.id) ||
        !text(p.name) ||
        !Number.isFinite(p.price) ||
        p.price < 0 ||
        !integer(p.stock) ||
        !Number.isFinite(p.rating) ||
        !Number.isFinite(p.reviews) ||
        !text(p.category) ||
        !text(p.seller) ||
        !text(p.location) ||
        !text(p.description, 5000) ||
        (p.emoji !== undefined && (!text(p.emoji, 30) || /[<>]/.test(p.emoji))) ||
        (p.sizes !== undefined &&
          (!Array.isArray(p.sizes) ||
            p.sizes.some((v) => !text(v, 16) || !/^[A-Z0-9][A-Z0-9 ._-]{0,15}$/.test(v)))) ||
        (p.image &&
          (!text(p.image, 10000000) ||
            !/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(
              p.image,
            )))
      )
        fail();
    for (const o of t.orders)
      if (
        !safeId(o.id) ||
        !text(o.recipient) ||
        !Number.isFinite(o.total) ||
        !Array.isArray(o.items) ||
        o.items.some(
          (i) =>
            !text(i.id) ||
            !text(i.name) ||
            !integer(i.qty) ||
            i.qty < 1 ||
            !Number.isFinite(i.price),
        )
      )
        fail();
    for (const c of t.cart)
      if (
        !text(c.id) ||
        !integer(c.qty) ||
        c.qty < 1 ||
        (c.size !== undefined && !text(c.size, 16))
      )
        fail();
    if (t.saved.some((id) => !text(id))) fail();
    for (const n of t.notifications)
      if (
        (n.icon !== undefined && (!text(n.icon, 30) || /[<>]/.test(n.icon))) ||
        !text(n.title) ||
        !text(n.message, 5000) ||
        !text(n.time) ||
        typeof n.read !== "boolean"
      )
        fail();
  }

  // Connect checkout reservations to size stock. Student actions never gain staff privileges.
  const basePlaceOrder = placeOrder;
  placeOrder = function (e) {
    if (cartLines().some(l => l.product.catalogPhoto && l.product.price <= 0)) {
      e.preventDefault();
      toast("A uniform price is awaiting confirmation by the store.");
      return;
    }
    const disk = JSON.parse(localStorage.getItem(KEY) || "null");
    if (disk && disk.revision !== state.revision) {
      state = disk;
      syncProducts();
    }
    const demand = new Map();
    for (const l of cartLines()) {
      const u = state.uniforms.find((u) => u.id === l.id);
      if (!u) continue;
      const key = JSON.stringify([u.id, l.size]);
      demand.set(key, (demand.get(key) || 0) + l.qty);
    }
    for (const [key, qty] of demand) {
      const [id, size] = JSON.parse(key),
        u = uniform(id);
      if (
        !size ||
        size === "Unassigned" ||
        !Object.hasOwn(u.stock, size) ||
        !integer(qty) ||
        qty < 1 ||
        qty > u.stock[size]
      ) {
        e.preventDefault();
        toast("Not enough stock for the selected uniform size. Choose an available size.");
        return;
      }
    }
    const previous = new Set(orders.map((o) => o.id));
    basePlaceOrder(e);
    const o = orders.find((o) => !previous.has(o.id));
    if (!o) return;
    for (const [key, qty] of demand) {
      const [id, size] = JSON.parse(key);
      movement(
        uniform(id),
        size,
        -qty,
        "Checkout reservation",
        "Awaiting payment and handover",
        o.id,
        qty,
        "Student checkout",
      );
    }
    o.prowareReserved = true;
    activity("Reserved checkout stock", o.id, "Student checkout");
    save();
  };
  const baseCancel = cashCancel;
  cashCancel = function () {
    const o = orders.find((o) => o.id === omSelected);
    if (!o || o.status !== "Pending" || o.paymentStatus === "Paid") return;
    const tracked = Boolean(o.prowareReserved);
    baseCancel();
    if (o.status === "Cancelled") {
      for (const i of o.items) {
        const u = state.uniforms.find((u) => u.id === i.id);
        if (u) {
          const size = tracked && Object.hasOwn(u.stock, i.size) ? i.size : "Unassigned";
          u.stock[size] ??= 0;
          movement(
            u,
            size,
            i.qty,
            "Cancelled reservation",
            "Unpaid order cancelled",
            o.id,
            i.qty,
            "Cashier",
          );
        }
      }
      o.prowareReserved = false;
      activity("Released cancelled reservation", o.id, "Cashier");
      save();
    }
  };
  const baseComplete = cashComplete;
  cashComplete = function () {
    const o = orders.find((o) => o.id === omSelected);
    if (!o || o.status !== "Paid" || o.paymentStatus !== "Paid") return;
    if (o.items.some((i) => state.uniforms.some((u) => u.id === i.id))) {
      returnToOrder = o.id;
      open("issues");
      message("Proware staff must confirm the uniform handover.");
      return;
    }
    baseComplete();
  };
  const baseAdd = addToCart;
  addToCart = function (id, qty = 1, size = "") {
    const u = state.uniforms.find((u) => u.id === id);
    if (products.find(p => p.id === id)?.catalogPhoto && (!u || u.price <= 0)) {
      toast("Price and stock must be confirmed by the store first.");
      return;
    }
    if (!u) {
      baseAdd(id, qty, size);
      return;
    }
    if (!size) {
      showProduct(id);
      return;
    }
    const existing = cart.find((c) => c.id === id && c.size === size)?.qty || 0;
    if (
      !Number.isSafeInteger(qty) ||
      qty < 1 ||
      !Object.hasOwn(u.stock, size) ||
      size === "Unassigned" ||
      qty + existing > u.stock[size]
    ) {
      toast("Choose an available size and quantity.");
      return;
    }
    baseAdd(id, qty, size);
  };
  const baseShow = showProduct;
  showProduct = function (id) {
    baseShow(id);
    const u = state.uniforms.find((u) => u.id === id);
    if (!u || !$("detailSize")) return;
    const size = $("detailSize");
    size.innerHTML = Object.keys(u.stock)
      .filter((s) => s !== "Unassigned")
      .map(
        (s) =>
          `<option value="${esc(s)}" ${u.stock[s] === 0 ? "disabled" : ""}>${esc(s)} · ${u.stock[s]} available</option>`,
      )
      .join("");
    const update = () => {
      const q = u.stock[size.value] || 0;
      $("detailQty").max = q;
      document.querySelector("#productDetails .primary").disabled = q < 1;
    };
    size.onchange = update;
    update();
  };
  // Prevent the legacy seller interface from bypassing inventory records.
  openSeller = function () {
    open(user()?.role === "Admin" ? "uniforms" : "overview");
  };
  const sellerButton = document.querySelector(".head-actions .navbtn");
  if (sellerButton) sellerButton.onclick = openSeller;
  const baseChangeQty = changeQty;
  changeQty = function (id, difference, size = "") {
    const u = state.uniforms.find((u) => u.id === id);
    if (!u) {
      baseChangeQty(id, difference, size);
      return;
    }
    const line = cart.find((c) => c.id === id && (c.size || "") === size);
    if (!line) return;
    const next = line.qty + difference;
    if (!Number.isSafeInteger(next) || next < 1 || next > (u.stock[size] || 0)) {
      toast("Available stock for this size: " + (u.stock[size] || 0));
      return;
    }
    line.qty = next;
    persist();
    updateHeader();
    renderCart();
  };
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      const incoming = JSON.parse(e.newValue);
      if (incoming?.schema !== SCHEMA) return;
      if (incoming.revision < state.revision) return;
      state = incoming;
      refreshInventoryDisplays();
      if (!app.hidden) {
        render();
        message("Inventory updated from another tab.");
      }
    } catch {}
  });
  window.addEventListener("focus", reloadLatestInventory);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reloadLatestInventory();
  });
  syncProducts();
  persist();
  renderProducts();
  function releaseReservation(o, actor) {
    if (o.prowareIssued) return;
    for (const i of o.items) {
      const u = state.uniforms.find((u) => u.id === i.id);
      if (!u) continue;
      const size =
        o.prowareReserved && Object.hasOwn(u.stock, i.size) ? i.size : "Unassigned";
      u.stock[size] ??= 0;
      movement(
        u,
        size,
        i.qty,
        "Released reservation",
        "Order cancelled / authorized refund",
        o.id,
        i.qty,
        actor,
      );
    }
    o.prowareReserved = false;
    activity("Released order reservation", o.id, actor);
    save();
  }
  function fullyReturned(orderId) {
    const roots = state.issues.filter((i) => i.orderId === orderId);
    if (!roots.length) return false;
    const ids = new Set(roots.map((i) => i.id));
    let previous = -1;
    while (previous !== ids.size) {
      previous = ids.size;
      for (const i of state.issues) if (ids.has(i.originalIssueId)) ids.add(i.id);
    }
    return state.issues.filter((i) => ids.has(i.id)).every((i) => i.returned === i.qty);
  }
  function fullAsLegacy(b) {
    return {
      format: "STI-PROWARE-BACKUP",
      schema: 1,
      inventory: b.inventory,
      store: b.store,
    };
  }
  function restoreFullBackup(b) {
    validateBackup(fullAsLegacy(b));
    state = copy(b.inventory);
    state.revision++;
    products = copy(b.store.products);
    orders = copy(b.store.orders);
    cart = copy(b.store.cart);
    saved = copy(b.store.saved);
    notifications = copy(b.store.notifications);
    currentUser = null;
    session = null;
    save();
    if (!app.hidden) render();
  }
  return {
    open,
    close,
    releaseReservation,
    fullyReturned,
    available: (id, size) => {
      const u = state.uniforms.find((u) => u.id === id);
      return u
        ? (u.stock[size] ?? "Unassigned")
        : (products.find((p) => p.id === id)?.stock ?? 0);
    },
    recordCashierCollection: (orderId, actor) => {
      const o = orders.find(o=>o.id===orderId);
      if (!o || o.status!=='Ready for Pickup' || o.paymentStatus!=='Paid' || !o.prowareReserved || state.issues.some(i=>i.orderId===orderId))
        throw Error('Choose a paid, reserved order that has not been collected.');
      const lines=o.items.map(i=>({i,u:state.uniforms.find(u=>u.id===i.id)}));
      if(lines.some(({i,u})=>!u||!Object.hasOwn(u.stock,i.size)))throw Error('Confirm all uniform sizes before release.');
      for(const {i,u} of lines){
        movement(u,i.size,0,'Paid order handover','Reserved at checkout',o.id,i.qty,actor);
        state.issues.unshift({id:uid('ISS'),at:now(),date:today(),studentNumber:o.studentNumber,studentName:o.recipient,course:o.course||'',year:o.yearLevel||'',uniformId:u.id,code:u.code,uniformName:u.name,type:u.type,size:i.size,qty:i.qty,returned:0,staff:actor,reference:o.id,orderId:o.id});
      }
      Object.assign(o,{status:'Claimed',prowareReserved:false,prowareIssued:true,issuedBy:actor,issuedAt:now()});
      activity('Handed over paid order',o.id,actor);
      save();
    },
    openHandover: (orderId) => {
      returnToOrder = orderId;
      open("issues");
    },
    backupSnapshot: () => copy(state),
    rollbackSnapshot: (snapshot) => {
      state = copy(snapshot);
    },
    validateFullBackup: (b) => validateBackup(fullAsLegacy(b)),
    restoreFullBackup,
  };
})();
