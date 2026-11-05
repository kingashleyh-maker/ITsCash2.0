import { s, db, actor, user, esc, button, link, field, select, form, submit, heading, empty, stat, table, cell, modal, act, filters, contactFields, image, go } from "../../shared/scripts/core.js";
import { assessment, statement, transactions, orders, notices } from "../../shared/scripts/workflows.js";
function render(target, page) {
  if (page === "store") return store(target);
  if (!user()) {
    target.innerHTML = heading("My Purchase") + empty("Sign in to view your orders.") + link("Sign in", "student", "login", "button primary");
    return;
  }
  if (page === "cart") return cart(target);
  if (page === "profile") return profile(target);
  if (page === "orders") return orders(target);
  if (page === "history") return transactions(target);
  if (page === "notices") return notices(target);
  const assessments = db().assessments.filter((a) => a.studentNumber === user().studentNumber);
  if (page === "tuition") {
    target.innerHTML = heading("Tuition Payments", "Your assessed fees, installment schedule, and remaining balance.") + (assessments.map(assessment).join("") || `<section class="card">${empty("No tuition assessment has been assigned yet. Contact the cashier.")}</section>`);
    return;
  }
  const list = db().orders.filter((o) => o.studentNumber === user().studentNumber), lines = db().carts[actor()] || [], total = lines.reduce((n, l) => n + (db().products.find((p) => p.id === l.productId)?.price || 0) * l.qty, 0);
  target.innerHTML = heading("Student Financial Dashboard", "Manage your school fees, installment balance, and uniform orders in one place.", button("↓ Statement of Account", statement) + link("＋ Quick Payment", "student", "tuition", "button primary")) + `<div class="stats">${stat("REMAINING TUITION", s.money(assessments.reduce((n, a) => n + s.dueFor(db(), "Tuition", a.id), 0)), assessments.length ? `${assessments.length} academic term(s)` : "No assessment assigned")}${stat("UNIFORM CART & ORDERS", s.money(total + list.filter((o) => o.status === "Awaiting Payment").reduce((n, o) => n + o.total, 0)), `${list.filter((o) => o.status === "Ready for Pickup").length} ready for pickup · ${lines.length} cart lines`)}${stat("TUITION PAID", s.money(assessments.reduce((n, a) => n + s.paidFor(db(), "Tuition", a.id), 0)), "Verified payments only")}</div><div class="dashboard-grid"><div><div class="section-head"><h2>Tuition Installment Plan</h2>${link("View all →", "student", "tuition")}</div>${assessments[0] ? assessment(assessments[0]) : `<section class="card">${empty("Your assigned tuition will appear here.")}</section>`}</div><section class="card"><div class="section-head"><div><h2>Campus Apparel & Uniforms</h2><p>Ready for your next campus day</p></div>${link("Uniform Store →", "student", "store")}</div><div class="dashboard-products">${db().products.slice(0, 2).map((p) => `<article><img src="${esc(image(p.image))}" alt="${esc(p.name)}"><h3>${esc(p.name)}</h3><p>Sizes: ${esc(p.sizes.join(", "))}</p><div class="line"><b>${s.money(p.price)}</b>${button("Choose size", () => product(p.id))}</div></article>`).join("")}</div><div class="cart-total"><div><small>Selected items (${lines.reduce((n, l) => n + l.qty, 0)})</small><strong>${s.money(total)}</strong></div>${link("View Cart", "student", "cart", "button primary")}</div></section></div>`;
}
function storeCartLink() {
  const lines = user()?.role === "Student" ? db().carts[actor()] || [] : [];
  const count = lines.reduce((total, line) => total + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + (db().products.find(product => product.id === line.productId)?.price || 0) * line.qty, 0);
  return `<a class="button primary store-cart-link" href="${new URL("../pages/cart.html", import.meta.url).href}" aria-label="Shopping cart, ${count} items"><span>Shopping Cart</span><span class="cart-count">${count}</span><span>${s.money(total)}</span></a>`;
}
function store(target) {
  let query = "", program = "All", category = "All", sort = "Featured", savedOnly = false;
  const draw = () => {
    const saved = db().saved[actor()] || [];
    const list = db().products.filter((p) => (!savedOnly || saved.includes(p.id)) && (program === "All" || p.programs?.includes(program)) && (category === "All" || p.category === category) && `${p.name} ${p.description} ${p.program}`.toLowerCase().includes(query.toLowerCase()));
    if (sort !== "Featured") list.sort((a, b) => sort === "Price: low to high" ? a.price - b.price : b.price - a.price);
    target.innerHTML = heading("Uniform Store", "Campus essentials, ready for your next campus day.", storeCartLink() + button(savedOnly ? "Show all uniforms" : "♡ Favorites", () => {
      savedOnly = !savedOnly;
      draw();
    })) + `<section class="store-hero"><div><span class="eyebrow">STI CAMPUS STORE</span><h2>Ready for your next campus day</h2><p>School uniforms and campus essentials, together in one place.</p><a href="#catalog" class="button">Shop campus essentials →</a></div><div class="hero-products">${db().products.slice(0, 3).map((p) => `<button type="button" ${onProduct(p.id)}><img src="${esc(image(p.image))}" alt="${esc(p.name)}"><span>${esc(p.name)}</span></button>`).join("")}</div></section><div class="store-body" id="catalog"><aside class="card catalog-sidebar"><h3>Uniforms by program</h3>${filters(select("Program", "program", ["All", "PE", "NSTP", "Tourism", "HM", "IT", "CPE"], program) + select("Category", "category", ["All", ...new Set(db().products.map((p) => p.category))], category), (d) => {
      program = d.program;
      category = d.category;
      draw();
    })}</aside><section>${filters(field("Search uniforms", "query", query, "search") + select("Sort products", "sort", ["Featured", "Price: low to high", "Price: high to low"], sort), (d) => {
      query = d.query;
      sort = d.sort;
      draw();
    })}<div class="section-head"><h2>${savedOnly ? "Your favorites" : "Campus essentials"}</h2><span class="muted">${list.length} products found</span></div><div class="product-grid">${list.map((p) => `<article class="product-card"><div class="product-photo"><button type="button" class="image-button" aria-label="View ${esc(p.name)}" ${onProduct(p.id)}><img src="${esc(image(p.image))}" alt="${esc(p.name)}"></button><span class="product-tag">${esc(p.program)}</span>${button(saved.includes(p.id) ? "♥" : "♡", async () => {
      if (!user()) return go("student", "login");
      await act(() => s.toggleSaved(actor(), p.id));
      draw();
    }, `heart ${saved.includes(p.id) ? "saved" : ""}`)}</div><div class="product-info"><h3>${esc(p.name)}</h3><small>STI Campus Store · ${esc(p.category)}</small><div class="product-bottom"><div><strong>${p.price > 0 ? s.money(p.price) : "Price pending"}</strong><small>${s.totalStock(p) > 0 ? `${s.totalStock(p)} total units` : "Awaiting stock"}</small></div>${button("＋", () => product(p.id), "primary")}</div></div></article>`).join("")}</div>${list.length ? "" : empty("No uniforms match your filters.")}</section></div>`;
  };
  draw();
}
import { on } from "../../shared/scripts/core.js";
const onProduct = (id) => on(() => product(id));
function product(id) {
  const p = db().products.find(p => p.id === id);
  if (!p) return;
  const initialSize = p.sizes.find(size => p.stock[size] > 0) || p.sizes[0];
  let d;
  d = modal('Product details', `<div class="product-detail"><img class="detail-photo" src="${esc(image(p.image))}" alt="${esc(p.name)}"><div><span class="eyebrow">${esc(p.program)} &middot; ${esc(p.category)}</span><h2>${esc(p.name)}</h2><strong class="detail-price">${p.price ? s.money(p.price) : 'Price pending'}</strong><p>${esc(p.description)}</p><p class="muted">${s.totalStock(p)} total units <span class="selected-stock"></span></p>${form(select('Size','size',p.sizes.map(size=>[size,`${size} - ${p.stock[size]||0} available`]),initialSize)+field('Quantity','qty',1,'number','required min="1" max="999" step="1"')+`<div class="actions">${submit('Add to cart')}${link('View Cart','student','cart','button')}${button('Save for later',async()=>{if(!user())return go('student','login');await act(()=>s.toggleSaved(actor(),p.id),'Saved products updated.');})}</div>`,async data=>{
    if(!user())return go('student','login');
    const existing=(db().carts[actor()]||[]).find(l=>l.productId===id&&l.size===data.size);
    const result=await act(()=>s.putCart(actor(),id,data.size,Number(data.qty)+(existing?.qty||0)),'Added to cart.');
    if(result.ok)d.close();
  })}${p.stock.Unassigned>0?'<p class="note">Opening stock includes unassigned sizes. Proware must allocate those units before they can be ordered.</p>':''}</div></div>`, {wide:true});
  const f=d.querySelector('form');
  const update=()=>{
    const size=f.elements.size.value,available=db().products.find(p=>p.id===id).stock[size]||0;
    const existing=(db().carts[actor()]||[]).find(l=>l.productId===id&&l.size===size)?.qty||0;
    f.elements.qty.max=Math.max(1,available-existing);
    f.querySelector('[type="submit"]').disabled=!available||!p.price||available<=existing;
    d.querySelector('.selected-stock').textContent=`- ${available} available in selected size`;
  };
  f.elements.size.addEventListener('change',()=>{f.elements.qty.value=1;update();});update();
}
function cart(target) {
  const lines=(db().carts[actor()]||[]).map(l=>({...l,product:db().products.find(p=>p.id===l.productId)})).filter(l=>l.product);
  const total=lines.reduce((n,l)=>n+l.product.price*l.qty,0);
  target.innerHTML=heading('Shopping Cart','Review your sizes and quantities before creating a checkout ticket.',link('Continue shopping','student','store','button'))+`<section class="card">${lines.length?`<div class="cart-items">${lines.map(l=>`<article class="cart-item"><img src="${esc(image(l.product.image))}" alt="${esc(l.product.name)}"><div><h3>${esc(l.product.name)}</h3><small>Size ${esc(l.size)} &middot; ${s.money(l.product.price)} each</small></div><label class="field"><span>Quantity</span><input aria-label="${esc(l.product.name)} quantity" type="number" value="${l.qty}" min="1" max="${l.product.stock[l.size]||0}" step="1" ${on(async e=>{if(!e.target.checkValidity()){e.target.reportValidity();return;}await act(()=>s.putCart(actor(),l.productId,l.size,Number(e.target.value)),'Cart updated.');},'change')}></label><b>${s.money(l.product.price*l.qty)}</b>${button('Remove',async()=>{await act(()=>s.putCart(actor(),l.productId,l.size,0));})}</article>`).join('')}</div><div class="cart-total"><div><small>Order total</small><strong>${s.money(total)}</strong></div>${button('Checkout ticket',()=>checkout(total),'primary')}</div>`:empty('Your cart is empty.')+link('Browse uniforms','student','store','button primary')}</section>`;
}
function checkout(total) {
  let d;
  d=modal('Confirm uniform order',`<p>Profile details are filled in below. You may edit your checkout contact details.</p>${form(`<div class="form-grid">${field('Student number','studentNumber',user().studentNumber,'text','readonly')}${contactFields(user())}</div>${select('Payment method','method',['Cash','GCash','Maya','Online bank'])}<div class="line"><b>Total</b><b>${s.money(total)}</b></div><p class="note">Your order reserves the selected stock. Complete digital payment through the simulated payment screen after placing the order.</p>${submit('Place order')}`,async data=>{
    if(!confirm(`Place this uniform order for ${s.money(total)}?`))return;
    const {method,studentNumber,...contact}=data;
    const result=await act(()=>s.placeOrder(actor(),contact,method),'Order placed. Your ticket is in the cashier queue.');
    if(result.ok){d.close();go('student','orders');}
  })}`);
}
function profile(target) {
  const u = user();
  let avatar = u.avatar || "";
  target.innerHTML = heading("My Profile", "Manage your account and checkout contact information.") + `<section class="card">${form(`<div class="profile-layout"><div class="form-grid">${field("Username", "username", u.username, "text", "readonly")}${field("Student number", "studentNumber", u.studentNumber, "text", "readonly")}${contactFields(u)}${select("Gender", "gender", ["Male", "Female", "Other", "Prefer not to say"], u.gender || "Prefer not to say")}${field("Date of birth", "dateOfBirth", u.dateOfBirth || "", "date", `max="${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}"`)}</div><div class="profile-photo"><div id="avatar-preview">${avatar ? `<img src="${esc(image(avatar))}" alt="Profile preview">` : `<span>${esc(u.name[0])}</span>`}</div><label class="field"><span>Select profile image</span><input type="file" accept="image/jpeg,image/png" ${on(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 1024 * 1024) throw Error("Choose a JPEG or PNG image up to 1 MB.");
    avatar = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(Error("Could not open image."));
      reader.readAsDataURL(file);
    });
    target.querySelector("#avatar-preview").innerHTML = `<img src="${esc(avatar)}" alt="Profile preview">`;
  }, "change")}></label><small>JPEG / PNG · Maximum 1 MB</small></div></div>${submit("Save profile")}`, async (data) => {
    if (confirm("Save your profile details?")) await act(() => s.updateProfile(actor(), { ...data, avatar }), "Profile saved.");
  })}</section>`;
}
export {
  product,
  render
};
