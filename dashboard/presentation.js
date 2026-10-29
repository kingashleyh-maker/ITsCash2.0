(() => {
  const shop = document.getElementById("shop");
  shop.insertAdjacentHTML(
    "afterbegin",
    '<div class="store-announcement">READY FOR YOUR NEXT CAMPUS DAY · STI CAMPUS STORE</div>',
  );
  document.getElementById("uniformShopTitle").textContent = "STI Campus Store";
  const head = shop.querySelector(".uniform-shop-head");
  head.insertAdjacentHTML(
    "afterend",
    `<nav class="store-navigation" aria-label="Store navigation"><button onclick="resetFilters()">Discover</button><button onclick="setCategory('Shirts')">Shirts</button><button onclick="setCategory('Pants')">Pants</button><button onclick="openSaved()">Your favorites</button><button onclick="openOrders()">Your orders</button></nav><section class="store-hero"><h2>Everything you<br>need for your<br>campus day.</h2><aside><button class="round-link" aria-label="Browse campus essentials" onclick="document.getElementById('productGrid').scrollIntoView({behavior:'smooth'})">↗</button><div>Made for your everyday.<br>Discover your campus essentials.</div></aside></section><section class="store-features" id="storeFeatures" aria-label="Featured campus essentials"></section>`,
  );
  const picks = ["uniform-gray-shirt", "uniform-blue-tee", "uniform-navy-pants"];
  document.getElementById("storeFeatures").innerHTML = picks
    .map((id, i) => {
      const p = products.find((x) => x.id === id);
      return p
        ? `<button class="store-feature" onclick="showProduct('${p.id}')"><span class="feature-tag">${["Campus essential", "Student favorite", "Everyday comfort"][i]}</span><img src="${p.image}" alt="${esc(p.name)}"><span class="feature-caption"><span>${esc(p.name)}</span><span aria-hidden="true">↗</span></span></button>`
        : "";
    })
    .join("");
  shop.insertAdjacentHTML(
    "beforeend",
    '<footer class="store-footer">STI CAMPUS STORE · YOUR EVERYDAY STARTS HERE</footer>',
  );
  const baseRender = renderProducts;
  renderProducts = function () {
    baseRender();
    if (activeCategory === "All" && !document.getElementById("searchInput").value.trim())
      document.getElementById("productHeading").textContent = "Bestsellers";
  };
  document.querySelector(".learning-app").classList.add("is-shopping");
  renderProducts();
})();
