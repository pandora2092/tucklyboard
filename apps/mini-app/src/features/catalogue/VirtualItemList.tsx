import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { Item } from '@tuckly/contracts';

import { CATALOGUE_LAYOUT } from '../../constants/catalogue-layout';
import { captureCatalogueScroll, type CatalogueScrollAnchor } from '../../lib/catalogue-scroll';

import './virtual-item-list.css';

// Only fields that affect the card's natural height belong in this key. Media
// fills a reserved preview box and must not be loaded by the measuring copy.
function contentKey(item: Item) {
  return JSON.stringify([
    item.id,
    item.type,
    item.title,
    item.source,
    item.collection?.name,
    item.tags,
    item.statusInfo?.name,
    item.collections.map(collection => collection.name),
  ]);
}

export function VirtualItemList({
  items,
  grid,
  scrollAnchor,
  renderItem,
  renderMeasurement,
}: {
  items: Item[];
  grid: boolean;
  scrollAnchor: CatalogueScrollAnchor | null;
  renderItem: (item: Item) => ReactNode;
  renderMeasurement: (item: Item) => ReactNode;
}) {
  const restoredAnchor = useRef<CatalogueScrollAnchor | null>(null);
  const visibleAnchor = useRef<CatalogueScrollAnchor | null>(null);
  const pendingViewAnchor = useRef<CatalogueScrollAnchor | null>(null);
  const lastView = useRef({ grid, width: 0 });
  const root = useRef<HTMLDivElement>(null);
  const measuring = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState(() => new Map<string, number>());
  const previousHeight = useRef(0);
  const previousRowHeights = useRef<number[]>([]);
  const [layout, setLayout] = useState({ columns: 1, margin: 0, width: 0, gap: 0 });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const columns = grid ? layout.columns : 1;
  const cardWidth = (layout.width - layout.gap * (columns - 1)) / columns;
  const keys = useMemo(
    () => items.map(item => `${grid ? 'grid' : 'list'}:${cardWidth}:${contentKey(item)}`),
    [items, grid, cardWidth],
  );
  const missing = useMemo(
    () => keys.flatMap((key, index) => (heights.has(key) ? [] : [index])),
    [keys, heights],
  );
  const ready = layout.width > 0 && !missing.length;
  useLayoutEffect(() => {
    const element = root.current!;
    const measure = () => {
      const style = getComputedStyle(element);
      const next = {
        columns: Number.parseInt(style.getPropertyValue('--cards-columns')) || 1,
        margin: element.getBoundingClientRect().top + window.scrollY,
        width: element.getBoundingClientRect().width,
        gap: Number.parseFloat(style.getPropertyValue('--cards-gap')) || 0,
      };
      setLayout(previous =>
        Object.keys(next).every(
          key => previous[key as keyof typeof next] === next[key as keyof typeof next],
        )
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.parentElement) {
      observer.observe(element.parentElement);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [grid]);
  useEffect(() => {
    let active = true;
    const invalidate = (event: FontFaceSetLoadEvent) => {
      if (!active || !root.current) {
        return;
      }
      // Fonts used only inside the fixed-size media preview cannot resize a
      // card. Invalidate only when a font used by its body finishes loading.
      const family = getComputedStyle(root.current).fontFamily;
      if (event.fontfaces.some(font => family.includes(font.family.replaceAll(/["']/g, '')))) {
        setHeights(current => (current.size ? new Map() : current));
      }
    };
    document.fonts.addEventListener('loadingdone', invalidate);
    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', invalidate);
    };
  }, []);
  useLayoutEffect(() => {
    if (!layout.width || !missing.length) {
      return;
    }
    let active = true;
    const measure = () => {
      if (!active) {
        return;
      }
      const elements = [...(measuring.current?.children || [])] as HTMLElement[];
      // Read all boxes before updating React or virtualizer state.
      const measured = elements.map(element => element.getBoundingClientRect().height);
      const nextHeights = new Map(heights);
      missing.forEach((index, position) => nextHeights.set(keys[index], measured[position]));
      const current = new Set(keys);
      const limit = Math.max(CATALOGUE_LAYOUT.measurementCacheSize, current.size);
      for (const key of nextHeights.keys()) {
        if (nextHeights.size <= limit) {
          break;
        }
        if (!current.has(key)) {
          nextHeights.delete(key);
        }
      }
      setHeights(nextHeights);
    };
    if (document.fonts.status === 'loading') {
      void document.fonts.ready.then(measure);
    } else {
      measure();
    }
    return () => {
      active = false;
    };
  }, [keys, layout.width, missing, heights]);
  const rowHeights = useMemo(() => {
    if (!ready) {
      return [];
    }
    const result: number[] = [];
    for (let index = 0; index < items.length; index += columns) {
      result.push(
        Math.max(...keys.slice(index, index + columns).map(key => heights.get(key)!)) + layout.gap,
      );
    }
    return result;
  }, [ready, keys, items.length, columns, layout.gap, heights]);
  const focusedRow = useMemo(() => {
    const index = items.findIndex(item => item.id === focusedId);
    return index < 0 ? -1 : Math.floor(index / columns);
  }, [items, focusedId, columns]);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const visible = defaultRangeExtractor(range);
      return focusedRow < 0
        ? visible
        : [...new Set([...visible, focusedRow])].sort((a, b) => a - b);
    },
    [focusedRow],
  );
  const getItemKey = useCallback((index: number) => items[index * columns].id, [items, columns]);
  const virtualizer = useWindowVirtualizer({
    count: ready || previousRowHeights.current.length ? Math.ceil(items.length / columns) : 0,
    estimateSize: index =>
      rowHeights[index] || previousRowHeights.current[index] || previousRowHeights.current[0] || 1,
    overscan: CATALOGUE_LAYOUT.overscanRows,
    scrollMargin: layout.margin,
    getItemKey,
    rangeExtractor,
  });
  const rowSizesKey = rowHeights.join(',');
  useLayoutEffect(() => {
    if (ready) {
      virtualizer.measure();
    }
  }, [virtualizer, ready, rowSizesKey]);
  const totalHeight = ready
    ? rowHeights.reduce((total, height) => total + height, 0)
    : previousHeight.current;
  useLayoutEffect(() => {
    if (ready) {
      previousHeight.current = totalHeight;
      previousRowHeights.current = rowHeights;
    }
  }, [ready, totalHeight, rowHeights]);
  useLayoutEffect(() => {
    const previous = lastView.current;
    if (previous.width && (previous.grid !== grid || previous.width !== layout.width)) {
      pendingViewAnchor.current = visibleAnchor.current;
    }
    lastView.current = { grid, width: layout.width };
  }, [grid, layout.width]);
  useLayoutEffect(() => {
    const snapshot = pendingViewAnchor.current || scrollAnchor;
    if (!ready || !snapshot || restoredAnchor.current === snapshot) {
      return;
    }
    restoredAnchor.current = snapshot;
    pendingViewAnchor.current = null;
    const indices = new Map(items.map((item, index) => [item.id, index]));
    const anchor = snapshot.cards.find(card => indices.has(card.id));
    // All heights are known before paint, including offscreen rows. Restore
    // directly to the exact offset rather than correcting scroll over frames.
    const row = anchor ? Math.floor(indices.get(anchor.id)! / columns) : 0;
    const top = anchor
      ? layout.margin +
        rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) -
        anchor.top
      : snapshot.offset;
    window.scrollTo({ top, behavior: 'instant' });
  }, [ready, scrollAnchor, items, columns, rowHeights, layout.margin, layout.width, grid]);
  useLayoutEffect(() => {
    if (ready) {
      visibleAnchor.current = captureCatalogueScroll();
    }
  });
  useEffect(() => {
    const capture = () => {
      if (root.current?.style.visibility !== 'hidden') {
        visibleAnchor.current = captureCatalogueScroll();
      }
    };
    window.addEventListener('scroll', capture, { passive: true });
    return () => window.removeEventListener('scroll', capture);
  }, []);
  return (
    <>
      <div
        ref={root}
        className={grid ? 'cards catalogue-results' : 'cards list catalogue-results'}
        role={'list'}
        aria-label={'Сохранённые находки'}
        aria-busy={!ready}
        style={{ height: totalHeight, visibility: ready ? undefined : 'hidden' }}
        onFocusCapture={event => {
          const card = (event.target as HTMLElement).closest<HTMLElement>('[data-catalogue-id]');
          if (card) {
            setFocusedId(card.dataset.catalogueId!);
          }
        }}
      >
        {virtualizer.getVirtualItems().map(row => (
          <div
            key={row.key}
            className={'catalogue-row'}
            role={'presentation'}
            style={{ transform: `translateY(${row.start - layout.margin}px)` }}
          >
            {items.slice(row.index * columns, (row.index + 1) * columns).map((item, column) => (
              <div
                key={item.id}
                className={'card-wrap'}
                data-catalogue-id={item.id}
                role={'listitem'}
                aria-posinset={row.index * columns + column + 1}
                aria-setsize={items.length}
              >
                {renderItem(item)}
              </div>
            ))}
          </div>
        ))}
      </div>
      {layout.width > 0 && missing.length > 0 && (
        <div
          ref={measuring}
          className={grid ? 'cards catalogue-measurements' : 'cards list catalogue-measurements'}
          style={{ width: layout.width }}
          aria-hidden={'true'}
          inert
        >
          {missing.map(index => (
            <div key={keys[index]} className={'card-wrap'} style={{ width: cardWidth }}>
              {renderMeasurement(items[index])}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
