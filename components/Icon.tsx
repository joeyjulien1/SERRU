import type { SVGProps } from 'react';

// Stroke icons drawn on a 24×24 grid.
const PATHS = {
  menu: 'M3 7h18M3 12h18M3 17h18',
  close: 'M6 6l12 12M18 6 6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 3-4.35-4.35',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9c.8-4.1 4-6.5 8-6.5s7.2 2.4 8 6.5',
  bag: 'M5 8h14l-1 13H6L5 8Zm3.5 0V6.5a3.5 3.5 0 0 1 7 0V8',
  chevronDown: 'm6 9 6 6 6-6',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  arrowRight: 'M4 12h15m-6-6 6 6-6 6',
  arrowLeft: 'M20 12H5m6-6-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  lock: 'M6 11h12v10H6V11Zm2.5 0V8a3.5 3.5 0 0 1 7 0v3',
  truck: 'M2 6h11v10H2V6Zm11 4h4.5l3.5 3.5V16h-8m-8 2.5a2 2 0 1 0 0-.01M16 18.5a2 2 0 1 0 0-.01',
  shield: 'M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Zm-3.5 9 2.5 2.5 4.5-5',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.5 2.5m6.4 6.4 2.5 2.5m0-11.4-2.5 2.5m-6.4 6.4-2.5 2.5',
  ruler: 'M3 16.5 16.5 3 21 7.5 7.5 21 3 16.5Zm4-4 2 2m1-5 2 2m1-5 2 2',
  mail: 'M3 6h18v12H3V6Zm0 0 9 7 9-7',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z',
  pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  image: 'M3 5h18v14H3V5Zm0 11 5-5 5 5 3-3 5 5M15.5 9.5h.01',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  card: 'M3 6h18v12H3V6Zm0 4h18M7 15h3',
  cash: 'M2.5 6.5h19v11h-19v-11ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 9.5v.01M18 14.5v.01',
  box: 'm12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Zm0 9 8.5-4.5M12 12 3.5 7.5M12 12v9',
  tag: 'M3 12V3h9l9 9-9 9-9-9Zm5-4.5h.01',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10c.5-3.8 3.4-6 7-6s6.5 2.2 7 6m1-10a3.5 3.5 0 0 0 0-7m2.5 17c-.3-2.5-1.6-4.3-3.5-5.2',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z',
  file: 'M6 3h8l4 4v14H6V3Zm8 0v4h4M9 12h6m-6 4h6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3c0-.5 0-1-.1-1.4l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4L14 2.5h-4l-.5 2.7A7 7 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.8l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.5 2.7h4l.5-2.7a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.4Z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4m-4-4h11',
  external: 'M14 4h6v6m0-6-9 9M18 14v6H4V6h6',
  alert: 'M12 9v4m0 3.5h.01M10.3 4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9.5h.01',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  flame: 'M12 21c-3.9 0-7-2.8-7-6.5 0-4.5 4.5-6.5 4.5-11 3 1.5 4.5 4 4.5 6.5 1-1 1.5-2.5 1.5-3.5 2 1.5 3.5 4.5 3.5 8 0 3.7-3.1 6.5-7 6.5Z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  download: 'M12 4v12m-5-5 5 5 5-5M4 20h16',
  arrowUp: 'M12 19V5m-6 6 6-6 6 6',
  arrowDown: 'M12 5v14m-6-6 6 6 6-6',
  copy: 'M8 8h12v12H8V8Zm-4 8V4h12',
  dot: 'M12 12h.01',
} as const;

export type IconName = keyof typeof PATHS;

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & { name: IconName; size?: number; strokeWidth?: number };

export function Icon({ name, size = 20, strokeWidth = 1.5, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
