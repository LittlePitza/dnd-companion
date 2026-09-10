import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import styles from './Surfaces.module.css'

export function Card({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')}>
      {title ? <h4 className={styles.cardTitle}>{title}</h4> : null}
      {children}
    </div>
  )
}

export function Section({
  heading,
  lede,
  children,
}: {
  heading: string
  lede?: string
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>{heading}</h2>
      {lede ? <p className={styles.sectionLede}>{lede}</p> : null}
      {children}
    </section>
  )
}

/** A small all-caps rule used to separate groups inside a section. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>
}

export function Grid({
  children,
  density = 'wide',
}: {
  children: ReactNode
  density?: 'wide' | 'narrow'
}) {
  return (
    <div
      className={[styles.grid, density === 'wide' ? styles.gridWide : styles.gridNarrow].join(' ')}
    >
      {children}
    </div>
  )
}

export type StatAccent = 'none' | 'surge' | 'ember' | 'verdigris'

const ACCENT_CLASS: Record<StatAccent, string | undefined> = {
  none: undefined,
  surge: styles.statAccentSurge,
  ember: styles.statAccentEmber,
  verdigris: styles.statAccentVerdigris,
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  accent = 'none',
}: {
  label: string
  value: ReactNode
  /** Rendered small beside the number, e.g. `pies`, so the two never wrap apart. */
  unit?: string
  hint?: ReactNode
  accent?: StatAccent
}) {
  return (
    <div className={[styles.statTile, ACCENT_CLASS[accent]].filter(Boolean).join(' ')}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>
        {value}
        {unit ? <span className={styles.statUnit}>{unit}</span> : null}
      </p>
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </div>
  )
}

export function EmptyState({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className={styles.empty}>
      {icon ? <Icon name={icon} size={28} strokeWidth={1.5} className={styles.emptyIcon} /> : null}
      <p>{children}</p>
    </div>
  )
}
