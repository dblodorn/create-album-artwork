'use client'

import type { ComponentProps } from 'react'
import { Button } from 'reshaped'

type PillProps = Omit<ComponentProps<typeof Button>, 'rounded' | 'size'>

/**
 * The text button: Sanzo Wada's pill, sized for an application. Fully
 * rounded, uppercase caption type with slight tracking, neutral fill that
 * darkens on hover and press (the neutral solid variant's own states).
 * Icon-only buttons stay plain Reshaped `Button`s with `rounded`.
 */
export function Pill({ className, variant = 'solid', color = 'neutral', ...props }: PillProps) {
  return (
    <Button
      {...props}
      size="small"
      rounded
      variant={variant}
      color={color}
      className={className ? `dmbk-pill ${className}` : 'dmbk-pill'}
    />
  )
}
