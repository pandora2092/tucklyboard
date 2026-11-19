type IconName =
  | 'settings'
  | 'members'
  | 'list'
  | 'grid'
  | 'more'
  | 'reset'
  | 'chevron'
  | 'library'
  | 'link'
  | 'photo'
  | 'video'
  | 'note';

const paths: Record<Exclude<IconName, 'more'>, string> = {
  settings:
    'm9.5 3-.6 2.2-1.6 1-2.2-.6-2.5 4.3 1.6 1.6v1.9l-1.6 1.6 2.5 4.3 2.2-.6 1.6 1 .6 2.2h5l.6-2.2 1.6-1 2.2.6 2.5-4.3-1.6-1.6v-1.9l1.6-1.6-2.5-4.3-2.2.6-1.6-1-.6-2.2z',
  members: 'M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2',
  list: 'M3 3h18v3.333H3zM3 10.333h18v3.334H3zM3 17.667h18V21H3z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  reset: 'M3 12a9 9 0 1 0 9-9c-2.52 0-4.93 1-6.74 2.74L3 8M3 3v5h5',
  chevron: 'm6 9 6 6 6-6',
  library: 'M8 3h12v15H8zM4 7v14h12',
  link: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  photo: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4',
  video: 'M3 5h18v14H3zM10 9l5 3-5 3z',
  note: 'M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6',
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
        <path
          d={paths[name]}
          strokeLinecap={
            ['reset', 'library', 'link', 'photo', 'video', 'note'].includes(name)
              ? 'round'
              : undefined
          }
        />
      )}
      {name === 'settings' && <circle cx={12} cy={12} r={3} />}
      {name === 'photo' && <circle cx={8} cy={8} r={1.2} />}
      {name === 'members' && <circle cx={9} cy={8} r={3} />}
    </svg>
  );
}
