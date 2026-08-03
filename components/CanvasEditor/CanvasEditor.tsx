'use client'

import { Image } from 'fabric'
import { useCallback, useEffect, useState } from 'react'
import { Button, Text, Tooltip, View } from 'reshaped'

import { ActiveItemControls } from './ActiveItemControls'
import css from './CanvasEditor.module.css'
import { ColorEditor } from './ColorEditor'
import { DrawingControls } from './DrawingControls'
import { ExportControls } from './ExportControls'
import { FabricJSCanvas } from './FabricJSCanvas'
import { FontSelector } from './FontSelector'
import { Select, Type } from './icons'
import { ImagePicker } from './ImagePicker'
import { ShadowControls } from './ShadowControls'
import {
  scaleImageToCanvas,
  useEditorItems,
  useFabricJSEditor,
} from './lib'
import { useCanvasAutosave, loadFromLocalStorage } from '@/lib/useCanvasAutosave'

export function CanvasEditor() {
  const { editor, onReady } = useFabricJSEditor()
  const [initialized, setInitialized] = useState(false)

  useCanvasAutosave(editor?.canvas ?? null)

  useEffect(() => {
    const initialize = async () => {
      if (initialized || !editor) return

      editor.canvas.preserveObjectStacking = true

      const restored = await loadFromLocalStorage(editor.canvas)
      if (!restored) {
        editor.canvas.backgroundColor = '#FFFFFF'
      }

      editor.canvas.renderAll()
      setInitialized(true)
    }

    initialize()
  }, [editor, initialized])

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
        const img = await Image.fromURL(image, { crossOrigin: 'anonymous' })
        const { h, w, x, y } = scaleImageToCanvas(img, editor)
        img.scaleToHeight(h)
        img.scaleToWidth(w)

        const imgToAdd = img.set({
          left: x,
          top: y,
          angle: 0,
          crossOriginIsolated: true,
        })

        editor.canvas.add(imgToAdd)
        editor.canvas.requestRenderAll()
        editor.canvas.setActiveObject(imgToAdd)
        editor.canvas.renderAll()
      } catch (err) {
        console.error('Failed to load image', err)
      }
    },
    [editor, isDrawing, toggleDraw]
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
            <View
              gap={2}
              direction="row"
              attributes={{
                onMouseEnter: () => {
                  const canDeselect = (activeItem as any)?.type === 'image'
                  canDeselect && handleDeselectActiveObject()
                },
              }}
            >
              <View
                padding={1}
                gap={2}
                borderColor="neutral"
                backgroundColor="white"
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
                <ImagePicker
                  onImageSelect={onImageSelect}
                  disabled={!!activeItem}
                />
                <Tooltip text="Add text" position="end">
                  {(attributes) => (
                    <Button
                      size="small"
                      onClick={addText}
                      disabled={!!activeItem}
                      icon={Type}
                      color="neutral"
                      rounded
                      attributes={{
                        ...attributes,
                        onMouseEnter: handleDeselectActiveObject,
                      }}
                      className={css.CircleButton}
                    />
                  )}
                </Tooltip>
                <FontSelector
                  editor={editor}
                  disabled={!!activeItem && (activeItem as any).type !== 'text'}
                />
                <DrawingControls
                  editor={editor}
                  isDrawing={isDrawing}
                  activeItem={activeItem}
                  toggleDraw={toggleDraw}
                />
              </View>
              <ColorEditor editor={editor} />
            </View>
          </View>
          <View className={css.Canvas} aspectRatio={1 / 1}>
            <FabricJSCanvas className="sample-canvas" onReady={onReady} />
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
          {editor && <ExportControls editor={editor} />}
        </View>
      </View>
    </View>
  )
}

