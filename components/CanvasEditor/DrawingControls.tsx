import { useCallback, useEffect, useState } from 'react'
import type { FabricObject } from 'fabric'
import { Button, Popover, Radio, RadioGroup, Slider, Text, View } from 'reshaped'

import { Hint } from '@/design'

import css from './CanvasEditor.module.css'
import { Brush, Draw, LineWeight } from './icons'
import type { FabricJSEditor } from './lib'
import { DEFAULT_BRUSH_WIDTH } from './lib/constants'
import { isPath } from './lib/objectTypes'

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
  const [strokeWeight, setStrokeWeight] = useState(DEFAULT_BRUSH_WIDTH)

  const handleSetStrokeWeight = useCallback(
    (weight: number) => {
      if (!editor) return
      setStrokeWeight(weight)
      if (editor.canvas.freeDrawingBrush) {
        editor.canvas.freeDrawingBrush.width = weight
      }
      if (isPath(activeItem)) {
        activeItem.set({ strokeWidth: weight })
        activeItem.setCoords()
        editor.commit('Stroke Width')
      }
    },
    [editor, activeItem, setStrokeWeight]
  )

  // Show the selected path's weight in the slider.
  useEffect(() => {
    if (isPath(activeItem) && activeItem.strokeWidth) {
      setStrokeWeight(activeItem.strokeWidth)
    }
  }, [activeItem])

  const [currentBrush, setCurrentBrush] = useState('path')

  return (
    <View gap={2}>
      <Hint text={!isDrawing ? 'Draw' : 'Stop'} position="end">
        {(attributes) => (
          <Button
            size="small"
            onClick={toggleDraw}
            icon={Draw}
            color={isDrawing ? 'primary' : 'neutral'}
            rounded
            className={css.CircleButton}
            attributes={attributes}
          />
        )}
      </Hint>
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
                value={strokeWeight}
                min={1}
                max={100}
                onChange={({ value }) => handleSetStrokeWeight(value)}
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