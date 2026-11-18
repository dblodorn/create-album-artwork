import { Button, Tooltip, View } from 'reshaped'

import type { Viewport } from './lib/useViewport'

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function ZoomControls({ viewport }: { viewport: Viewport }) {
  const { zoom, fit, zoomBy, zoomTo } = viewport
  const mod = isMac() ? '⌘' : 'Ctrl+'

  return (
    <View direction="row" gap={1} align="center">
      <Tooltip text={`Zoom out (${mod}−)`} position="bottom">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            attributes={attributes}
            onClick={() => zoomBy(0.8)}
          >
            −
          </Button>
        )}
      </Tooltip>
      <Tooltip text={`Actual size (${mod}1)`} position="bottom">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            attributes={{ ...attributes, style: { minWidth: 56 } }}
            onClick={() => zoomTo(1)}
          >
            {`${Math.round(zoom * 100)}%`}
          </Button>
        )}
      </Tooltip>
      <Tooltip text={`Zoom in (${mod}+)`} position="bottom">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            attributes={attributes}
            onClick={() => zoomBy(1.25)}
          >
            +
          </Button>
        )}
      </Tooltip>
      <Tooltip text={`Fit to screen (${mod}0)`} position="bottom">
        {(attributes) => (
          <Button
            size="small"
            variant="ghost"
            color="neutral"
            attributes={attributes}
            onClick={fit}
          >
            Fit
          </Button>
        )}
      </Tooltip>
    </View>
  )
}
