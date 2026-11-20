import type { HTMLAttributes, ReactNode } from 'react'

type GlassToolbarProps = {
  /** Accessible name, e.g. "Zoom". */
  label: string
  className?: string
  attributes?: HTMLAttributes<HTMLDivElement>
  children: ReactNode
}

/**
 * A row of controls in a rounded glass pill, floating over a workspace. Only
 * the surface: where it floats is the app's job (position it from outside).
 * Controls inside stay plain (ghost, `rounded`), not pills.
 */
export function GlassToolbar({ label, className, attributes, children }: GlassToolbarProps) {
  return (
    <div
      {...attributes}
      role="toolbar"
      aria-label={label}
      className={className ? `dmbk-glass dmbk-toolbar ${className}` : 'dmbk-glass dmbk-toolbar'}
    >
      {children}
    </div>
  )
}
