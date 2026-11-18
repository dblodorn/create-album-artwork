import { useCallback, useState } from 'react'
import { Button, Modal, Tooltip, View } from 'reshaped'

import { fonts } from '@/lib/googleFonts'

import { FontSelectorItem } from '@/lib/googleFonts'
import css from './CanvasEditor.module.css'
import { Font } from './icons'
import type { FabricJSEditor } from './lib'

export function FontSelector({
  editor,
  disabled,
}: {
  editor: FabricJSEditor | undefined
  disabled?: boolean
}) {
  const [showFontSelector, setShowFontSelector] = useState(false)

  // Applies to the selected text, or becomes the font for the next text added.
  const onClickItem = useCallback(
    (family: string) => {
      setShowFontSelector(false)
      editor?.setFont(family)
    },
    [editor, setShowFontSelector]
  )

  return (
    <>
      <Tooltip text="Fonts" position="end">
        {(attributes) => (
          <Button
            size="small"
            onClick={() => setShowFontSelector(true)}
            icon={Font}
            color="neutral"
            rounded
            disabled={disabled}
            attributes={attributes}
            className={css.CircleButton}
          />
        )}
      </Tooltip>
      <Modal
        active={showFontSelector}
        onClose={() => setShowFontSelector(false)}
        className={css.ImageGridWrapper}
      >
        <View gap={4} direction="row">
          {fonts.map((font) => (
            <FontSelectorItem
              font={font}
              setFontFamily={onClickItem}
              key={font.family}
            />
          ))}
        </View>
      </Modal>
    </>
  )
}

