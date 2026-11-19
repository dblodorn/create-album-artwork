import type { FabricObject } from 'fabric'

// Session-only ids for canvas objects, used as React keys and drag ids. They
// are never written to the scene; a loaded scene's objects get fresh ids.
const ids = new WeakMap<FabricObject, string>()
let next = 0

export function layerId(object: FabricObject): string {
  let id = ids.get(object)
  if (!id) {
    id = `layer-${++next}`
    ids.set(object, id)
  }
  return id
}
