'use client'

import { FabricImage } from 'fabric'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Tooltip, View, useToast } from 'reshaped'

import { ActiveItemControls } from './ActiveItemControls'
import css from './CanvasEditor.module.css'
import { ColorEditor } from './ColorEditor'
import { DrawingControls } from './DrawingControls'
import { ExportControls } from './ExportControls'
import { FabricJSCanvas } from './FabricJSCanvas'
import { FontSelector } from './FontSelector'
import { Select, Type } from './icons'
import { ImagePicker } from './ImagePicker'
import {
  scaleImageToCanvas,
  useEditorItems,
  useFabricJSEditor,
} from './lib'
import { DEFAULT_BACKGROUND } from './lib/constants'
import { isText } from './lib/objectTypes'
import { useCanvasAutosave } from '@/lib/useCanvasAutosave'

export function CanvasEditor() {
  const toast = useToast()
  const requestSaveRef = useRef<() => void>(() => {})
  const { editor, onReady } = useFabricJSEditor({
    onChange: () => requestSaveRef.current(),
  })
  const autosave = useCanvasAutosave(editor?.canvas ?? null)
  requestSaveRef.current = autosave.requestSave

  const [initialized, setInitialized] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND)

  // Keep the background picker in step with whatever was restored or loaded.
  const syncFromCanvas = useCallback(() => {
    if (!editor) return
    const bg = editor.canvas.backgroundColor
    setBackgroundColor(typeof bg === 'string' && bg ? bg : DEFAULT_BACKGROUND)
  }, [editor])

  const { restore } = autosave
  useEffect(() => {
    const initialize = async () => {
      if (initialized || !editor) return
      setInitialized(true)

      const restored = await restore()
      if (!restored) {
        editor.canvas.backgroundColor = DEFAULT_BACKGROUND
      }

      editor.canvas.requestRenderAll()
      syncFromCanvas()
    }

    initialize()
  }, [editor, initialized, restore, syncFromCanvas])

  const {
    activeItem,
    moveItemUp,
    moveItemDown,
    deleteSelected,
    scaleActiveItemUpDown,
    handleDeselectActiveObject,
  } = useEditorItems(editor)

  const [isDrawing, setIsDrawing] = useState(false)
  const toggleDraw = useCallback(() => {
    if (!editor) return
    editor.canvas.isDrawingMode = !editor.canvas.isDrawingMode
    setIsDrawing(editor.canvas.isDrawingMode)
  }, [editor, setIsDrawing])

  const addText = useCallback(() => {
    if (!editor) return
    editor?.addText('Text')
    if (isDrawing) toggleDraw()
  }, [editor, toggleDraw, isDrawing])

  const handleSelect = useCallback(() => {
    if (!editor) return
    if (isDrawing) toggleDraw()
    handleDeselectActiveObject()
  }, [editor, toggleDraw, isDrawing, handleDeselectActiveObject])

  const onImageSelect = useCallback(
    async (image: string) => {
      if (!image || !editor) return

      if (isDrawing) toggleDraw()

      try {
        const img = await FabricImage.fromURL(image, { crossOrigin: 'anonymous' })
        const { h, w, x, y } = scaleImageToCanvas(img, editor)
        img.scaleToHeight(h)
        img.scaleToWidth(w)

        img.set({ left: x, top: y, angle: 0 })

        editor.canvas.add(img)
        editor.canvas.setActiveObject(img)
        editor.canvas.requestRenderAll()
      } catch (err) {
        console.error('Failed to load image', err)
        toast.show({
          color: 'critical',
          text: "Couldn't load that image. If it's a URL, the host may not allow cross-origin use.",
        })
      }
    },
    [editor, isDrawing, toggleDraw, toast]
  )

  return (
    <View width="100%" align="center" paddingTop={4}>
      <View className={css.CanvasWrapper} gap={3}>
        <View
          backgroundColor="neutral-faded"
          direction="row"
          borderRadius="medium"
          padding={2}
          paddingBottom={12}
          gap={2}
          width="100%"
          justify="end"
        >
          <View
            className={css.Toolbar}
            height="100%"
            direction="row"
            insetTop={0}
            insetStart={0}
            padding={2}
            position="absolute"
          >
            <View gap={2} direction="row">
              <View
                padding={1}
                gap={2}
                borderColor="neutral-faded"
                backgroundColor="elevation-raised"
                borderRadius="small"
              >
                <Tooltip text="Select" position="end">
                  {(attributes) => (
                    <Button
                      size="small"
                      onClick={handleSelect}
                      icon={Select}
                      color="neutral"
                      rounded
                      attributes={attributes}
                      className={css.CircleButton}
                    />
                  )}
                </Tooltip>
                <ImagePicker onImageSelect={onImageSelect} />
                <Tooltip text="Add text" position="end">
                  {(attributes) => (
                    <Button
                      size="small"
                      onClick={addText}
                      icon={Type}
                      color="neutral"
                      rounded
                      attributes={attributes}
                      className={css.CircleButton}
                    />
                  )}
                </Tooltip>
                <FontSelector
                  editor={editor}
                  disabled={!!activeItem && !isText(activeItem)}
                />
                <DrawingControls
                  editor={editor}
                  isDrawing={isDrawing}
                  activeItem={activeItem}
                  toggleDraw={toggleDraw}
                />
              </View>
              <ColorEditor
                editor={editor}
                backgroundColor={backgroundColor}
                onBackgroundColorChange={setBackgroundColor}
              />
            </View>
          </View>
          <View className={css.Canvas} aspectRatio={1 / 1}>
            <FabricJSCanvas className={css.CanvasMount} onReady={onReady} />
          </View>
          <View
            position="absolute"
            insetBottom={0.5}
            insetEnd={1}
            gap={2}
            padding={1}
            direction="row"
          >
            <ActiveItemControls
              activeItem={activeItem}
              moveItemUp={moveItemUp}
              moveItemDown={moveItemDown}
              deleteSelected={deleteSelected}
              scaleActiveItemUpDown={scaleActiveItemUpDown}
              isDrawing={isDrawing}
            />
          </View>
        </View>
        <View gap={2} direction="row" justify="center" paddingTop={4}>
          {editor && (
            <ExportControls
              editor={editor}
              onSceneLoaded={syncFromCanvas}
            />
          )}
        </View>
      </View>
    </View>
  )
}

