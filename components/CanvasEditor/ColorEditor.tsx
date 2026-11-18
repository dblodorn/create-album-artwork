import { useCallback, useState } from 'react'
import { Button, Tooltip, View } from 'reshaped'

import css from './CanvasEditor.module.css'
import type { FabricJSEditor } from './lib'
import { STROKE } from './lib/defaultShapes'

export function ColorEditor({
  editor,
  backgroundColor,
  onBackgroundColorChange,
}: {
  editor: FabricJSEditor | undefined
  backgroundColor: string
  onBackgroundColorChange: (color: string) => void
}) {
  const [strokeColor, setStrokeColor] = useState(STROKE)

  const handleSetStrokeColor = useCallback(
    (color: string) => {
      if (!editor) return
      editor.setStrokeColor(color)
      setStrokeColor(color)
    },
    [editor, setStrokeColor]
  )

  const handleSetBackgroundColor = useCallback(
    (color: string) => {
      if (!editor) return
      editor.setBackgroundColor(color)
      onBackgroundColorChange(color)
    },
    [editor, onBackgroundColorChange]
  )

  return (
    <View
      padding={1}
      gap={2}
      borderColor="neutral-faded"
      backgroundColor="elevation-raised"
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
              value={backgroundColor}
              onChange={(e) => handleSetBackgroundColor(e.target.value)}
            />
          </Button>
        )}
      </Tooltip>
    </View>
  )
}