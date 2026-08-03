import { useCallback, useState } from 'react'
import { Button, Tooltip, View } from 'reshaped'

import css from './CanvasEditor.module.css'
import type { FabricJSEditor } from './lib'

export function ColorEditor({ editor }: { editor: FabricJSEditor | undefined }) {
  const [bgColor, setBgColor] = useState('#ffffff')
  const [strokeColor, setStrokeColor] = useState('#000000')

  const handleSetStrokeColor = useCallback(
    (color: string) => {
      if (!editor) return
      if (!editor?.canvas.freeDrawingBrush) return
      editor.canvas.freeDrawingBrush.color = color
      editor.setStrokeColor(color)
      editor.canvas.renderAll()
      setStrokeColor(color)
    },
    [editor, setStrokeColor]
  )

  const handleSetBackgroundColor = useCallback(
    (color: string) => {
      if (!editor) return
      editor.canvas.backgroundColor = color
      editor.canvas.renderAll()
      setBgColor(color)
    },
    [editor, setBgColor]
  )

  return (
    <View
      padding={1}
      gap={2}
      borderColor="neutral"
      backgroundColor="white"
      borderRadius="small"
    >
      <Tooltip text="Color" position="end">
        {(attributes) => (
          <Button
            size="small"
            color="neutral"
            className={css.ColorInput}
            attributes={attributes}
          >
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => handleSetStrokeColor(e.target.value)}
            />
          </Button>
        )}
      </Tooltip>
      <Tooltip text="Background" position="end">
        {(attributes) => (
          <Button
            size="small"
            color="neutral"
            className={css.ColorInput}
            attributes={attributes}
          >
            <input
              type="color"
              value={bgColor}
              onChange={(e) => handleSetBackgroundColor(e.target.value)}
            />
          </Button>
        )}
      </Tooltip>
    </View>
  )
}