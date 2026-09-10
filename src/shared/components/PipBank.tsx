import styles from './PipBank.module.css'

export type PipAccent = 'bone' | 'surge' | 'ember' | 'verdigris'

const ACCENT_CLASS: Record<PipAccent, string> = {
  bone: styles.available ?? '',
  surge: styles.availableSurge ?? '',
  ember: styles.availableEmber ?? '',
  verdigris: styles.availableVerdigris ?? '',
}

export interface PipBankProps {
  label: string
  /** How many uses are still available. */
  value: number
  max: number
  accent?: PipAccent
  /**
   * Extra pips beyond `max`, drawn as conjured. Used for slots created with
   * Font of Magic, which are temporary and cannot be restored by clicking.
   */
  bonus?: number
  onChange: (next: number) => void
}

/**
 * The signature resource tracker: a row of diamonds, filled while available.
 *
 * Clicking a pip sets the pool to that point — clicking a filled pip spends
 * down to it, clicking an empty one restores up to it.
 */
export function PipBank({ label, value, max, accent = 'bone', bonus = 0, onChange }: PipBankProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>{label}</span>

      <div className={styles.pips} role="group" aria-label={label}>
        {Array.from({ length: max }, (_, index) => {
          const isAvailable = index < value
          return (
            <button
              key={index}
              type="button"
              className={[styles.pip, isAvailable ? ACCENT_CLASS[accent] : undefined]
                .filter(Boolean)
                .join(' ')}
              aria-label={`${label}: uso ${index + 1} de ${max}, ${
                isAvailable ? 'disponible' : 'gastado'
              }`}
              onClick={() => {
                onChange(index < value ? index : index + 1)
              }}
            />
          )
        })}

        {Array.from({ length: bonus }, (_, index) => (
          <span
            key={`conjured-${index}`}
            className={[styles.pip, styles.conjured].join(' ')}
            aria-label={`${label}: espacio creado con Fuente de Magia`}
            role="img"
          />
        ))}
      </div>

      <span className={styles.count}>
        {value + bonus} / {max}
        {bonus > 0 ? ` (+${bonus})` : ''}
      </span>
    </div>
  )
}
