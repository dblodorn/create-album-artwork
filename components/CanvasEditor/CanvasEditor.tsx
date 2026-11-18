'use client'

import { FabricImage } from 'fabric'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Divider, Text, Tooltip, View, useToast } from 'reshaped'

import { ActiveItemControls } from './ActiveItemControls'
import css from './CanvasEditor.module.css'
import { ColorEditor } from './ColorEditor'
import { DrawingControls } from './DrawingControls'
import { ExportControls } from './ExportControls'
import { FloatingPanel } from './FloatingPanel'
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
import { useViewport } from './lib/useViewport'
import { Workspace } from './Workspace'
import { ZoomControls } from './ZoomControls'
import { useCanvasAutosave } from '@/lib/useCanvasAutosave'

export function CanvasEditor() {
  const toast = useToast()
  const requestSaveRef = useRef<() => void>(() => {})
  const { editor, onReady } = useFabricJSEditor({
    onChange: () => requestSaveRef.current(),
  })
  const autosave = useCanvasAutosave(editor?.canvas ?? null)
  requestSaveRef.current = autosave.requestSave

  const workspaceRef = useRef<HTMLDivElement>(null)
  const viewport = useViewport(workspaceRef)

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
        const { h, w, x, y } = scaleImageToCanvas(img)
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
    <div className={css.App}>
      <header className={css.TopBar}>
        <Text variant="body-2" weight="medium">
          Album Artwork
        </Text>
        <ZoomControls viewport={viewport} />
        <View direction="row" gap={2} align="center">
          {editor && (
            <ExportControls editor={editor} onSceneLoaded={syncFromCanvas} />
          )}
        </View>
      </header>

      <Workspace
        workspaceRef={workspaceRef}
        viewport={viewport}
        canvas={editor?.canvas ?? null}
        onReady={onReady}
        onBackgroundPointerDown={handleDeselectActiveObject}
      />

      <FloatingPanel
        id="tools"
        title="Tools"
        defaultPosition={() => ({ x: 16, y: 64 })}
      >
        <View gap={2} align="center">
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
          <Divider />
          <ColorEditor
            editor={editor}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
          />
        </View>
      </FloatingPanel>

      <FloatingPanel
        id="object"
        title="Object"
        defaultPosition={({ width }) => ({ x: window.innerWidth - width - 16, y: 64 })}
      >
        <ActiveItemControls
          activeItem={activeItem}
          moveItemUp={moveItemUp}
          moveItemDown={moveItemDown}
          deleteSelected={deleteSelected}
          scaleActiveItemUpDown={scaleActiveItemUpDown}
          isDrawing={isDrawing}
        />
      </FloatingPanel>
    </div>
  )
}
