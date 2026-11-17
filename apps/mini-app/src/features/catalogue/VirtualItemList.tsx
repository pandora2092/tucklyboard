import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/react-virtual';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Item } from '@tuckly/contracts';

import { CATALOGUE_LAYOUT } from '../../constants/catalogue-layout';
import type { CatalogueScrollAnchor } from '../../lib/catalogue-scroll';

import './virtual-item-list.css';

export function VirtualItemList({
  items,
  grid,
  scrollAnchor,
  renderItem,
}: {
  items: Item[];
  grid: boolean;
  scrollAnchor: CatalogueScrollAnchor | null;
  renderItem: (item: Item) => ReactNode;
}) {
  const restoredAnchor = useRef<CatalogueScrollAnchor | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ columns: 1, margin: 0, width: 0 });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const columns = grid ? layout.columns : 1;
  useLayoutEffect(() => {
    const element = root.current!;
    const measure = () => {
      const next = {
        columns:
          Number.parseInt(getComputedStyle(element).getPropertyValue('--cards-columns')) || 1,
        margin: element.getBoundingClientRect().top + window.scrollY,
        width: element.clientWidth,
      };
      setLayout(previous =>
        previous.columns === next.columns &&
        previous.margin === next.margin &&
        previous.width === next.width
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
    count: Math.ceil(items.length / columns),
    estimateSize: () =>
      grid ? CATALOGUE_LAYOUT.estimatedGridRowHeight : CATALOGUE_LAYOUT.estimatedListRowHeight,
    overscan: CATALOGUE_LAYOUT.overscanRows,
    scrollMargin: layout.margin,
    getItemKey,
    rangeExtractor,
  });
  useLayoutEffect(() => {
    virtualizer.measure();
    root.current
      ?.querySelectorAll<HTMLElement>('.catalogue-row')
      .forEach(element => virtualizer.measureElement(element));
  }, [virtualizer, columns, layout.width, grid]);
  useLayoutEffect(() => {
    if (!scrollAnchor || restoredAnchor.current === scrollAnchor) {
      return;
    }
    restoredAnchor.current = scrollAnchor;
    const ids = new Set(items.map(item => item.id));
    const anchor = scrollAnchor.cards.find(card => ids.has(card.id));
    if (!anchor) {
      window.scrollTo({ top: scrollAnchor.offset, behavior: 'instant' });
      return;
    }
    let frame = 0;
    let remaining: number = CATALOGUE_LAYOUT.scrollRestoreFrames;
    const restore = () => {
      const element = root.current?.querySelector<HTMLElement>(
        `[data-catalogue-id="${CSS.escape(anchor.id)}"]`,
      );
      if (element) {
        const delta = element.getBoundingClientRect().top - anchor.top;
        if (Math.abs(delta) > 1) {
          window.scrollBy({ top: delta, behavior: 'instant' });
        }
      } else if (remaining === CATALOGUE_LAYOUT.scrollRestoreFrames) {
        const index = items.findIndex(item => item.id === anchor.id);
        virtualizer.scrollToIndex(Math.floor(index / columns), {
          align: 'start',
          behavior: 'auto',
        });
      }
      if (--remaining > 0) {
        frame = requestAnimationFrame(restore);
      }
    };
    restore();
    return () => cancelAnimationFrame(frame);
  }, [scrollAnchor, items, columns, virtualizer]);
  return (
    <div
      ref={root}
      className={grid ? 'cards catalogue-results' : 'cards list catalogue-results'}
      role={'list'}
      aria-label={'Сохранённые находки'}
      style={{ height: virtualizer.getTotalSize() }}
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
          ref={virtualizer.measureElement}
          data-index={row.index}
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
  );
}
