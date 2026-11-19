import type { FabricObject } from 'fabric'

import { isImage, isPath, isText } from './objectTypes'

export type LayerKind = 'text' | 'image' | 'drawing' | 'shape'

export function layerKind(object: FabricObject): LayerKind {
  if (isText(object)) return 'text'
  if (isImage(object)) return 'image'
  if (isPath(object)) return 'drawing'
  return 'shape'
}

// Derived each time, never stored. Visual truncation is left to CSS.
export function layerLabel(object: FabricObject): string {
  if (isText(object)) {
    const firstLine = (object.text ?? '').trim().split('\n')[0]?.trim()
    return firstLine || 'Empty text'
  }
  if (isImage(object)) return 'Image'
  if (isPath(object)) return 'Drawing'
  return 'Shape'
}
