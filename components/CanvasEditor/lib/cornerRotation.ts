import { Control, InteractiveFabricObject, Textbox, controlsUtils } from 'fabric'

/*
 * Rotate a selected object by dragging just outside any of its corners, as in
 * Illustrator and Figma. Fabric's own rotation handle (`mtr`, 40px above the
 * object) stays, but it's small and can fall outside the canvas for objects
 * near the top. These zones are invisible, begin beyond the corner scale
 * handles (so grabbing a handle still scales) and use Fabric's own rotation
 * action, so history records them as "Rotate".
 */

// How far outside the corner the zone's centre sits, and its size (CSS px).
const OFFSET = 14
const SIZE = 16

// A curved-arrow cursor for rotating (Fabric 7 reads it from each control's
// cursorStyle; its default is a plain crosshair),
// white with a dark outline so it reads on any background.
const ROTATE_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M6.5 9.5a6.5 6.5 0 1 1 1.4 7.9" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/><path d="M6.5 9.5a6.5 6.5 0 1 1 1.4 7.9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M2.5 9.5h6.5V3z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>`

export const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ROTATE_CURSOR_SVG)}") 12 12, crosshair`

const rotateZone = (x: -0.5 | 0.5, y: -0.5 | 0.5) =>
  new Control({
    x,
    y,
    offsetX: x * 2 * OFFSET,
    offsetY: y * 2 * OFFSET,
    sizeX: SIZE,
    sizeY: SIZE,
    actionName: 'rotate',
    cursorStyle: ROTATE_CURSOR,
    actionHandler: controlsUtils.rotationWithSnapping,
    cursorStyleHandler: controlsUtils.rotationStyleHandler,
    // Invisible: only the cursor tells you it's there.
    render: () => {},
  })

export const cornerRotationControls = () => ({
  rotTL: rotateZone(-0.5, -0.5),
  rotTR: rotateZone(0.5, -0.5),
  rotBL: rotateZone(-0.5, 0.5),
  rotBR: rotateZone(0.5, 0.5),
})

let installed = false

/** Adds the corner rotation zones to every object created from now on. */
export function installCornerRotation() {
  if (installed) return
  installed = true
  // Textbox has its own control set (side resize handles), so patch both.
  for (const Klass of [InteractiveFabricObject, Textbox]) {
    const base = Klass.createControls.bind(Klass)
    Klass.createControls = () => {
      const { controls } = base()
      // The top rotation handle gets the same cursor.
      if (controls.mtr) controls.mtr.cursorStyle = ROTATE_CURSOR
      return { controls: { ...controls, ...cornerRotationControls() } }
    }
  }
}
