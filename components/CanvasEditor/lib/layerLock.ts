import { BaseFabricObject, type FabricObject } from 'fabric'

/*
 * Layer lock: one custom property, `layerLocked`, serialised with the scene.
 * Fabric's own flags (selectable, evented, controls, lock*) aren't serialised,
 * so they're derived from it in `_set`: loading (`fromObject`), paste
 * (`clone`) and undo (`restoreSnapshot`) all set properties through `_set`, so
 * the flags follow the lock everywhere without per-path code. A locked object
 * can't be hit or drag-selected, but `setActiveObject` (the Layers row) still
 * selects it, with no handles and nothing that moves it.
 */

export const isLocked = (object: unknown): boolean => (object as { layerLocked?: unknown })?.layerLocked === true

/** Fabric's interaction flags for a locked (or unlocked) object. */
export function lockFlags(locked: boolean) {
  return {
    selectable: !locked,
    evented: !locked,
    hasControls: !locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
  }
}

let installed = false

/** Registers `layerLocked` for serialisation and derives the flags. Call before any object exists. */
export function installLayerLock() {
  if (installed) return
  installed = true

  const Base = BaseFabricObject as unknown as { customProperties: string[] }
  if (!Base.customProperties.includes('layerLocked')) Base.customProperties = [...Base.customProperties, 'layerLocked']

  const proto = BaseFabricObject.prototype as unknown as {
    layerLocked: boolean
    _set: (this: FabricObject, key: string, value: unknown) => FabricObject
  }
  proto.layerLocked = false
  const set = proto._set
  proto._set = function (this: FabricObject, key: string, value: unknown) {
    const result = set.call(this, key, value)
    if (key === 'layerLocked') Object.assign(this, lockFlags(value === true))
    return result
  }
}
