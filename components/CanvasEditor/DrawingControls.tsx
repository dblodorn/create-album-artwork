import { useCallback, useEffect, useState } from 'react'
import type { FabricObject } from 'fabric'
import { Button, Popover, Radio, RadioGroup, Slider, Text, Tooltip, View } from 'reshaped'

import css from './CanvasEditor.module.css'
import { Brush, Draw, LineWeight } from './icons'
import type { FabricJSEditor } from './lib'

const BRUSHES = ['spray', 'square', 'diamond', 'texture', 'path']

export function DrawingControls({
  editor,
  isDrawing,
  activeItem,
  toggleDraw,
  showBrushSelector = false,
}: {
  editor: FabricJSEditor | undefined
  isDrawing?: boolean
  activeItem: FabricObject | null
  toggleDraw: () => void
  showBrushSelector?: boolean
}) {
  const [strokeWeight, setStrokeWeight] = useState(2)

  const handleSetStrokeWeight = useCallback(
    (weight: number) => {
      if (!editor) return
      if (!editor?.canvas.freeDrawingBrush) return
      setStrokeWeight(weight)
      if (activeItem && (activeItem as any).type === 'path') {
        activeItem.strokeWidth && setStrokeWeight(activeItem.strokeWidth)

        editor.canvas.freeDrawingBrush.width = weight
        activeItem.set({ strokeWidth: weight })

        editor.canvas.renderAll()
      } else {
        editor.canvas.freeDrawingBrush.width = weight
      }
    },
    [editor, activeItem, setStrokeWeight]
  )

  useEffect(() => {
    if (!editor) return
    if (activeItem && (activeItem as any).type === 'path') {
      activeItem.strokeWidth && setStrokeWeight(activeItem.strokeWidth)
    }
  }, [editor, strokeWeight, activeItem, setStrokeWeight])

  const [currentBrush, setCurrentBrush] = useState('path')

  return (
    <View gap={2}>
      <Tooltip text={!isDrawing ? 'Draw' : 'Stop'} position="end">
        {(attributes) => (
          <Button
            size="small"
            onClick={toggleDraw}
            icon={Draw}
            color={isDrawing ? 'neutral' : 'inherit'}
            rounded
            className={css.CircleButton}
            attributes={attributes}
          />
        )}
      </Tooltip>
      <View gap={2} direction="row">
        <Popover triggerType="hover" position="end">
          <Popover.Trigger>
            {(attributes) => (
              <Button
                size="small"
                color="neutral"
                rounded
                className={css.CircleButton}
                attributes={attributes}
                icon={LineWeight}
              />
            )}
          </Popover.Trigger>
          <Popover.Content>
            <View gap={2}>
              <Text variant="caption-2">Line weight</Text>
              <Slider
                name="slider"
                defaultValue={strokeWeight}
                min={1}
                max={100}
                onChange={(event: any) => handleSetStrokeWeight(event.value)}
              />
            </View>
          </Popover.Content>
        </Popover>
      </View>
      {showBrushSelector && (
        <View
          gap={2}
          direction="row"
          attributes={{
            id: 'brush-selector',
          }}
        >
          <Popover triggerType="hover" position="top">
            <Popover.Trigger>
              {(attributes) => (
                <Button
                  size="small"
                  color="neutral"
                  rounded
                  className={css.CircleButton}
                  attributes={attributes}
                  icon={Brush}
                />
              )}
            </Popover.Trigger>
            <Popover.Content>
              <View gap={2}>
                <Text variant="caption-2">Brush</Text>
                <RadioGroup
                  name="brushType"
                  defaultValue="path"
                  onChange={({ value }: any) => setCurrentBrush(value)}
                >
                  <View gap={2} direction="row">
                    {BRUSHES.map((brush) => (
                      <View
                        borderRadius="large"
                        backgroundColor="neutral-faded"
                        padding={1}
                        paddingEnd={3}
                        key={brush}
                      >
                        <Radio value={brush} checked={brush === currentBrush}>
                          {brush}
                        </Radio>
                      </View>
                    ))}
                  </View>
                </RadioGroup>
              </View>
            </Popover.Content>
          </Popover>
        </View>
      )}
    </View>
  )
}