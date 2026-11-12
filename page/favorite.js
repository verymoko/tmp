const favorite = document.querySelector('.product-card__favorite');
const storageKey = 'sibaristica:favorite:amazonian-robusta';

try {
  favorite.setAttribute('aria-pressed', String(localStorage.getItem(storageKey) === 'true'));
} catch {
  // The button still works when browser settings block storage.
}

favorite.hidden = false;

favorite.addEventListener('click', () => {
  const isFavorite = favorite.getAttribute('aria-pressed') !== 'true';
  favorite.setAttribute('aria-pressed', String(isFavorite));

  try {
    localStorage.setItem(storageKey, String(isFavorite));
  } catch {
    // Keep the current selection for this page view.
  }
});
