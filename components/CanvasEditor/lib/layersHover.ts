// Whether the pointer is over the Layers panel. While it is, ↑/↓ step the
// selection through the layers instead of nudging (see useEditorShortcuts).
let hovered = false

export const setLayersPanelHovered = (value: boolean) => {
  hovered = value
}

export const isLayersPanelHovered = () => hovered
