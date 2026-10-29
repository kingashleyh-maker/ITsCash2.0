window.activeUniformProgram = "All";
const programBar = document.createElement("nav");
programBar.className = "uniform-programs";
programBar.setAttribute("aria-label", "Uniform program categories");
programBar.innerHTML = '<strong>Uniforms by program</strong>' +
  ["All", "PE", "NSTP", "Tourism", "HM", "IT", "CPE"].map(name =>
    `<button type="button" data-program="${name}" aria-pressed="${name === 'All'}">${name === 'All' ? 'All uniforms' : name}</button>`).join('');
document.querySelector('.store-navigation').after(programBar);
programBar.addEventListener('click', e => {
  const button = e.target.closest('[data-program]');
  if (!button) return;
  window.activeUniformProgram = button.dataset.program;
  resetFilters();
  for (const b of programBar.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === button));
  renderProducts();
  document.getElementById('productGrid').scrollIntoView({behavior:'smooth',block:'start'});
});
const programRender = renderProducts;
renderProducts = function () {
  programRender();
  if (window.activeUniformProgram !== 'All') {
    document.getElementById('productHeading').textContent = window.activeUniformProgram + ' uniforms';
    const empty = document.querySelector('#productGrid .empty');
    if (empty) empty.innerHTML = '<strong>No matching ' + esc(window.activeUniformProgram) + ' uniforms</strong><p>Try clearing the filters. Listings appear here once the store adds uniforms for this program.</p>';
  }
};
const programShow = showProduct;
showProduct = function(id) {
  programShow(id);
  const p = products.find(p => p.id === id);
  if (!p?.catalogPhoto || p.price > 0) return;
  const details = document.getElementById('productDetails');
  for (const node of details.querySelectorAll('div')) {
    if (node.style.fontSize === '28px') node.textContent = 'Price pending';
  }
  const buy = details.querySelector('.primary');
  if (buy) {buy.disabled = true;buy.textContent = 'Awaiting price & stock';}
};
renderProducts();
