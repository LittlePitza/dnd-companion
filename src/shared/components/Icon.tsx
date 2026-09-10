export type IconName =
  | 'sun'
  | 'moon'
  | 'heart'
  | 'shield'
  | 'zap'
  | 'dice'
  | 'plus'
  | 'minus'
  | 'search'
  | 'download'
  | 'upload'
  | 'pin'
  | 'trash'
  | 'edit'
  | 'check'
  | 'sparkles'
  | 'moonStars'

/**
 * A small inline icon set. Icons are drawn as stroked 24x24 paths inheriting
 * `currentColor`, so they take the colour and size of the text around them and
 * cost no network request.
 *
 * Emoji are deliberately not used: they render differently on every platform
 * and carry their own colour, which breaks both themes.
 */
const PATHS: Record<IconName, string> = {
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M6.34 6.34 4.93 4.93M19.07 19.07l-1.41-1.41M17.66 6.34l1.41-1.41M4.93 19.07l1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  moonStars: 'M19 14.8A7.5 7.5 0 0 1 9.2 5a7.5 7.5 0 1 0 9.8 9.8ZM18 3v3M16.5 4.5h3',
  heart: 'M12 20s-7-4.5-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8c0 4.7-7 9.2-7 9.2Z',
  shield: 'M12 3 5 6v6c0 4 3 7.3 7 9 4-1.7 7-5 7-9V6l-7-3Z',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  dice: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6ZM9 9h.01M15 15h.01M15 9h.01M9 15h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 21V9M7 13l5-5 5 5M4 4h16',
  pin: 'M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z',
  trash: 'M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v5M14 11v5',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 6.5l3 3',
  check: 'M4 12.5 9 17.5 20 6.5',
  sparkles:
    'M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3ZM18.5 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4Z',
}

export interface IconProps {
  name: IconName
  /** Edge length in pixels. Defaults to 16, which sits well beside body text. */
  size?: number
  strokeWidth?: number
  className?: string
  /** Accessible name. Omit for icons that merely decorate labelled controls. */
  title?: string
}

export function Icon({ name, size = 16, strokeWidth = 2, className, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title === undefined}
      role={title === undefined ? undefined : 'img'}
      focusable="false"
    >
      {title === undefined ? null : <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  )
}
