import { useRef } from 'react'
import { Button, Tooltip, View, useToast } from 'reshaped'

import { downloadJSON, downloadPNG, loadJSON } from './lib/uploadCanvas'
import type { FabricJSEditor } from './lib/useFabricJSEditor'

export function ExportControls({
  editor,
  onSceneLoaded,
}: {
  editor: FabricJSEditor | undefined
  onSceneLoaded?: () => void
}) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadPNG = async () => {
    if (!editor) return
    await downloadPNG(editor)
  }

  const handleDownloadJSON = () => {
    if (!editor) return
    downloadJSON(editor)
  }

  const handleLoadJSONFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!editor || !file) return
    try {
      const dropped = await loadJSON(editor, file)
      onSceneLoaded?.()
      if (dropped) {
        toast.show({
          color: 'warning',
          text: `${dropped} image(s) in that file referenced temporary blob: URLs and were skipped.`,
        })
      }
    } catch (err) {
      console.error('Failed to load JSON', err)
      toast.show({ color: 'critical', text: "Couldn't load that file as a canvas scene." })
    }
  }

  const handleClear = () => {
    if (!editor) return
    editor.deleteAll()
  }

  return (
    <View gap={2} direction="row">
      <Tooltip text="Download PNG" position="bottom">
        {(attributes) => (
          <Button
            size="small"
            color="neutral"
            rounded
            variant="solid"
            onClick={handleDownloadPNG}
            attributes={attributes}
          >
            PNG
          </Button>
        )}
      </Tooltip>
      <Tooltip text="Save JSON state" position="bottom">
        {(attributes) => (
          <Button
            size="small"
            color="neutral"
            rounded
            variant="solid"
            onClick={handleDownloadJSON}
            attributes={attributes}
          >
            JSON
          </Button>
        )}
      </Tooltip>
      <Tooltip text="Load JSON state" position="bottom">
        {(attributes) => (
          <>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleLoadJSONFile}
              style={{ display: 'none' }}
            />
            <Button
              size="small"
              color="neutral"
              rounded
              variant="solid"
              onClick={() => fileInputRef.current?.click()}
              attributes={attributes}
            >
              Load
            </Button>
          </>
        )}
      </Tooltip>
      <Tooltip text="Clear canvas" position="bottom">
        {(attributes) => (
          <Button
            size="small"
            color="critical"
            rounded
            variant="solid"
            onClick={handleClear}
            attributes={attributes}
          >
            Clear
          </Button>
        )}
      </Tooltip>
    </View>
  )
}