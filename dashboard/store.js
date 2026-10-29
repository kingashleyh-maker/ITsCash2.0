const UNIFORM_IMAGE =
       "../assets/images/4ba412ca235535.png";
     const money = (n) =>
       new Intl.NumberFormat("en-PH", {
         style: "currency",
         currency: "PHP",
         maximumFractionDigits: 2,
       }).format(n);
     const seedProducts = [
       {
         id: "uniform-gray-shirt",
         name: "Gray Polo Uniform",
         category: "Shirts",
         price: 720,
         stock: 12,
         rating: 4.9,
         reviews: 211,
         seller: "STI Campus Store",
         location: "Quezon City",
         description:
           "Gray school uniform shirt with dark collar and cuff details. Available in sizes S to XXL.",
         image:
           "../assets/images/432279836bfc2e.jpg",
         sizes: ["S", "M", "L", "XL", "XXL"],
         tag: "Campus uniform",
       },
       {
         id: "uniform-blue-tee",
         name: "Blue NSTP T-Shirt",
         category: "Shirts",
         price: 320,
         stock: 24,
         rating: 4.7,
         reviews: 176,
         seller: "NSTP Uniform Hub",
         location: "Taguig",
         description:
           "Blue school activity shirt with the NSTP logo, suited for campus programs and events.",
         image:
           "../assets/images/53ac38afbac037.jpg",
         sizes: ["S", "M", "L", "XL"],
         tag: "Student pick",
       },
       {
         id: "uniform-navy-pants",
         name: "Navy STI Track Pants",
         category: "Pants",
         price: 495,
         stock: 23,
         rating: 4.8,
         reviews: 124,
         seller: "STI Campus Store",
         location: "Taguig",
         description:
           "Comfortable navy track pants for PE and everyday campus wear. Available in sizes S to XXL.",
         image:
           "../assets/images/0a603c60df0d69.jpg",
         sizes: ["S", "M", "L", "XL", "XXL"],
         tag: "Campus pick",
       },
       {
         id: "uniform-black-pants",
         name: "Black Formal Pants",
         category: "Pants",
         price: 650,
         stock: 16,
         rating: 4.7,
         reviews: 89,
         seller: "Campus Basics PH",
         location: "Makati",
         description:
           "Clean-cut black uniform pants for presentations, school events, and formal requirements.",
         image:
           "../assets/images/e3c70b11cf6005.jpg",
         sizes: ["S", "M", "L", "XL"],
         tag: "Formal uniform",
       },
       {
         id: "earbuds",
         name: "Wireless Everyday Earbuds",
         category: "Electronics",
         price: 899,
         stock: 34,
         rating: 4.7,
         reviews: 128,
         seller: "Sound District",
         location: "Quezon City",
         description:
           "Compact wireless earbuds for commutes, study sessions, and everyday listening.",
         emoji: "🎧",
         tag: "Popular",
       },
       {
         id: "bottle",
         name: "Insulated Water Bottle",
         category: "Home",
         price: 349,
         stock: 51,
         rating: 4.6,
         reviews: 84,
         seller: "Daily Goods Co.",
         location: "Metro Manila",
         description: "A reusable bottle designed to keep your drink close throughout your day.",
         emoji: "🥤",
         tag: "Everyday essential",
       },
       {
         id: "tote",
         name: "Canvas Everyday Tote",
         category: "Fashion",
         price: 299,
         stock: 27,
         rating: 4.5,
         reviews: 67,
         seller: "Little Things PH",
         location: "Cebu",
         description: "A roomy canvas tote for errands, school supplies, and weekend plans.",
         emoji: "👜",
         tag: "Community fave",
       },
       {
         id: "desk-lamp",
         name: "Minimal Desk Lamp",
         category: "Home",
         price: 749,
         stock: 18,
         rating: 4.8,
         reviews: 53,
         seller: "Room & Root",
         location: "Davao",
         description: "A clean, simple desk lamp to brighten your reading or work corner.",
         emoji: "💡",
         tag: "Top rated",
       },
       {
         id: "skincare",
         name: "Daily Hydration Set",
         category: "Beauty",
         price: 599,
         stock: 20,
         rating: 4.6,
         reviews: 91,
         seller: "Glow Pantry",
         location: "Metro Manila",
         description: "A simple hydration-focused skincare set for your daily self-care routine.",
         emoji: "🧴",
         tag: "Self-care",
       },
       {
         id: "basketball",
         name: "Outdoor Basketball",
         category: "Sports",
         price: 680,
         stock: 15,
         rating: 4.7,
         reviews: 44,
         seller: "Playground Supply",
         location: "Quezon City",
         description: "A durable-feel basketball for casual games and practice sessions.",
         emoji: "🏀",
         tag: "Game on",
       },
       {
         id: "notebook",
         name: "Study Notes Notebook Set",
         category: "School",
         price: 189,
         stock: 75,
         rating: 4.8,
         reviews: 102,
         seller: "Campus Essentials",
         location: "Taguig",
         description: "A set of notebooks for class notes, plans, and your next big idea.",
         emoji: "📓",
         tag: "Student pick",
       },
       {
         id: "keyboard",
         name: "Compact Wireless Keyboard",
         category: "Electronics",
         price: 1299,
         stock: 11,
         rating: 4.5,
         reviews: 39,
         seller: "Desk Mode",
         location: "Cebu",
         description: "A compact wireless keyboard that helps keep your desk setup tidy.",
         emoji: "⌨️",
         tag: "Desk upgrade",
       },
       {
         id: "plant",
         name: "Easy-Care Desk Plant",
         category: "Home",
         price: 249,
         stock: 29,
         rating: 4.4,
         reviews: 28,
         seller: "Room & Root",
         location: "Davao",
         description: "A small green accent to bring a little life to your desk or shelf.",
         emoji: "🪴",
         tag: "Fresh pick",
       },
       {
         id: "backpack",
         name: "Campus Day Backpack",
         category: "School",
         price: 990,
         stock: 16,
         rating: 4.7,
         reviews: 73,
         seller: "Little Things PH",
         location: "Metro Manila",
         description: "A practical everyday backpack for school, work, and short trips.",
         emoji: "🎒",
         tag: "Student favorite",
       },
     ];
     let products = load("marketly_products", seedProducts);
     seedProducts
       .filter((p) => p.id.startsWith("uniform-"))
       .forEach((seed) => {
         const existing = products.find((p) => p.id === seed.id);
         if (existing) Object.assign(existing, seed, { stock: existing.stock ?? seed.stock });
         else products.unshift(seed);
       });
     let cart = load("marketly_cart", []);
     let saved = load("marketly_saved", []);
     let orders = load("marketly_orders", []);
     let notifications = load("marketly_notifications", [
       {
         id: 1,
         icon: "📦",
         title: "Welcome to Marketly",
         message: "Your shopping demo is ready. Explore products and try a sample checkout.",
         time: "Just now",
         read: false,
       },
       {
         id: 2,
         icon: "✨",
         title: "Find something you love",
         message: "Save products to keep your favorites handy.",
         time: "Just now",
         read: false,
       },
     ]);
     let currentUser = load("marketly_user", null);
     let authMode = "login",
       activeCategory = "All",
       currentProduct = null,
       toastTimer;
     function load(key, fallback) {
       try {
         const x = localStorage.getItem(key);
         return x ? JSON.parse(x) : JSON.parse(JSON.stringify(fallback));
       } catch (e) {
         return JSON.parse(JSON.stringify(fallback));
       }
     }
     function compactProducts() {
       return products.map(p => {
         const seed = seedProducts.find(x=>x.id===p.id);
         const photo = (window.campusPhotoCatalog || []).find(x=>x.id===p.id);
         const row = {...p};
         if (p.image && (p.image === seed?.image || p.image === photo?.image)) delete row.image;
         return row;
       });
     }
     function persist() {
       localStorage.setItem("marketly_products", JSON.stringify(compactProducts()));
       localStorage.setItem("marketly_cart", JSON.stringify(cart));
       localStorage.setItem("marketly_saved", JSON.stringify(saved));
       localStorage.setItem("marketly_orders", JSON.stringify(orders));
       localStorage.setItem("marketly_notifications", JSON.stringify(notifications));
       localStorage.setItem("marketly_user", JSON.stringify(currentUser));
     }
     function esc(s) {
       return String(s ?? "").replace(
         /[&<>"']/g,
         (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
       );
     }
     function toast(msg) {
       const t = document.getElementById("toast");
       t.textContent = msg;
       t.classList.add("show");
       clearTimeout(toastTimer);
       toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
     }
     function openModal(id) {
       document.getElementById(id).classList.add("show");
       document.body.style.overflow = "hidden";
     }
     function closeModal(id) {
       document.getElementById(id).classList.remove("show");
       if (!document.querySelector(".modal-backdrop.show")) document.body.style.overflow = "";
     }
     document.querySelectorAll(".modal-backdrop").forEach((b) =>
       b.addEventListener("click", (e) => {
         if (e.target === b) closeModal(b.id);
       }),
     );
     function updateHeader() {
       const cartCount = cart.reduce((s, x) => s + x.qty, 0),
         savedCount = saved.length,
         unreadCount = notifications.filter((n) => !n.read).length;
       document.getElementById("cartCount").textContent = cartCount;
       document.getElementById("notifCount").textContent = unreadCount;
       document.getElementById("uniformCartCount").textContent = cartCount;
       document.getElementById("uniformSavedCount").textContent = savedCount;
       document.getElementById("uniformNotifCount").textContent = unreadCount;
     }
     function productImage(p) {
       return p.image
         ? `<img src="${p.image}" alt="${esc(p.name)}">`
         : `<div class="placeholder" role="img" aria-label="${esc(p.name)}">${p.emoji || "📦"}</div>`;
     }
     function renderProducts() {
       const q = document.getElementById("searchInput").value.trim().toLowerCase();
       const catField = document.getElementById("categoryFilter");
       const minField = document.getElementById("minPrice");
       const maxField = document.getElementById("maxPrice");
       const ratingField = document.getElementById("ratingFilter");
       const locField = document.getElementById("locationFilter");
       const sortField = document.getElementById("sortFilter");
       const sizeField = document.getElementById("sizeFilter");
       const cat = catField ? catField.value : "All";
       const min = Number(minField ? minField.value : 0) || 0;
       const max = maxField && maxField.value !== "" ? Number(maxField.value) : Infinity;
       const rating = Number(ratingField ? ratingField.value : 0) || 0;
       const loc = locField ? locField.value : "All";
       const sort = sortField ? sortField.value : "featured";
       const size = sizeField ? sizeField.value : "";
       let list = products.filter(
         (p) =>
           ["Shirts", "Pants", "Uniforms"].includes(p.category) &&
           (activeCategory === "All" || p.category === activeCategory) &&
           (cat === "All" || p.category === cat) &&
           (!size || (p.sizes || []).includes(size)) &&
           (p.name + " " + p.description + " " + p.category + " " + p.seller)
             .toLowerCase()
             .includes(q) &&
           p.price >= min &&
           p.price <= max &&
           p.rating >= rating &&
           (loc === "All" || p.location === loc) &&
           (p.stock > 0 || p.catalogPhoto) &&
           (!window.activeUniformProgram || window.activeUniformProgram === "All" ||
             (p.programs || [p.program || (/\bNSTP\b/i.test(p.name) ? "NSTP" : /\bPE\b/i.test(p.name) ? "PE" : "")]).includes(window.activeUniformProgram)),
       );
       if (sort === "priceAsc") list.sort((a, b) => a.price - b.price);
       if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
       if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
       document.getElementById("resultCount").textContent =
         `${list.length} product${list.length === 1 ? "" : "s"} found`;
       document.getElementById("productHeading").textContent = q
         ? `Results for “${q}”`
         : activeCategory === "All"
           ? "Popular right now"
           : activeCategory + " finds";
       const grid = document.getElementById("productGrid");
       grid.innerHTML = list.length
         ? list
             .map(
               (p) => `<article class="product">
<div class="prod-image" onclick="showProduct('${p.id}')" role="button" tabindex="0" aria-label="View ${esc(p.name)}">${productImage(p)}<span class="tag">${esc(p.tag || p.category)}</span><button class="heart ${saved.includes(p.id) ? "saved" : ""}" onclick="event.stopPropagation();toggleSaved('${p.id}')" aria-label="Save ${esc(p.name)}">${saved.includes(p.id) ? "♥" : "♡"}</button></div>
<div class="prod-info"><p class="prod-title" title="${esc(p.name)}">${esc(p.name)}</p><p class="prod-desc">${esc(p.description)}</p><div class="rating">★ ${p.rating.toFixed(1)} <span>(${p.reviews} reviews)</span></div><div class="price-row"><div><div class="price">${p.catalogPhoto && p.price <= 0 ? "Price pending" : money(p.price)}</div><div class="stock">${p.stock > 0 ? p.stock + " in stock" : "Awaiting stock"}</div></div><button class="addbtn" onclick="showProduct('${p.id}')" aria-label="Choose options for ${esc(p.name)}">+</button></div><div class="sellerline">Sold by ${esc(p.seller)} · ${esc(p.location)}</div></div></article>`,
             )
             .join("")
         : '<div class="empty"><div style="font-size:36px">⌕</div><strong>No products found</strong><p>Try another keyword or adjust your filters.</p><button class="secondary" onclick="resetFilters()">Clear filters</button></div>';
     }
     function setCategory(cat) {
       const catField = document.getElementById("categoryFilter");
       if (catField) catField.value = cat;
       activeCategory = cat;
       document
         .querySelectorAll("[data-cat]")
         .forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
       renderProducts();
       document.getElementById("shop").scrollIntoView({ behavior: "smooth", block: "start" });
     }
     document
       .querySelectorAll("[data-cat]")
       .forEach((b) => b.addEventListener("click", () => setCategory(b.dataset.cat)));
     [
       "categoryFilter",
       "minPrice",
       "maxPrice",
       "ratingFilter",
       "locationFilter",
       "sortFilter",
       "sizeFilter",
     ].forEach((id) => {
       const field = document.getElementById(id);
       if (field)
         field.addEventListener("input", () => {
           if (id === "categoryFilter") activeCategory = "All";
           document
             .querySelectorAll("[data-cat]")
             .forEach((b) => b.classList.toggle("active", b.dataset.cat === activeCategory));
           renderProducts();
         });
     });
     document.getElementById("searchForm").addEventListener("submit", (e) => {
       e.preventDefault();
       renderProducts();
       document.getElementById("shop").scrollIntoView({ behavior: "smooth" });
     });
     function resetFilters() {
       document.getElementById("searchInput").value = "";
       ["minPrice", "maxPrice"].forEach((id) => {
         const field = document.getElementById(id);
         if (field) field.value = "";
       });
       ["categoryFilter", "ratingFilter", "locationFilter", "sortFilter", "sizeFilter"].forEach(
         (id) => {
           const field = document.getElementById(id);
           if (field) field.selectedIndex = 0;
         },
       );
       activeCategory = "All";
       document
         .querySelectorAll("[data-cat]")
         .forEach((b) => b.classList.toggle("active", b.dataset.cat === "All"));
       renderProducts();
     }
     function showProduct(id) {
       const p = products.find((x) => x.id === id);
       if (!p) return;
       currentProduct = p;
       document.getElementById("productDetails").innerHTML =
         `<div style="display:grid;grid-template-columns: minmax(0,1fr) minmax(0,1.1fr);gap:24px;align-items:start" class="detailgrid"><div style="border-radius:16px;overflow:hidden;background:#f2f3f8;min-height:250px;display:grid;place-items:center">${p.image ? `<img src="${p.image}" alt="${esc(p.name)}" style="width:100%;max-height:420px;object-fit:contain">` : `<div style="font-size:110px">${p.emoji || "📦"}</div>`}</div><div><span class="pill">${esc(p.category)}</span><h2 style="margin:12px 0 6px;font-size:27px;line-height:1.2">${esc(p.name)}</h2><div class="rating">★ ${p.rating.toFixed(1)} <span>(${p.reviews} customer reviews)</span></div><div style="font-size:28px;font-weight:850;margin:15px 0">${money(p.price)}</div><p class="muted">${esc(p.description)}</p><p class="small"><b>Stock:</b> ${p.stock} available</p><p class="small"><b>Seller:</b> ${esc(p.seller)} · ${esc(p.location)}</p><div class="field" style="max-width:180px;margin-top:16px"><label for="detailQty">Quantity</label><input type="number" id="detailQty" min="1" max="${p.stock}" value="1"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary" onclick="addToCart('${p.id}',Number(document.getElementById('detailQty').value));closeModal('productModal')">Add to cart</button><button class="secondary" onclick="toggleSaved('${p.id}')">${saved.includes(p.id) ? "♥ Saved" : "♡ Save for later"}</button></div></div></div>`;
       openModal("productModal");
     }
     function addToCart(id, qty = 1) {
       const p = products.find((x) => x.id === id);
       if (!p) return;
       qty = Math.max(1, Math.min(p.stock, Math.floor(qty) || 1));
       const found = cart.find((x) => x.id === id);
       if (found) found.qty = Math.min(p.stock, found.qty + qty);
       else cart.push({ id, qty });
       persist();
       updateHeader();
       toast("Added to your cart");
     }
     function toggleSaved(id) {
       if (saved.includes(id)) {
         saved = saved.filter((x) => x !== id);
         toast("Removed from saved items");
       } else {
         saved.push(id);
         toast("Saved for later");
       }
       persist();
       updateHeader();
       renderProducts();
       if (document.getElementById("savedModal").classList.contains("show")) renderSaved();
     }
     function openSaved() {
       renderSaved();
       openModal("savedModal");
     }
     function renderSaved() {
       const items = products.filter((p) => saved.includes(p.id));
       document.getElementById("savedContent").innerHTML = items.length
         ? items
             .map(
               (p) =>
                 `<div class="seller-row"><div><b>${esc(p.name)}</b><p>${money(p.price)} · ${p.stock} in stock</p></div><div style="display:flex;gap:6px"><button class="secondary" onclick="addToCart('${p.id}');renderSaved()">Add</button><button class="danger" onclick="toggleSaved('${p.id}')">Remove</button></div></div>`,
             )
             .join("")
         : '<div class="empty">No saved products yet. Tap ♡ on any item to save it.</div>';
     }
     function openCart() {
       renderCart();
       openModal("cartModal");
     }
     function cartLines() {
       return cart
         .map((c) => ({ ...c, product: products.find((p) => p.id === c.id) }))
         .filter((c) => c.product);
     }
     function cartSubtotal() {
       return cartLines().reduce((s, c) => s + c.product.price * c.qty, 0);
     }
     function renderCart() {
       const lines = cartLines(),
         sub = cartSubtotal();
       const el = document.getElementById("cartContent");
       if (!lines.length) {
         el.innerHTML = `<div class="empty"><div style="font-size:38px">🛒</div><strong>Your cart is waiting</strong><p>Add something you love and it will show up here.</p><button class="primary" onclick="closeModal('cartModal');document.getElementById('shop').scrollIntoView({behavior:'smooth'})">Continue shopping</button></div>`;
         return;
       }
       el.innerHTML = `<div class="cart-layout"><div class="cart-list">${lines.map((c) => `<div class="cart-item">${c.product.image ? `<img src="${c.product.image}" alt="">` : `<div style="width:65px;height:65px;border-radius:10px;background:#f2f3f8;display:grid;place-items:center;font-size:30px">${c.product.emoji || "📦"}</div>`}<div><h4>${esc(c.product.name)}</h4><p>${money(c.product.price)} each</p><div class="qty"><button onclick="changeQty('${c.id}',-1)" aria-label="Decrease quantity">−</button><b>${c.qty}</b><button onclick="changeQty('${c.id}',1)" aria-label="Increase quantity">+</button><button class="textbtn" onclick="removeCart('${c.id}')">Remove</button></div></div><b>${money(c.product.price * c.qty)}</b></div>`).join("")}</div><aside class="summary"><h4>Order summary</h4><div class="sumline"><span>Subtotal</span><b>${money(sub)}</b></div><div class="sumline"><span>Estimated shipping</span><b>${sub >= 1500 ? "FREE" : money(80)}</b></div><div class="sumline"><span>Discount</span><b>− ${money(0)}</b></div><div class="sumline total"><span>Total</span><span>${money(sub + (sub >= 1500 ? 0 : 80))}</span></div><button class="primary" onclick="startCheckout()">Continue to checkout →</button><p class="small muted">Shipping and payment are simulated in this demo.</p></aside></div>`;
     }
     function changeQty(id, d) {
       const c = cart.find((x) => x.id === id),
         p = products.find((x) => x.id === id);
       if (!c || !p) return;
       c.qty = Math.max(1, Math.min(p.stock, c.qty + d));
       persist();
       updateHeader();
       renderCart();
     }
     function removeCart(id) {
       cart = cart.filter((x) => x.id !== id);
       persist();
       updateHeader();
       renderCart();
       toast("Item removed");
     }
     function startCheckout() {
       if (!cartLines().length) return;
       renderCheckout();
       closeModal("cartModal");
       openModal("checkoutModal");
     }
     function renderCheckout() {
       const sub = cartSubtotal();
       document.getElementById("checkoutContent").innerHTML =
         `<form id="checkoutForm"><div class="cart-layout"><div><h4 style="margin-top:0">Delivery details</h4><div class="field"><label for="shipName">Recipient name</label><input id="shipName" required value="${esc(currentUser?.name || "")}"></div><div class="field"><label for="shipPhone">Mobile number</label><input id="shipPhone" required type="tel" placeholder="09XX XXX XXXX" pattern="[0-9+() -]{7,20}"></div><div class="field"><label for="shipAddress">Delivery address</label><textarea id="shipAddress" required placeholder="House number, street, barangay, city"></textarea></div><div class="formgrid"><div class="field"><label for="shipMethod">Delivery option</label><select id="shipMethod"><option value="Standard delivery">Standard delivery · ₱80</option><option value="Express delivery">Express delivery · ₱150</option><option value="Seller pickup">Seller pickup · Free</option></select></div><div class="field"><label for="paymentMethod">Payment method</label><select id="paymentMethod"><option>Cash on Delivery</option><option>GCash (demo)</option><option>Maya (demo)</option><option>Credit / Debit card (demo)</option><option>Bank transfer (demo)</option></select></div></div><p class="small muted">Never enter real card details here. Payment choices are illustrative only; no payment is collected.</p></div><aside class="summary"><h4>Review order</h4>${cartLines()
           .map(
             (c) =>
               `<div class="sumline"><span>${esc(c.product.name)} × ${c.qty}</span><b>${money(c.product.price * c.qty)}</b></div>`,
           )
           .join(
             "",
           )}<div class="sumline"><span>Subtotal</span><b>${money(sub)}</b></div><div class="sumline"><span>Shipping</span><b id="shippingCost">${money(sub >= 1500 ? 0 : 80)}</b></div><div class="sumline total"><span>Total</span><span id="checkoutTotal">${money(sub + (sub >= 1500 ? 0 : 80))}</span></div><button class="primary" type="submit">Place order · ${money(sub + (sub >= 1500 ? 0 : 80))}</button></aside></div></form>`;
       document.getElementById("shipMethod").addEventListener("change", updateCheckoutTotal);
       document.getElementById("checkoutForm").addEventListener("submit", placeOrder);
     }
     function shippingFee() {
       return 0;
     }
     function updateCheckoutTotal() {
       const total = cartSubtotal();
       document.getElementById("checkoutTotal").textContent = money(total);
       document.querySelector("#checkoutForm .summary .primary").textContent =
         "Place order · " + money(total);
     }
     function barcodeHTML(seed) {
       let x = 0;
       for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
       let bars = "";
       for (let i = 0; i < 65; i++) {
         x = (x * 1664525 + 1013904223) >>> 0;
         const w = (x % 3) + 1;
         bars += `<span style="width:${w}px;opacity:${x % 7 === 0 ? 0.45 : 1}"></span>`;
       }
       return `<div class="barcode" aria-label="Order barcode">${bars}</div>`;
     }
     function placeOrder(e) {
       e.preventDefault();
       const lines = cartLines();
       if (!lines.length) return;
       for (const c of lines) {
         if (!Number.isSafeInteger(c.qty) || c.qty < 1 || c.qty > c.product.stock) {
           toast("Some items no longer have enough stock");
           return;
         }
       }
       const id = "MK-" + crypto.randomUUID(),
         fee = shippingFee(),
         subtotal = cartSubtotal(),
         order = {
           id,
           created: new Date().toLocaleString("en-PH"),
           items: lines.map((c) => ({
             id: c.id,
             name: c.product.name,
             price: c.product.price,
             qty: c.qty,
             image: c.product.image || null,
             emoji: c.product.emoji || "📦",
             seller: c.product.seller,
           })),
           subtotal,
           shipping: fee,
           total: subtotal + fee,
           status: "Order placed",
           payment: document.getElementById("paymentMethod").value,
           delivery: document.getElementById("shipMethod").value,
           recipient: document.getElementById("shipName").value,
           address: document.getElementById("shipAddress").value,
           phone: document.getElementById("shipPhone").value,
           customer: currentUser?.email || "",
         };
       lines.forEach((c) => {
         const p = products.find((p) => p.id === c.id);
         p.stock -= c.qty;
       });
       orders.unshift(order);
       cart = [];
       notifications.unshift({
         id: Date.now(),
         icon: "📦",
         title: "Order placed successfully",
         message: `Order ${id} has been created. Keep your order code for tracking.`,
         time: "Just now",
         read: false,
       });
       persist();
       updateHeader();
       closeModal("checkoutModal");
       document.getElementById("successContent").innerHTML =
         `<div style="text-align:center"><div style="font-size:48px">🎉</div><h2 style="margin:8px 0">Thanks for your order!</h2><p class="muted">Your order has been recorded in this browser demo.</p><div class="order-card" style="text-align:left"><div class="small muted">YOUR ORDER NUMBER</div><div class="order-code">${id}</div>${barcodeHTML(id)}<div class="small muted" style="text-align:center">Show this code when checking your order.</div><div class="sumline total"><span>Order total</span><span>${money(order.total)}</span></div><p class="small"><b>Payment:</b> ${esc(order.payment)}</p><p class="small"><b>Delivery:</b> ${esc(order.delivery)}</p></div><button class="primary" onclick="closeModal('orderSuccessModal');openOrders()">View my orders</button> <button class="secondary" onclick="closeModal('orderSuccessModal')">Continue shopping</button></div>`;
       openModal("orderSuccessModal");
       renderProducts();
     }
     function openOrders() {
       renderOrders();
       openModal("ordersModal");
     }
     function renderOrders() {
       const el = document.getElementById("ordersContent");
       if (!orders.length) {
         el.innerHTML =
           '<div class="empty">You have no orders yet. Your purchases will appear here.</div>';
         return;
       }
       el.innerHTML = orders
         .map(
           (o) =>
             `<div class="order-card"><div class="order-top"><div><b>Order ${esc(o.id)}</b><div class="small muted">${esc(o.created)}</div></div><span class="status">${esc(o.status)}</span></div><div class="order-items">${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(" · ")}</div><div class="order-bottom"><div><b>${money(o.total)}</b><div class="small muted">${esc(o.payment)} · ${esc(o.delivery)}</div></div><button class="secondary" onclick="showOrderCode('${o.id}')">View code</button></div><details style="margin-top:12px"><summary class="small" style="cursor:pointer;color:var(--brand)">Order details</summary><p class="small muted">Deliver to: ${esc(o.recipient)} · ${esc(o.address)}<br>Phone: ${esc(o.phone)}</p></details></div>`,
         )
         .join("");
     }
     function showOrderCode(id) {
       const o = orders.find((x) => x.id === id);
       if (!o) return;
       document.getElementById("successContent").innerHTML =
         `<div style="text-align:center"><p class="muted">Order number</p><div class="order-code">${esc(o.id)}</div>${barcodeHTML(o.id)}<p class="small muted">Order total: ${money(o.total)}</p><button class="primary" onclick="closeModal('orderSuccessModal')">Done</button></div>`;
       openModal("orderSuccessModal");
     }
     function openNotifications() {
       notifications.forEach((n) => (n.read = true));
       persist();
       updateHeader();
       document.getElementById("notificationsContent").innerHTML = notifications.length
         ? notifications
             .map(
               (n) =>
                 `<div class="notification"><div class="nicon">${n.icon}</div><div><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small class="muted">${esc(n.time)}</small></div></div>`,
             )
             .join("")
         : '<div class="empty">No notifications yet.</div>';
       openModal("notificationsModal");
     }
     function openAccount() {
       if (currentUser) {
         const yes = confirm(
           `Logged in as ${currentUser.name} (${currentUser.email}).\n\nOK = view orders\nCancel = log out`,
         );
         if (yes) openOrders();
         else {
           currentUser = null;
           persist();
           updateHeader();
           toast("You have logged out");
         }
       } else {
         setAuthMode("login");
         openModal("authModal");
       }
     }
     function setAuthMode(mode) {
       authMode = mode;
       document.getElementById("authTitle").textContent =
         mode === "login" ? "Welcome back" : "Create your account";
       document.getElementById("authSubmit").textContent =
         mode === "login" ? "Log in" : "Create account";
       document.getElementById("nameField").style.display = mode === "register" ? "flex" : "none";
       document.getElementById("authName").required = mode === "register";
       document.getElementById("loginTab").classList.toggle("active", mode === "login");
       document.getElementById("registerTab").classList.toggle("active", mode === "register");
     }
     document.getElementById("authForm").addEventListener("submit", (e) => {
       e.preventDefault();
       const email = document.getElementById("authEmail").value.trim(),
         password = document.getElementById("authPassword").value;
       if (password.length < 4) return;
       const name =
         authMode === "register"
           ? document.getElementById("authName").value.trim()
           : email.split("@")[0] || "Shopper";
       if (authMode === "register" && !name) {
         toast("Please enter your name");
         return;
       }
       currentUser = { name, email, role: "customer" };
       persist();
       updateHeader();
       closeModal("authModal");
       toast(authMode === "login" ? "Welcome back!" : "Account created for this demo");
     });
     function openSeller() {
       renderSeller();
       openModal("sellerModal");
     }
     function renderSeller() {
       const myProducts = products.filter(
         (p) => p.seller === "My Store" || (currentUser && p.seller === currentUser.name),
       );
       const myOrders = orders.filter((o) =>
         o.items.some((i) => myProducts.some((p) => p.id === i.id)),
       );
       const sales = myOrders.reduce((s, o) => s + o.total, 0);
       document.getElementById("sellerContent").innerHTML =
         `<div class="tabs"><button class="active" id="sellerTabProducts" onclick="sellerTab('products')">My products</button><button id="sellerTabOrders" onclick="sellerTab('orders')">Customer orders</button></div><div id="sellerPanel"><div class="seller-stats"><div class="stat"><small>Products listed</small><strong>${myProducts.length}</strong></div><div class="stat"><small>Orders</small><strong>${myOrders.length}</strong></div><div class="stat"><small>Sales total</small><strong>${money(sales)}</strong></div></div><button class="primary" onclick="sellerTab('add')">＋ Add a product</button><div style="margin-top:15px">${myProducts.length ? myProducts.map((p) => `<div class="seller-row"><div><b>${esc(p.name)}</b><p>${money(p.price)} · ${p.stock} in stock · ${esc(p.category)}</p></div><button class="secondary" onclick="editProduct('${p.id}')">Edit</button></div>`).join("") : '<p class="muted">No seller listings yet. Add a product to start your demo store.</p>'}</div></div>`;
     }
     function sellerTab(tab) {
       document
         .getElementById("sellerTabProducts")
         ?.classList.toggle("active", tab === "products");
       document.getElementById("sellerTabOrders")?.classList.toggle("active", tab === "orders");
       const panel = document.getElementById("sellerPanel");
       if (tab === "add") {
         panel.innerHTML = productForm();
         return;
       }
       if (tab === "orders") {
         const list = orders.filter((o) =>
           o.items.some((i) => {
             const p = products.find((p) => p.id === i.id);
             return p && p.seller === "My Store";
           }),
         );
         panel.innerHTML = list.length
           ? list
               .map(
                 (o) =>
                   `<div class="order-card"><b>${esc(o.id)}</b><p class="small muted">${esc(o.items.map((i) => i.name + " × " + i.qty).join(", "))}</p><div class="order-bottom"><b>${money(o.total)}</b><select onchange="updateOrderStatus('${o.id}',this.value)"><option ${o.status === "Order placed" ? "selected" : ""}>Order placed</option><option ${o.status === "Processing" ? "selected" : ""}>Processing</option><option ${o.status === "Shipped" ? "selected" : ""}>Shipped</option><option ${o.status === "Delivered" ? "selected" : ""}>Delivered</option></select></div></div>`,
               )
               .join("")
           : '<p class="muted">Customer orders for your listings will appear here.</p>';
         return;
       }
       renderSeller();
     }
     function productForm(p = null) {
       return `<h4>${p ? "Edit product" : "Add a product"}</h4><form id="sellerProductForm"><div class="formgrid"><div class="field"><label>Product name</label><input name="name" required value="${esc(p?.name || "")}"></div><div class="field"><label>Category</label><select name="category">${["Fashion", "Electronics", "Home", "Beauty", "Sports", "School"].map((c) => `<option ${p?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div><div class="field"><label>Price (₱)</label><input name="price" type="number" min="1" required value="${p?.price || ""}"></div><div class="field"><label>Stock quantity</label><input name="stock" type="number" min="0" required value="${p?.stock ?? ""}"></div><div class="field"><label>Seller / store name</label><input name="seller" required value="${esc(p?.seller || currentUser?.name || "My Store")}"></div><div class="field"><label>Location</label><select name="location">${["Metro Manila", "Quezon City", "Cebu", "Davao", "Taguig"].map((c) => `<option ${p?.location === c ? "selected" : ""}>${c}</option>`).join("")}</select></div></div><div class="field"><label>Description</label><textarea name="description" required>${esc(p?.description || "")}</textarea></div><div class="field"><label>Image URL (optional)</label><input name="imageUrl" type="url" placeholder="https://..." value="${esc(p?.image && !p.image.startsWith("data:") ? p.image : "")}"><small class="muted">Leave blank to use a simple category icon. The attached uniform image is already included in the catalog.</small></div><div class="modal-actions"><button type="button" class="secondary" onclick="renderSeller()">Cancel</button><button class="primary" type="submit">${p ? "Save changes" : "Publish product"}</button></div></form>`;
     }
     function editProduct(id) {
       const p = products.find((p) => p.id === id);
       if (!p) return;
       document.getElementById("sellerPanel").innerHTML = productForm(p);
       document.getElementById("sellerProductForm").addEventListener("submit", (e) => {
         e.preventDefault();
         const f = new FormData(e.target);
         Object.assign(p, {
           name: f.get("name"),
           category: f.get("category"),
           price: Number(f.get("price")),
           stock: Number(f.get("stock")),
           seller: f.get("seller"),
           location: f.get("location"),
           description: f.get("description"),
           image: f.get("imageUrl") || p.image,
           tag: "Seller listing",
         });
         persist();
         renderProducts();
         renderSeller();
         toast("Product updated");
       });
     }
     document.getElementById("sellerContent").addEventListener("submit", (e) => {
       if (e.target.id !== "sellerProductForm") return;
       e.preventDefault();
       const f = new FormData(e.target),
         p = {
           id: "user-" + Date.now(),
           name: f.get("name"),
           category: f.get("category"),
           price: Number(f.get("price")),
           stock: Number(f.get("stock")),
           seller: f.get("seller"),
           location: f.get("location"),
           description: f.get("description"),
           image: f.get("imageUrl") || null,
           emoji: "📦",
           rating: 5,
           reviews: 0,
           tag: "New listing",
         };
       products.unshift(p);
       persist();
       renderProducts();
       renderSeller();
       toast("Your product is now listed");
     });
     function updateOrderStatus(id, status) {
       const o = orders.find((o) => o.id === id);
       if (!o) return;
       o.status = status;
       notifications.unshift({
         id: Date.now(),
         icon: "🚚",
         title: "Order status updated",
         message: `Order ${id} is now: ${status}.`,
         time: "Just now",
         read: false,
       });
       persist();
       updateHeader();
       toast("Order status updated");
     }
     const showUniformProductDetails = showProduct;
     showProduct = function (id) {
       const product = products.find((item) => item.id === id);
       if (!product) return;
       showUniformProductDetails(id);
       if (!product.sizes?.length) return;
       const quantityField = document.getElementById("detailQty").closest(".field");
       quantityField.insertAdjacentHTML(
         "afterend",
         `<div class="field" style="max-width:180px;margin-top:12px"><label for="detailSize">Size</label><select id="detailSize">${product.sizes.map((size) => `<option value="${esc(size)}">${esc(size)}</option>`).join("")}</select></div>`,
       );
       document.querySelector("#productDetails .primary").onclick = () => {
         addToCart(
           id,
           Number(document.getElementById("detailQty").value),
           document.getElementById("detailSize").value,
         );
         closeModal("productModal");
       };
     };
     addToCart = function (id, quantity = 1, size = "") {
       const product = products.find((item) => item.id === id);
       if (!product) return;
       if (!Number.isSafeInteger(quantity) || quantity < 1 || product.stock < 1) {
         toast("Choose an available quantity.");
         return;
       }
       quantity = Math.min(product.stock, quantity);
       const line = cart.find((item) => item.id === id && (item.size || "") === size);
       if (line) line.qty = Math.min(product.stock, line.qty + quantity);
       else cart.push({ id, qty: quantity, size });
       persist();
       updateHeader();
       toast("Added to your cart");
     };
     cartLines = function () {
       return cart
         .map((line) => {
           const product = products.find((item) => item.id === line.id);
           return product
             ? {
                 ...line,
                 product: {
                   ...product,
                   name: line.size ? `${product.name} · Size ${line.size}` : product.name,
                 },
               }
             : null;
         })
         .filter(Boolean);
     };
     renderCart = function () {
       const lines = cartLines(),
         subtotal = cartSubtotal(),
         element = document.getElementById("cartContent");
       if (!lines.length) {
         element.innerHTML =
           '<div class="empty"><div style="font-size:38px">🛒</div><strong>Your uniform cart is empty</strong><p>Add a uniform to get started.</p></div>';
         return;
       }
       element.innerHTML = `<div class="cart-layout"><div class="cart-list">${lines.map((line) => `<div class="cart-item">${line.product.image ? `<img src="${line.product.image}" alt="">` : `<div style="width:65px;height:65px;border-radius:10px;background:#f2f3f8;display:grid;place-items:center;font-size:30px">${line.product.emoji || "📦"}</div>`}<div><h4>${esc(line.product.name)}</h4><p>${money(line.product.price)} each</p><div class="qty"><button onclick="changeQty('${line.id}',-1,'${esc(line.size || "")}')" aria-label="Decrease quantity">−</button><b>${line.qty}</b><button onclick="changeQty('${line.id}',1,'${esc(line.size || "")}')" aria-label="Increase quantity">+</button><button class="textbtn" onclick="removeCart('${line.id}','${esc(line.size || "")}')">Remove</button></div></div><b>${money(line.product.price * line.qty)}</b></div>`).join("")}</div><aside class="summary"><h4>Order summary</h4><div class="sumline"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="sumline"><span>Estimated shipping</span><b>${subtotal >= 1500 ? "FREE" : money(80)}</b></div><div class="sumline total"><span>Total</span><span>${money(subtotal + (subtotal >= 1500 ? 0 : 80))}</span></div><button class="primary" onclick="startCheckout()">Continue to checkout →</button><p class="small muted">Payment options are simulated in this demo.</p></aside></div>`;
     };
     changeQty = function (id, difference, size = "") {
       const line = cart.find((item) => item.id === id && (item.size || "") === size),
         product = products.find((item) => item.id === id);
       if (!line || !product) return;
       line.qty = Math.max(1, Math.min(product.stock, line.qty + difference));
       persist();
       updateHeader();
       renderCart();
     };
     removeCart = function (id, size = "") {
       cart = cart.filter((item) => item.id !== id || (item.size || "") !== size);
       persist();
       updateHeader();
       renderCart();
       toast("Item removed");
     };
     renderSaved = function () {
       const items = products.filter(
         (product) =>
           saved.includes(product.id) &&
           ["Shirts", "Pants", "Uniforms"].includes(product.category),
       );
       document.getElementById("savedContent").innerHTML = items.length
         ? items
             .map(
               (product) =>
                 `<div class="seller-row"><div><b>${esc(product.name)}</b><p>${money(product.price)} · ${product.stock} in stock</p></div><div style="display:flex;gap:6px"><button class="secondary" onclick="showProduct('${product.id}')">Choose size</button><button class="danger" onclick="toggleSaved('${product.id}')">Remove</button></div></div>`,
             )
             .join("")
         : '<div class="empty">No saved uniforms yet. Tap ♡ on a product to save it.</div>';
     };
     renderOrders = function () {
       const uniformIds = new Set(
         products
           .filter((product) => ["Shirts", "Pants", "Uniforms"].includes(product.category))
           .map((product) => product.id),
       );
       const uniformOrders = orders.filter((order) =>
           order.items.some((item) => uniformIds.has(item.id)),
         ),
         element = document.getElementById("ordersContent");
       if (!uniformOrders.length) {
         element.innerHTML = '<div class="empty">Your uniform orders will appear here.</div>';
         return;
       }
       element.innerHTML = uniformOrders
         .map(
           (order) =>
             `<div class="order-card"><div class="order-top"><div><b>Order ${esc(order.id)}</b><div class="small muted">${esc(order.created)}</div></div><span class="status">${esc(order.status)}</span></div><div class="order-items">${order.items
               .filter((item) => uniformIds.has(item.id))
               .map((item) => `${esc(item.name)} × ${item.qty}`)
               .join(
                 " · ",
               )}</div><div class="order-bottom"><div><b>${money(order.total)}</b><div class="small muted">${esc(order.payment)}</div></div><button class="secondary" onclick="showOrderCode('${order.id}')">View code</button></div></div>`,
         )
         .join("");
     };
     const baseUniformProductForm = productForm;
     productForm = function (product = null) {
       const categories = ["Uniforms", "Shirts", "Pants"];
       const locations = [
         "Taguig",
         "Quezon City",
         "Makati",
         "Manila",
         "Metro Manila",
         "Cebu",
         "Davao",
       ];
       let form = baseUniformProductForm(product);
       form = form.replace(
         /<select name="category">[\s\S]*?<\/select>/,
         `<select name="category">${categories.map((category) => `<option ${product?.category === category ? "selected" : ""}>${category}</option>`).join("")}</select>`,
       );
       form = form.replace(
         /<select name="location">[\s\S]*?<\/select>/,
         `<select name="location">${locations.map((location) => `<option ${product?.location === location ? "selected" : ""}>${location}</option>`).join("")}</select>`,
       );
       form = form.replace(
         '<form id="sellerProductForm">',
         `<form id="sellerProductForm"><input type="hidden" name="productId" value="${esc(product?.id || "")}">`,
       );
       form = form.replace(
         '<div class="field"><label>Description</label>',
         `<div class="field"><label>Sizes (comma-separated)</label><input name="sizes" value="${esc(product?.sizes?.join(", ") || "S, M, L, XL")}"></div><div class="field"><label>Description</label>`,
       );
       return form;
     };
     document.getElementById("sellerContent").addEventListener("submit", (event) => {
       if (event.target.id !== "sellerProductForm") return;
       const values = new FormData(event.target),
         product =
           products.find((item) => item.id === values.get("productId")) ||
           products.find(
             (item) =>
               item.id.startsWith("user-") &&
               item.name === values.get("name") &&
               item.seller === values.get("seller"),
           );
       if (!product) return;
       const sizes = String(values.get("sizes") || "")
         .split(",")
         .map((size) => size.trim())
         .filter(Boolean);
       if (sizes.length) product.sizes = sizes;
       else delete product.sizes;
       persist();
       renderProducts();
     });
     renderSeller = function () {
       const ownProducts = products.filter(
         (product) =>
           ["Shirts", "Pants", "Uniforms"].includes(product.category) &&
           (product.seller === "My Store" || (currentUser && product.seller === currentUser.name)),
       );
       const ownIds = new Set(ownProducts.map((product) => product.id)),
         ownOrders = orders.filter((order) => order.items.some((item) => ownIds.has(item.id)));
       const sales = ownOrders.reduce(
         (total, order) =>
           total +
           order.items.reduce(
             (sum, item) =>
               sum +
               (ownProducts.find((product) => product.id === item.id)?.price || 0) * item.qty,
             0,
           ),
         0,
       );
       document.getElementById("sellerContent").innerHTML =
         `<div class="tabs"><button class="active" id="sellerTabProducts" onclick="sellerTab('products')">My uniforms</button><button id="sellerTabOrders" onclick="sellerTab('orders')">Customer orders</button></div><div id="sellerPanel"><div class="seller-stats"><div class="stat"><small>Uniforms listed</small><strong>${ownProducts.length}</strong></div><div class="stat"><small>Orders</small><strong>${ownOrders.length}</strong></div><div class="stat"><small>Sales total</small><strong>${money(sales)}</strong></div></div><button class="primary" onclick="sellerTab('add')">＋ Add a uniform</button><div style="margin-top:15px">${ownProducts.length ? ownProducts.map((product) => `<div class="seller-row"><div><b>${esc(product.name)}</b><p>${money(product.price)} · ${product.stock} in stock · ${esc(product.category)}</p></div><button class="secondary" onclick="editProduct('${product.id}')">Edit</button></div>`).join("") : '<p class="muted">No uniforms listed yet. Add a school uniform to start your shop.</p>'}</div></div>`;
     };
     sellerTab = function (tab) {
       document
         .getElementById("sellerTabProducts")
         ?.classList.toggle("active", tab === "products");
       document.getElementById("sellerTabOrders")?.classList.toggle("active", tab === "orders");
       const panel = document.getElementById("sellerPanel");
       if (tab === "add") {
         panel.innerHTML = productForm();
         return;
       }
       if (tab === "orders") {
         const ownProducts = products.filter(
             (product) =>
               ["Shirts", "Pants", "Uniforms"].includes(product.category) &&
               (product.seller === "My Store" ||
                 (currentUser && product.seller === currentUser.name)),
           ),
           ownIds = new Set(ownProducts.map((product) => product.id));
         const ownOrders = orders.filter((order) =>
           order.items.some((item) => ownIds.has(item.id)),
         );
         panel.innerHTML = ownOrders.length
           ? ownOrders
               .map(
                 (order) =>
                   `<div class="order-card"><b>${esc(order.id)}</b><p class="small muted">${esc(
                     order.items
                       .filter((item) => ownIds.has(item.id))
                       .map((item) => `${item.name} × ${item.qty}`)
                       .join(", "),
                   )}</p><div class="order-bottom"><b>${money(order.total)}</b><select aria-label="Order status" onchange="updateOrderStatus('${order.id}',this.value)"><option ${order.status === "Order placed" ? "selected" : ""}>Order placed</option><option ${order.status === "Processing" ? "selected" : ""}>Processing</option><option ${order.status === "Complete" ? "selected" : ""}>Complete</option></select></div></div>`,
               )
               .join("")
           : '<p class="muted">Orders for your uniform listings will appear here.</p>';
         return;
       }
       renderSeller();
     };
     const createUniformOrder = placeOrder;
     placeOrder = function (event) {
       const before = orders.length,
         payment = document.getElementById("paymentMethod")?.value;
       createUniformOrder(event);
       if (orders.length > before && payment) {
         notifications.unshift({
           id: Date.now(),
           icon: "💳",
           title: "Payment option selected",
           message: `${payment} was selected for order ${orders[0].id}. Payment is simulated in this demo.`,
           time: "Just now",
           read: false,
         });
         persist();
         updateHeader();
       }
     };
     const renderCheckoutWithStandardShipping = renderCheckout;
     renderCheckout = function () {
       renderCheckoutWithStandardShipping();
       const paymentMethod = document.getElementById("paymentMethod");
       const cashOption = [...paymentMethod.options].find(
         (option) => option.textContent.trim() === "Cash on Delivery",
       );
       const gcashOption = [...paymentMethod.options].find((option) =>
         option.textContent.trim().startsWith("GCash"),
       );
       paymentMethod.replaceChildren();
       if (cashOption) {
         cashOption.textContent = "Cash";
         cashOption.value = "Cash";
         paymentMethod.append(cashOption);
       }
       if (gcashOption) {
         gcashOption.textContent = "GCash";
         gcashOption.value = "GCash";
         paymentMethod.append(gcashOption);
       }
       paymentMethod.value = "GCash";
       document.querySelector("#checkoutForm h4").textContent = "Contact details";
       document.querySelector('label[for="shipName"]').textContent = "Your name";
       ["shipMethod", "shipAddress"].forEach((id) => {
         const field = document.getElementById(id).closest(".field"),
           control = field.querySelector("input,textarea,select");
         field.hidden = true;
         field.style.display = "none";
         control.required = false;
         control.disabled = true;
       });
       document.querySelector("#checkoutForm .formgrid").style.gridTemplateColumns = "1fr";
       document.getElementById("shippingCost").closest(".sumline").remove();
       document.getElementById("checkoutTotal").textContent = money(cartSubtotal());
       document.querySelector("#checkoutForm .summary .primary").textContent =
         "Place order · " + money(cartSubtotal());
     };
     const renderUniformCartWithoutDelivery = renderCart;
     renderCart = function () {
       renderUniformCartWithoutDelivery();
       const summary = document.querySelector("#cartContent .summary");
       if (!summary) return;
       summary.querySelectorAll(".sumline").forEach((row) => {
         if (row.textContent.includes("Estimated shipping")) row.remove();
       });
       const total = summary.querySelector(".sumline.total span:last-child");
       if (total) total.textContent = money(cartSubtotal());
     };
     const placeUniformOrderWithoutDelivery = placeOrder;
     placeOrder = function (event) {
       const previousCount = orders.length;
       placeUniformOrderWithoutDelivery(event);
       if (orders.length === previousCount) return;
       const order = orders[0];
       delete order.delivery;
       delete order.address;
       delete order.shipping;
       order.total = order.subtotal;
       document.querySelectorAll("#successContent p").forEach((paragraph) => {
         if (paragraph.textContent.trim().startsWith("Delivery:")) paragraph.remove();
       });
       persist();
     };

     document.querySelector(".head-actions .navbtn").onclick = openSeller;
     function addButtonSymbols(root = document) {
       const symbols = [
         [/back|return/, "←"],
         [/search/, "⌕"],
         [/saved|save for later|save/, "♡"],
         [/notification|alert/, "♧"],
         [/cart|shopping/, "🛒"],
         [/order|receipt/, "▤"],
         [/checkout|continue shopping/, "→"],
         [/shirt/, "👕"],
         [/pant/, "👖"],
         [/category|uniform|product|catalog|course/, "▧"],
         [/remove|delete|clear|cancel|close/, "×"],
         [/edit/, "✎"],
         [/add|publish|create/, "＋"],
         [/done|place order|complete|confirm/, "✓"],
         [/week|calendar|date|code/, "▣"],
         [/filter|reset/, "↻"],
         [/login|log in|account|profile|you/, "♙"],
         [/enrolled|tab/, "◉"],
       ];
       const alreadySymbol = /^[\p{S}]/u;
       const buttons = [
         ...(root.matches?.("button") ? [root] : []),
         ...root.querySelectorAll("button"),
       ];
       buttons.forEach((button) => {
         if (button.matches(".addbtn,.heart,.top-icon") || button.closest("#pwApp,#payApp,#studentPortal,#productModal,#studentFinancialDashboard,.finance-quick-overlay"))
           return;
         if (button.querySelector(":scope > .button-symbol")) return;
         const label = (button.getAttribute("aria-label") || button.textContent)
           .replace(/\s+/g, " ")
           .trim()
           .toLowerCase();
         if (!label || alreadySymbol.test(label)) return;
         const symbol = symbols.find(([pattern]) => pattern.test(label))?.[1] || "›";
         const icon = document.createElement("span");
         icon.className = "button-symbol";
         icon.setAttribute("aria-hidden", "true");
         icon.textContent = symbol;
         button.prepend(icon, document.createTextNode(" "));
       });
     }
     addButtonSymbols();
     new MutationObserver((mutations) =>
       mutations.forEach((mutation) => {
         if (mutation.target.nodeType === Node.ELEMENT_NODE && mutation.target.matches("button"))
           addButtonSymbols(mutation.target);
         mutation.addedNodes.forEach((node) => {
           if (node.nodeType === Node.ELEMENT_NODE) addButtonSymbols(node);
         });
       }),
     ).observe(document.body, { childList: true, subtree: true });
     function init() {
       updateHeader();
       renderProducts();
       document.addEventListener("keydown", (e) => {
         if (e.key === "Escape")
           document.querySelectorAll(".modal-backdrop.show").forEach((m) => closeModal(m.id));
         if (e.key === "Enter" && e.target.classList.contains("prod-image")) e.target.click();
       });
     }
     init();
