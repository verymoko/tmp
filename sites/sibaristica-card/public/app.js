(() => {
  const productName = "Бразилия Амазонская робуста Хуан Травейн (анаэробная)";
  const storageKey = "sibaristica:favorite:amazon-robusta";
  const favorite = document.querySelector("[data-favorite]");
  const status = document.querySelector("[data-status]");
  const preview = document.querySelector("#product-preview");
  const openPreview = document.querySelector("[data-preview]");
  let selected = false;
  let timer;

  function renderFavorite() {
    favorite.setAttribute("aria-pressed", String(selected));
    favorite.setAttribute("aria-label", `${selected ? "Удалить из избранного" : "В избранное"}: ${productName}`);
  }

  try { selected = localStorage.getItem(storageKey) === "true"; } catch { /* The toggle also works without browser storage. */ }
  renderFavorite();

  favorite.addEventListener("click", () => {
    selected = !selected;
    renderFavorite();
    let stored = true;
    try { localStorage.setItem(storageKey, String(selected)); } catch { stored = false; }
    clearTimeout(timer);
    status.textContent = selected
      ? (stored ? "Кофе добавлен в избранное" : "Кофе в избранном до закрытия страницы")
      : "Кофе удалён из избранного";
    timer = setTimeout(() => { status.textContent = ""; }, 3000);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) {
      selected = event.newValue === "true";
      renderFavorite();
    }
  });

  openPreview.addEventListener("click", () => preview.showModal());
  document.querySelector("[data-close]").addEventListener("click", () => preview.close());
  preview.addEventListener("click", (event) => {
    if (event.target !== preview) return;
    const bounds = preview.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) preview.close();
  });
})();
