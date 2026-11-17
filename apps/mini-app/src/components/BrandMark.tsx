import { BRAND_ARTWORK } from '@tuckly/contracts';

/** A small, deliberately organic flower shared by the album's signature moments. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox={BRAND_ARTWORK.markViewBox}
      fill={'currentColor'}
      aria-hidden={'true'}
    >
      <path d={BRAND_ARTWORK.flower} />
      <circle cx={'32'} cy={'32'} r={'4'} fill={'var(--space-surface)'} />
    </svg>
  );
}
