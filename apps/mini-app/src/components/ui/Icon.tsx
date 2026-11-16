type IconName = 'settings' | 'members' | 'list' | 'grid' | 'more';

const paths: Record<Exclude<IconName, 'more'>, string> = {
  settings:
    'm9.5 3-.6 2.2-1.6 1-2.2-.6-2.5 4.3 1.6 1.6v1.9l-1.6 1.6 2.5 4.3 2.2-.6 1.6 1 .6 2.2h5l.6-2.2 1.6-1 2.2.6 2.5-4.3-1.6-1.6v-1.9l1.6-1.6-2.5-4.3-2.2.6-1.6-1-.6-2.2z',
  members: 'M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2',
  list: 'M3 3h18v3.333H3zM3 10.333h18v3.334H3zM3 17.667h18V21H3z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
};

export function Icon({
  name,
  size,
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={'ui-icon'}
      style={{ width: size ?? 'var(--icon-size)', height: size ?? 'var(--icon-size)' }}
      viewBox={name === 'more' ? '0 0 16 16' : '0 0 24 24'}
      fill={'none'}
      stroke={'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinejoin={'round'}
      aria-hidden={'true'}
    >
      {name === 'more' ? (
        [3, 8, 13].map(cx => (
          <circle key={cx} cx={cx} cy={8} r={1.3} fill={'currentColor'} stroke={'none'} />
        ))
      ) : (
        <path d={paths[name]} />
      )}
      {name === 'settings' && <circle cx={12} cy={12} r={3} />}
      {name === 'members' && <circle cx={9} cy={8} r={3} />}
    </svg>
  );
}
