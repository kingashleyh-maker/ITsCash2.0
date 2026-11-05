import * as s from "./store.js";
const base = new URL("../../", import.meta.url);
const role = document.body.dataset.role;
const page = document.body.dataset.page;
const db = () => s.getState();
const actor = () => sessionStorage.getItem("itscash_vanilla_actor") || "";
const user = () => db().accounts.find((a) => a.id === actor() && a.active !== false);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const url = (r = "", p = "overview") => new URL(r ? `${r}/pages/${p}.html` : "index.html", base).href;
const go = (r, p) => {
  location.href = url(r, p);
};
const handlers = /* @__PURE__ */ new Map();
let sequence = 0;
function on(fn, event = "click") {
  const key = `event-${++sequence}`;
  handlers.set(key, fn);
  return `data-${event}="${key}"`;
}
function button(label, fn, cls = "") {
  return `<button type="button" class="${esc(cls)}" ${on(fn)}>${esc(label)}</button>`;
}
function link(label, r, p, cls = "") {
  return `<a class="${esc(cls)}" href="${url(r, p)}">${esc(label)}</a>`;
}
function field(label, name, value = "", type = "text", attrs = "") {
  return `<label class="field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
}
function select(label, name, options, value = "", attrs = "") {
  return `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}" ${attrs}>${options.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`;
  }).join("")}</select></label>`;
}
function form(content, fn, cls = "") {
  return `<form class="${cls}" ${on(async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = Object.fromEntries(new FormData(f));
    if (f.dataset.busy) return;
    f.dataset.busy = "1";
    const controls = [...f.querySelectorAll('button[type="submit"]')];
    controls.forEach((b) => b.disabled = true);
    try {
      await fn(data, f);
    } finally {
      delete f.dataset.busy;
      controls.forEach((b) => b.disabled = false);
    }
  }, "submit")}>${content}</form>`;
}
const submit = (label = "Save") => `<button class="primary" type="submit">${esc(label)}</button>`;
const heading = (title, subtitle = "", actions = "") => `<header class="page-heading"><div><span class="eyebrow">ITSCASH · CAMPUS PORTAL</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="actions">${actions}</div></header>`;
const empty = (text = "No records yet.") => `<div class="empty">${esc(text)}</div>`;
const stat = (label, value, detail = "") => `<article class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
const badge = (text) => `<span class="badge ${/Successful|Paid|Claimed|In Stock|Verified|Active/.test(text) ? "green" : /Failed|Cancelled|Refunded|Out of Stock|Disabled/.test(text) ? "red" : "amber"}">${esc(text)}</span>`;
const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>${rows.length ? "" : empty()}</div>`;
const cell = (...values) => `<tr>${values.map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`;
function toast(message, error = false) {
  const host = document.getElementById("toast-root");
  host.innerHTML = `<div class="toast ${error ? "error" : ""}" role="${error ? "alert" : "status"}"><span>${esc(message)}</span>${button("×", () => host.replaceChildren())}</div>`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => host.replaceChildren(), 6500);
}
let refresh = () => {
};
function setRefresh(fn) {
  refresh = fn;
}
async function act(fn, message = "") {
  try {
    const value = await fn();
    refresh();
    if (message) toast(message);
    return { ok: true, value };
  } catch (e) {
    toast(e.message || "The action could not be completed.", true);
    return { ok: false };
  }
}
function modal(title, content, { wide = false, printable = false } = {}) {
  const prior = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = `dialog ${wide ? "wide" : ""} ${printable ? "print-document" : ""}`;
  const id = `dialog-${++sequence}`;
  dialog.setAttribute("aria-labelledby", id);
  dialog.innerHTML = `<header class="dialog-head"><h2 id="${id}">${esc(title)}</h2>${button("×", () => dialog.close(), "no-print")}</header><div class="modal-content">${content}</div>`;
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    prior?.focus?.();
  });
  document.getElementById("modal-root").append(dialog);
  dialog.showModal();
  return dialog;
}
function filters(content, fn) {
  return form(`<div class="filters">${content}${submit("Apply filters")}</div>`, fn);
}
const contactFields = (u) => ["name", "email", "phone", "course", "year"].map((k) => field({ name: "Full name", email: "Email", phone: "Phone", course: "Course / program", year: "Year level" }[k], k, u?.[k] || "", k === "email" ? "email" : "text", "required")).join("");
const image = (path) => {
  if (!path) return "";
  if (path.includes("/assets/images/")) return new URL(`assets/images/${path.split("/").at(-1)}`, base).href;
  return /^(data:image\/(png|jpeg);base64,|https?:)/.test(path) ? path : "";
};
for (const type of ["click", "submit", "change", "input"]) document.addEventListener(type, async (e) => {
  const target = e.target.closest(`[data-${type}]`);
  if (!target) return;
  const fn = handlers.get(target.dataset[type]);
  if (fn) {
    try {
      await fn(e);
    } catch (error) {
      toast(error.message, true);
    }
  }
});
function guard() {
  const u = user();
  return !!u && (role === "student" ? u.role === "Student" : role === "cashier" ? ["Cashier", "Admin"].includes(u.role) : ["Proware", "Inventory Staff", "Admin"].includes(u.role));
}
export {
  act,
  actor,
  badge,
  base,
  button,
  cell,
  contactFields,
  db,
  empty,
  esc,
  field,
  filters,
  form,
  go,
  guard,
  heading,
  image,
  link,
  modal,
  on,
  page,
  role,
  s,
  select,
  setRefresh,
  stat,
  submit,
  table,
  toast,
  url,
  user
};
