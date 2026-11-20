import { Button } from 'reshaped'

import { GlassToolbar, Hint } from '@/design'

import type { Viewport } from './lib/useViewport'

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function ZoomControls({ viewport }: { viewport: Viewport }) {
  const { zoom, fit, zoomBy, zoomTo } = viewport
  const mod = isMac() ? '⌘' : 'Ctrl+'

  return (
    <GlassToolbar label="Zoom">
      <Hint text={`Zoom out (${mod}−)`} position="top">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            rounded
            attributes={attributes}
            onClick={() => zoomBy(0.8)}
          >
            −
          </Button>
        )}
      </Hint>
      <Hint text={`Actual size (${mod}1)`} position="top">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            rounded
            attributes={{ ...attributes, style: { minWidth: 56 } }}
            onClick={() => zoomTo(1)}
          >
            {`${Math.round(zoom * 100)}%`}
          </Button>
        )}
      </Hint>
      <Hint text={`Zoom in (${mod}+)`} position="top">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            rounded
            attributes={attributes}
            onClick={() => zoomBy(1.25)}
          >
            +
          </Button>
        )}
      </Hint>
      <Hint text={`Fit to screen (${mod}0)`} position="top">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            rounded
            attributes={attributes}
            onClick={fit}
          >
            Fit
          </Button>
        )}
      </Hint>
    </GlassToolbar>
  )
}
