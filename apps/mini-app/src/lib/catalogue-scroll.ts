export type CatalogueScrollAnchor = {
  offset: number;
  cards: { id: string; top: number }[];
};

export function captureCatalogueScroll(): CatalogueScrollAnchor {
  return {
    offset: window.scrollY,
    cards: [...document.querySelectorAll<HTMLElement>('[data-catalogue-id]')]
      .map(element => ({
        id: element.dataset.catalogueId!,
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
      }))
      .filter(card => card.bottom > 0 && card.top < window.innerHeight)
      .sort((a, b) => a.top - b.top),
  };
}
