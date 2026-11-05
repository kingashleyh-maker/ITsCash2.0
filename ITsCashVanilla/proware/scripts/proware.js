import { s, db, actor, esc, button, field, select, form, submit, heading, stat, badge, table, cell, modal, act, filters, image } from "../../shared/scripts/core.js";
import { orders, accounts } from "../../shared/scripts/workflows.js";
const status = (p) => s.totalStock(p) === 0 ? "Out of Stock" : s.totalStock(p) <= 30 ? "Low Stock" : "In Stock";
function render(target, page) {
  if (page === "orders") return orders(target);
  if (page === "accounts") return accounts(target);
  let query = "", filter = "All";
  const draw = () => {
    const rows = db().products.filter((p) => `${p.name} ${p.code} ${p.program}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || status(p) === filter));
    target.innerHTML = heading(page === "inventory" ? "Uniforms & Stock" : "Proware Overview", "Manage size quantities, prices, and campus uniform availability.") + `<div class="stats four">${stat("UNIFORM LISTINGS", db().products.length)}${stat("TOTAL UNITS", db().products.reduce((n, p) => n + s.totalStock(p), 0))}${stat("LOW STOCK ITEMS", db().products.filter((p) => s.totalStock(p) > 0 && s.totalStock(p) <= 30).length, "1–30 units")}${stat("OUT OF STOCK", db().products.filter((p) => s.totalStock(p) === 0).length)}</div><section class="card"><div class="section-head"><h2>Campus uniform inventory</h2><span class="muted">Changes update the store and dashboard.</span></div>${filters(field("Search inventory", "query", query, "search") + select("Stock status", "filter", ["All", "Low Stock", "Out of Stock", "In Stock"], filter), (d) => {
      query = d.query;
      filter = d.filter;
      draw();
    })}${table(["Uniform", "Program / category", "Size availability", "Total units", "Status", "Action"], rows.map((p) => cell(`<div class="inventory-name"><img src="${esc(image(p.image))}" alt=""><span><b>${esc(p.name)}</b><small>${esc(p.code)}</small></span></div>`, `${esc(p.program)}<small>${esc(p.category)}</small>`, `<div class="size-chips">${Object.entries(p.stock).map(([size, qty]) => `<span>${esc(size)}: ${qty}</span>`).join("")}</div>`, s.totalStock(p), badge(status(p)), button("Edit stock & price", () => stockEditor(p.id)))))}</section>`;
  };
  draw();
}
function stockEditor(id) {
  const p = db().products.find((p2) => p2.id === id), revision = db().revision;
  let d;
  d = modal("Edit uniform stock & price", `<h3>${esc(p.name)}</h3><p class="note">Reserved order units have already been deducted. Allocate unassigned stock by reducing Unassigned and increasing the appropriate sizes.</p>${form(`<div class="form-grid">${[.../* @__PURE__ */ new Set([...p.sizes, "Unassigned"])].map((size) => field(`${size} quantity`, `stock-${size}`, p.stock[size] || 0, "number", 'min="0" max="1000000" step="1" required')).join("")}</div>${field("Price per item (₱)", "price", (p.price / 100).toFixed(2), "number", 'min="0" max="1000000" step="0.01" required')}<p>Total available units: <b id="stock-total">${s.totalStock(p)}</b></p>${submit("Save changes")}`, async (data) => {
    if (!confirm("Would you like to update the stock?")) return;
    const result = await act(() => {
      if (db().revision !== revision) throw Error("Records changed while editing. Close and reopen the stock editor.");
      const stock = Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith("stock-")).map(([key, value]) => [key.slice(6), value]));
      s.saveStock(actor(), id, stock, data.price);
    }, "Stock and price updated.");
    if (result.ok) d.close();
  })}`);
  d.addEventListener("input", () => {
    d.querySelector("#stock-total").textContent = [...d.querySelectorAll('input[name^="stock-"]')].reduce((n, input) => n + Number(input.value || 0), 0);
  });
}
export {
  render
};
