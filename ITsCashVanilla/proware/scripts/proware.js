import { s, db, actor, esc, button, field, select, form, submit, heading, stat, badge, table, cell, modal, act, on, image } from "../../shared/scripts/core.js";
import { orders, accounts } from "../../shared/scripts/workflows.js";
// Status includes every size and any opening stock awaiting size allocation.
const status = (product) => {
  const quantity = s.totalStock(product);
  return quantity === 0 ? "Out of Stock" : quantity <= 30 ? "Low Stock" : "In Stock";
};
const inventoryFilters = { query: "", status: "All" };
function render(target, page) {
  if (page === "orders") return orders(target);
  if (page === "accounts") return accounts(target);
  if (page === "inventory") return inventory(target);
  overview(target);
}
function overview(target) {
  const products = db().products;
  const counts = label => products.filter(product => status(product) === label).length;
  target.innerHTML = heading("Proware Overview", "A summary of campus inventory and pickup activity.") +
    `<div class="stats four">${stat("UNIFORM LISTINGS", products.length)}${stat("TOTAL UNITS", products.reduce((sum, product) => sum + s.totalStock(product), 0))}${stat("LOW STOCK ITEMS", counts("Low Stock"), "1-30 units")}${stat("OUT OF STOCK", counts("Out of Stock"))}</div>
    <section class="card"><h2>Stock status summary</h2><div class="stats">${stat("IN STOCK", counts("In Stock"), "More than 30 units")}${stat("LOW STOCK", counts("Low Stock"), "1-30 units")}${stat("OUT OF STOCK", counts("Out of Stock"), "No units available")}</div><p class="note">Stock status includes all sizes and Unassigned units. Allocate Unassigned units to sizes before students can order them.</p></section>
    <section class="card"><h2>Pickup summary</h2><div class="stats">${stat("AWAITING PREPARATION", db().orders.filter(order => order.status === "Paid").length)}${stat("READY FOR PICKUP", db().orders.filter(order => order.status === "Ready for Pickup").length)}${stat("CLAIMED", db().orders.filter(order => order.status === "Claimed").length)}</div></section>`;
}
function inventory(target) {
  target.innerHTML = heading("Uniforms & Stock", "Search uniforms, filter stock status, and update size quantities and prices.") +
    `<section class="card"><div class="section-head"><h2>Campus uniform inventory</h2><span class="muted">Changes update the store and overview.</span></div>
    <div class="filters">${field("Search inventory", "query", inventoryFilters.query, "search", `placeholder="Uniform name, code, or program" ${on(event => { inventoryFilters.query = event.target.value; updateRows(); }, "input")}`)}${select("Stock status", "filter", ["All", "Low Stock", "Out of Stock", "In Stock"], inventoryFilters.status, on(event => { inventoryFilters.status = event.target.value; updateRows(); }, "change"))}</div>
    <p class="note">Out of Stock: 0 units. Low Stock: 1-30 units. In Stock: more than 30 units. Totals include Unassigned stock.</p>
    <p class="muted" id="inventory-result-count" role="status"></p><div id="inventory-results"></div></section>`;
  function updateRows() {
    const query = inventoryFilters.query.trim().toLowerCase();
    const rows = db().products.filter(product =>
      `${product.name} ${product.code} ${product.program}`.toLowerCase().includes(query) &&
      (inventoryFilters.status === "All" || status(product) === inventoryFilters.status));
    target.querySelector("#inventory-result-count").textContent = `${rows.length} of ${db().products.length} uniforms`;
    target.querySelector("#inventory-results").innerHTML = table(
      ["Uniform", "Program / category", "Size availability", "Total units", "Status", "Action"],
      rows.map(product => cell(
        `<div class="inventory-name"><img src="${esc(image(product.image))}" alt=""><span><b>${esc(product.name)}</b><small>${esc(product.code)}</small></span></div>`,
        `${esc(product.program)}<small>${esc(product.category)}</small>`,
        `<div class="size-chips">${Object.entries(product.stock).map(([size, quantity]) => `<span>${esc(size)}: ${quantity}</span>`).join("")}</div>`,
        s.totalStock(product), badge(status(product)), button("Edit stock & price", () => stockEditor(product.id)))));
  }
  updateRows();
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
