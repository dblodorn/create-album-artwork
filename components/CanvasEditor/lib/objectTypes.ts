import { FabricImage, FabricText, Path } from 'fabric'
import type { FabricObject } from 'fabric'

// Fabric 7 reports `type` as the lowercased class name ('textbox', 'i-text',
// ...), so compare by class instead of by string.
export const isText = (object?: FabricObject | null): object is FabricText =>
  object instanceof FabricText

export const isImage = (object?: FabricObject | null): object is FabricImage =>
  object instanceof FabricImage

export const isPath = (object?: FabricObject | null): object is Path =>
  object instanceof Path
