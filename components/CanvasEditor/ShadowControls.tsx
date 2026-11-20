import { useEffect, useState } from 'react'
import type { FabricObject } from 'fabric'
import { Shadow } from 'fabric'
import { Button, Popover, Slider, Text, View } from 'reshaped'

import { Hint } from '@/design'

import css from './CanvasEditor.module.css'
import { Shadow as ShadowIcon } from './icons'
import type { FabricJSEditor } from './lib'
import { isImage, isPath, isText } from './lib/objectTypes'

export function ShadowControls({
  editor,
  activeItem,
  isDrawing,
}: {
  editor: FabricJSEditor | undefined
  activeItem: FabricObject | null
  isDrawing?: boolean
}) {
  const [shadowColor, setShadowColor] = useState('#1b1b1b')
  const [shadowOffset, setShadowOffset] = useState(0)
  const [shadowBlur, setShadowBlur] = useState(0)

  const hasActiveItem =
    isPath(activeItem) || isImage(activeItem) || isText(activeItem)

  useEffect(() => {
    if (!editor) return
    const shadow = new Shadow({
      color: shadowColor,
      blur: shadowBlur,
      offsetX: shadowOffset,
      offsetY: shadowOffset,
    })

    if (hasActiveItem && !isDrawing) {
      activeItem?.set({ shadow })
    } else if (isDrawing && editor.canvas.freeDrawingBrush) {
      editor.canvas.freeDrawingBrush.shadow = shadow as any
    }
  }, [
    shadowColor,
    shadowOffset,
    shadowBlur,
    editor,
    activeItem,
    hasActiveItem,
    isDrawing,
  ])

  return (
    <View
      padding={1}
      gap={2}
      borderColor="neutral-faded"
      backgroundColor="elevation-raised"
      borderRadius="small"
      direction="row"
    >
      <View gap={2} direction="row">
        <Hint text="Shadow color" position="top">
          {(attributes) => (
            <Button
              size="small"
              color="neutral"
              rounded
              className={css.ColorInput}
              attributes={attributes}
            >
              <input
                type="color"
                value={shadowColor}
                onChange={(e) => setShadowColor(e.target.value)}
              />
            </Button>
          )}
        </Hint>

        <Popover triggerType="hover" position="top">
          <Popover.Trigger>
            {(attributes) => (
              <Button
                size="small"
                color="neutral"
                rounded
                className={css.CircleButton}
                attributes={attributes}
                icon={ShadowIcon}
              />
            )}
          </Popover.Trigger>
          <Popover.Content>
            <View gap={2}>
              <View gap={2}>
                <Text variant="caption-2">Shadow blur</Text>
                <Slider
                  name="shadowBlur"
                  defaultValue={shadowBlur}
                  min={1}
                  max={25}
                  onChange={(event: any) => setShadowBlur(event.value)}
                />
              </View>
              <View gap={2}>
                <Text variant="caption-2">Shadow offset</Text>
                <Slider
                  name="shadowOffset"
                  defaultValue={shadowOffset}
                  min={1}
                  max={25}
                  onChange={(event: any) => setShadowOffset(event.value)}
                />
              </View>
            </View>
          </Popover.Content>
        </Popover>
      </View>
    </View>
  )
}