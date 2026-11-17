import { BrandMark } from './BrandMark';

/** Name-based artwork stays stable even when the visible items are filtered. */
export function CollectionCover({ name, compact = false }: { name: string; compact?: boolean }) {
  const variant = Array.from(name).reduce((sum, letter) => sum + letter.codePointAt(0)!, 0) % 3;
  return (
    <span
      className={`collection-cover cover-${variant}${compact ? ' compact' : ''}`}
      aria-hidden={'true'}
    >
      <span className={'cover-sheet'} />
      <span className={'cover-orbit'} />
      <BrandMark />
    </span>
  );
}
