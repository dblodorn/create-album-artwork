import type { FabricObject } from 'fabric'
import { Button, Tooltip, View } from 'reshaped'

import css from './CanvasEditor.module.css'
import { LayerDown, LayerUp, ScaleDown, ScaleUp, Trash } from './icons'
import { RemoveBackgroundButton } from './RemoveBackgroundButton'

export function ActiveItemControls({
  isDrawing,
  moveItemUp,
  moveItemDown,
  deleteSelected,
  scaleActiveItemUpDown,
  activeItem,
  onRemoveBackground,
}: {
  isDrawing?: boolean
  moveItemUp: () => void
  moveItemDown: () => void
  deleteSelected: () => void
  scaleActiveItemUpDown: (direction: 'up' | 'down') => void
  activeItem: FabricObject | null
  onRemoveBackground: () => void
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
    >
      <Tooltip text="Scale up" position="bottom">
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
      <Tooltip text="Scale down" position="bottom">
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
      <Tooltip text="Move layer up" position="bottom">
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
      <Tooltip text="Move layer down" position="bottom">
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
      <RemoveBackgroundButton
        activeItem={activeItem}
        isDrawing={isDrawing}
        onOpen={onRemoveBackground}
      />
      <Tooltip text="Delete" position="bottom">
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