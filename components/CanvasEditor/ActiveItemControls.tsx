import type { FabricObject } from 'fabric'
import { Button, Tooltip, View } from 'reshaped'

import css from './CanvasEditor.module.css'
import { LayerDown, LayerUp, ScaleDown, ScaleUp, Trash } from './icons'

export function ActiveItemControls({
  isDrawing,
  moveItemUp,
  moveItemDown,
  deleteSelected,
  scaleActiveItemUpDown,
  activeItem,
}: {
  isDrawing?: boolean
  moveItemUp: () => void
  moveItemDown: () => void
  deleteSelected: () => void
  scaleActiveItemUpDown: (direction: 'up' | 'down') => void
  activeItem: FabricObject | null
}) {
  return (
    <View
      attributes={{
        style: !activeItem
          ? {
              opacity: 0.5,
              pointerEvents: 'none',
            }
          : {},
      }}
      direction="row"
      gap={2}
      position="relative"
      insetEnd={0}
      insetBottom={1}
      paddingStart={1}
    >
      <Tooltip text="Scale up" position="top">
        {(attributes) => (
          <Button
            size="small"
            attributes={attributes}
            onClick={() => scaleActiveItemUpDown('up')}
            icon={ScaleUp}
            color="neutral"
            rounded
            className={css.CircleButton}
            disabled={isDrawing}
          />
        )}
      </Tooltip>
      <Tooltip text="Scale down" position="top">
        {(attributes) => (
          <Button
            size="small"
            attributes={attributes}
            onClick={() => scaleActiveItemUpDown('down')}
            icon={ScaleDown}
            color="neutral"
            rounded
            className={css.CircleButton}
            disabled={isDrawing}
          />
        )}
      </Tooltip>
      <Tooltip text="Move layer up" position="top">
        {(attributes) => (
          <Button
            size="small"
            attributes={attributes}
            onClick={moveItemUp}
            icon={LayerUp}
            color="neutral"
            rounded
            className={css.CircleButton}
            disabled={isDrawing}
          />
        )}
      </Tooltip>
      <Tooltip text="Move layer down" position="top">
        {(attributes) => (
          <Button
            size="small"
            attributes={attributes}
            onClick={moveItemDown}
            icon={LayerDown}
            color="neutral"
            rounded
            className={css.CircleButton}
            disabled={isDrawing}
          />
        )}
      </Tooltip>
      <Tooltip text="Delete" position="top-end">
        {(attributes) => (
          <Button
            size="small"
            attributes={attributes}
            onClick={deleteSelected}
            icon={Trash}
            color="neutral"
            rounded
            className={css.CircleButton}
            disabled={isDrawing}
          />
        )}
      </Tooltip>
    </View>
  )
}