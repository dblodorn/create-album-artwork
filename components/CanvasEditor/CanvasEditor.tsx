'use client'

import { FabricImage, type FabricObject } from 'fabric'
import { useCallback, useRef, useState } from 'react'
import { Button, Divider, Text, View, useToast } from 'reshaped'

import { Hint } from '@/design'

import { AccountMenu } from './AccountMenu'
import { AppMenu } from './AppMenu'
import { BackgroundRemovalModal } from './BackgroundRemovalModal'
import css from './CanvasEditor.module.css'
import { ColorEditor } from './ColorEditor'
import { DrawingControls } from './DrawingControls'
import { EditMenu } from './EditMenu'
import { FileMenu } from './FileMenu'
import { FileTabs } from './FileTabs'
import { DockablePanel } from './DockablePanel'
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
import { EFFECT_LABEL } from './lib/objectEffects'
import { isImage, isText } from './lib/objectTypes'
import { useCanvasLayers } from './lib/useCanvasLayers'
import { useEditCommands } from './lib/useEditCommands'
import { useE2EHook } from './lib/useE2EHook'
import { useEditorShortcuts } from './lib/useEditorShortcuts'
import { useHistory } from './lib/useHistory'
import { useOpenFiles } from './lib/useOpenFiles'
import { usePanelDock } from './lib/usePanelDock'
import { useViewport } from './lib/useViewport'
import { Workspace } from './Workspace'
import { ZoomControls } from './ZoomControls'

export function CanvasEditor() {
  const toast = useToast()
  const requestSaveRef = useRef<() => void>(() => {})
  const { editor, onReady } = useFabricJSEditor({
    onChange: () => requestSaveRef.current(),
  })
  const workspaceRef = useRef<HTMLDivElement>(null)
  const viewport = useViewport(workspaceRef)
  const toolsDock = usePanelDock('tools')
  const layersDock = usePanelDock('layers')

  const history = useHistory(editor)

  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND)

  // Keep the background picker in step with whatever was restored or loaded.
  const syncFromCanvas = useCallback(() => {
    if (!editor) return
    const bg = editor.canvas.backgroundColor
    setBackgroundColor(typeof bg === 'string' && bg ? bg : DEFAULT_BACKGROUND)
  }, [editor])

  // The open files (tabs): restores them on load, owns autosave, swaps scenes.
  const files = useOpenFiles({
    editor,
    history,
    viewport,
    onSceneShown: syncFromCanvas,
    onError: (text) => toast.show({ color: 'critical', text }),
  })
  requestSaveRef.current = files.requestSave

  const {
    activeItem,
    deleteSelected,
    scaleActiveItemUpDown,
    rotateActiveItem,
    setActiveItemEffect,
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

  // Read-only state for the e2e tests, only with ?e2e in the URL.
  useE2EHook({ editor, history, viewport, files })

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
          <FileMenu editor={editor} files={files} hasObjects={layers.layers.length > 0} />
          <EditMenu commands={commands} />
        </View>
        <FileTabs files={files} />
        <View direction="row" gap={2} align="center">
          <AccountMenu />
        </View>
      </header>

      <div className={css.Main}>
        {/* Docked panels are fixed to the edges; these spacers make room for them. */}
        <div className={css.DockSpacer} style={{ width: toolsDock.docked ? toolsDock.width : 0 }} />
        {/* The toolbar is the workspace's sibling, not its child, so its clicks
            and wheel never reach the workspace's pan, zoom and deselect. */}
        <div className={css.Stage}>
          <Workspace
            workspaceRef={workspaceRef}
            viewport={viewport}
            canvas={editor?.canvas ?? null}
            onReady={onReady}
            onBackgroundPointerDown={handleDeselectActiveObject}
          />
          <div className={css.ZoomToolbar}>
            <ZoomControls viewport={viewport} />
          </div>
        </div>
        <div className={css.DockSpacer} style={{ width: layersDock.docked ? layersDock.width : 0 }} />
      </div>

      <DockablePanel title="Tools" side="left" dock={toolsDock}>
        <View gap={2} align="center">
          <Hint text="Select" position="end">
            {(attributes) => (
              <Button
                size="small"
                onClick={handleSelect}
                icon={Select}
                color="neutral"
                rounded
                attributes={{ ...attributes, 'aria-label': 'Select' }}
                className={css.CircleButton}
              />
            )}
          </Hint>
          <ImagePicker onImageSelect={onImageSelect} />
          <Hint text="Add text" position="end">
            {(attributes) => (
              <Button
                size="small"
                onClick={addText}
                icon={Type}
                color="neutral"
                rounded
                attributes={{ ...attributes, 'aria-label': 'Add text' }}
                className={css.CircleButton}
              />
            )}
          </Hint>
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
      </DockablePanel>

      <DockablePanel title="Layers" side="right" dock={layersDock}>
        <LayersPanel
          layers={layers.layers}
          activeObject={layers.activeObject}
          onSelect={onSelectLayer}
          onMove={layers.moveTo}
          onRemoveBackground={openRemoveBackground}
          isDrawing={isDrawing}
          onScale={scaleActiveItemUpDown}
          onRotate={rotateActiveItem}
          onEffect={(key, value, final, merge) => {
            // Arrow keys on a slider commit per press; merge quick runs into one
            // step per control.
            if (final && merge) history.markMerge(EFFECT_LABEL[key].toLowerCase())
            setActiveItemEffect(key, value, final)
          }}
          onDelete={deleteSelected}
        />
      </DockablePanel>

      <BackgroundRemovalModal
        target={cutoutTarget}
        onClose={() => setCutoutTarget(null)}
        onApply={applyCutout}
      />
    </div>
  )
}
