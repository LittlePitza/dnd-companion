import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'default' | 'solid' | 'hot' | 'chaos' | 'danger' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'default' | 'small'
  block?: boolean
  children: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string | undefined> = {
  default: undefined,
  solid: styles.solid,
  hot: styles.hot,
  chaos: styles.chaos,
  danger: styles.danger,
  ghost: styles.ghost,
}

export function Button({
  variant = 'default',
  size = 'default',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    VARIANT_CLASS[variant],
    size === 'small' ? styles.small : undefined,
    block ? styles.block : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    // eslint-disable-next-line react/button-has-type -- `type` is a typed prop with a safe default.
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
