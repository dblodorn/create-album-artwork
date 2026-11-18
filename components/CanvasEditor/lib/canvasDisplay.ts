import type { Canvas } from 'fabric'

import { ARTBOARD, MAX_BACKSTORE } from './constants'

// Renders the fixed ARTBOARD-unit scene at `displaySize` CSS px. The backing
// store follows the display size (capped), with Fabric's zoom mapping the
// artboard onto it, so objects keep their artboard coordinates and toJSON is
// unaffected. Export divides by `canvas.width` to undo this.
export function setCanvasDisplaySize(canvas: Canvas, displaySize: number) {
  // Step the backing size to avoid reallocating on every zoom tick.
  const backing = Math.min(MAX_BACKSTORE, Math.max(128, Math.ceil(displaySize / 128) * 128))
  if (canvas.width !== backing) {
    canvas.setDimensions({ width: backing, height: backing })
    canvas.setZoom(backing / ARTBOARD)
  }
  canvas.setDimensions({ width: displaySize, height: displaySize }, { cssOnly: true })
}
