/**
 * Scale factor for one Transform step. Fine steps change the object's longer
 * side by 1 artboard unit (proportionally); coarse steps are ×1.1 / ×0.9, the
 * same as the + / − keys. A fine step never shrinks the longer side below 1.
 */
export function scaleFactor(longest: number, direction: 'up' | 'down', coarse: boolean): number {
  if (coarse) return direction === 'up' ? 1.1 : 0.9
  if (!(longest > 0)) return 1
  const next = direction === 'up' ? longest + 1 : Math.max(1, longest - 1)
  return next / longest
}
