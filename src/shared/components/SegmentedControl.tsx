import styles from './SegmentedControl.module.css'

export interface Segment<T extends string> {
  value: T
  label: string
  /** Optional tally shown beside the label. */
  count?: number
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group, since the buttons alone lack context. */
  label: string
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * A single-choice filter rendered as one connected control.
 *
 * Uses a radio group rather than tabs: it filters the list below instead of
 * swapping panels, and screen readers should hear it as a choice, not navigation.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {segments.map((segment) => {
        const isSelected = segment.value === value
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={[styles.segment, isSelected ? styles.selected : undefined]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(segment.value)}
          >
            {segment.label}
            {segment.count === undefined ? null : (
              <span className={styles.badge}>{segment.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
