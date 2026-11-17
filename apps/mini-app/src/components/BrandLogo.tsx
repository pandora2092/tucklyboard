import { BRAND_ARTWORK } from '@tuckly/contracts';

export function BrandLogo() {
  return (
    <svg
      className={'brand-logo'}
      viewBox={BRAND_ARTWORK.logoViewBox}
      fill={'none'}
      aria-hidden={'true'}
    >
      <g
        stroke={'currentColor'}
        strokeWidth={BRAND_ARTWORK.strokeWidth}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      >
        {BRAND_ARTWORK.letters.map(path => (
          <path key={path} d={path} />
        ))}
      </g>
      <g className={'brand-logo-flower'} transform={BRAND_ARTWORK.logoMarkTransform}>
        <path d={BRAND_ARTWORK.flower} fill={'currentColor'} />
        <circle cx={'32'} cy={'32'} r={'4'} fill={'var(--space-soft)'} />
      </g>
    </svg>
  );
}
