'use client'

import { FabricImage, type FabricObject } from 'fabric'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Divider, Text, Tooltip, View, useToast } from 'reshaped'

import { AccountMenu } from './AccountMenu'
import { AppMenu } from './AppMenu'
import { BackgroundRemovalModal } from './BackgroundRemovalModal'
import css from './CanvasEditor.module.css'
import { ColorEditor } from './ColorEditor'
import { DrawingControls } from './DrawingControls'
import { EditMenu } from './EditMenu'
import { FileMenu } from './FileMenu'
import { FloatingPanel } from './FloatingPanel'
import { FontSelector } from './FontSelector'
import { Select, Type } from './icons'
import { ImagePicker } from './ImagePicker'
import { LayersPanel } from './LayersPanel'
import {
  scaleImageToCanvas,
  useEditorItems,
  useFabricJSEditor,
} from './lib'
import { ARTBOARD, DEFAULT_BACKGROUND } from './lib/constants'
import { isImage, isText } from './lib/objectTypes'
import { useCanvasLayers } from './lib/useCanvasLayers'
import { useEditCommands } from './lib/useEditCommands'
import { useEditorShortcuts } from './lib/useEditorShortcuts'
import { useHistory } from './lib/useHistory'
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

  const history = useHistory(editor)
  const { reset: resetHistory } = history

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
      // Undo starts from the restored scene.
      resetHistory()
    }

    initialize()
  }, [editor, initialized, restore, syncFromCanvas, resetHistory])

  const {
    activeItem,
    deleteSelected,
    scaleActiveItemUpDown,
    rotateActiveItem,
    setActiveItemBlur,
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

  const layers = useCanvasLayers(editor)
  const { select: selectLayer } = layers

  // Middle of the part of the artboard currently on screen, in artboard units.
  const { zoom, pan } = viewport
  const getVisibleCenter = useCallback(() => {
    const rect = workspaceRef.current?.getBoundingClientRect()
    if (!rect || !zoom) return { x: ARTBOARD / 2, y: ARTBOARD / 2 }
    const clamp = (v: number) => Math.min(ARTBOARD, Math.max(0, v))
    const x0 = clamp(-pan.x / zoom)
    const x1 = clamp((rect.width - pan.x) / zoom)
    const y0 = clamp(-pan.y / zoom)
    const y1 = clamp((rect.height - pan.y) / zoom)
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
  }, [zoom, pan])

  const { commands, nudge, platform } = useEditCommands({
    editor,
    history,
    activeItem,
    getVisibleCenter,
  })
  const onSelectLayer = useCallback(
    (object: FabricObject) => {
      if (isDrawing) toggleDraw()
      selectLayer(object)
    },
    [isDrawing, toggleDraw, selectLayer]
  )

  // The image layer the Remove background dialog is working on.
  const [cutoutTarget, setCutoutTarget] = useState<FabricImage | null>(null)
  const openRemoveBackground = useCallback(() => {
    if (isImage(activeItem) && !isDrawing) setCutoutTarget(activeItem)
  }, [activeItem, isDrawing])
  const applyCutout = useCallback(
    async (result: string, keepOriginal: boolean) => {
      if (!editor || !cutoutTarget) return
      try {
        await editor.replaceImage(cutoutTarget, result, { keepOriginal })
      } catch (err) {
        console.error('Failed to apply cutout', err)
        toast.show({ color: 'critical', text: "Couldn't apply the cutout. Try again." })
        throw err
      }
    },
    [editor, cutoutTarget, toast]
  )

  const selectAdjacentLayer = useCallback(
    (direction: -1 | 1) => {
      const rows = layers.layers
      if (!rows.length) return
      const current = rows.findIndex((row) => row.object === layers.activeObject)
      const next =
        current === -1 ? (direction < 0 ? 0 : rows.length - 1) : current + direction
      if (next < 0 || next >= rows.length || next === current) return
      onSelectLayer(rows[next].object)
    },
    [layers.layers, layers.activeObject, onSelectLayer]
  )

  useEditorShortcuts(editor?.canvas, {
    commands,
    nudge,
    platform,
    selectAdjacentLayer,
    keyCommands: {
      delete: deleteSelected,
      deselect: handleDeselectActiveObject,
      scaleUp: () => scaleActiveItemUpDown('up'),
      scaleDown: () => scaleActiveItemUpDown('down'),
    },
  })

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

        // x/y are the top-left corner; Fabric 7 positions by centre by default.
        img.set({ left: x + w / 2, top: y + h / 2, angle: 0 })

        editor.canvas.add(img)
        editor.canvas.setActiveObject(img)
        editor.canvas.requestRenderAll()
      } catch (err) {
        console.error('Failed to load image', err)
        toast.show({
          color: 'critical',
          text: "Couldn't load that image. If it's a URL, the host may not allow cross-origin use.",
        })
        // Rejects so the picker stays open.
        throw err
      }
    },
    [editor, isDrawing, toggleDraw, toast]
  )

  return (
    <div className={css.App}>
      <header className={css.TopBar}>
        <View direction="row" gap={1} align="center">
          <AppMenu />
          <FileMenu
            editor={editor}
            history={history}
            hasObjects={layers.layers.length > 0}
            onSceneLoaded={syncFromCanvas}
          />
          <EditMenu commands={commands} />
        </View>
        <ZoomControls viewport={viewport} />
        <View direction="row" gap={2} align="center">
          <AccountMenu />
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
        id="layers"
        title="Layers"
        defaultPosition={({ width }) => ({ x: window.innerWidth - width - 16, y: 64 })}
      >
        <LayersPanel
          layers={layers.layers}
          activeObject={layers.activeObject}
          onSelect={onSelectLayer}
          onMove={layers.moveTo}
          onRemoveBackground={openRemoveBackground}
          isDrawing={isDrawing}
          onScale={scaleActiveItemUpDown}
          onRotate={rotateActiveItem}
          onBlur={(value, final) => {
            // Arrow keys on the slider commit per press; merge quick runs into one step.
            if (final) history.markMerge('blur')
            setActiveItemBlur(value, final)
          }}
          onDelete={deleteSelected}
        />
      </FloatingPanel>

      <BackgroundRemovalModal
        target={cutoutTarget}
        onClose={() => setCutoutTarget(null)}
        onApply={applyCutout}
      />
    </div>
  )
}
