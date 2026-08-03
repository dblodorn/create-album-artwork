import { useRef } from 'react'
import { Button, Tooltip, View } from 'reshaped'

import { downloadJSON, downloadPNG, loadJSON } from './lib/uploadCanvas'
import type { FabricJSEditor } from './lib/useFabricJSEditor'

export function ExportControls({
  editor,
}: {
  editor: FabricJSEditor | undefined
}) {
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
    if (!editor || !event.target.files?.[0]) return
    await loadJSON(editor, event.target.files[0])
    event.target.value = ''
  }

  const handleClear = () => {
    if (!editor) return
    editor.deleteAll()
  }

  return (
    <View gap={2} direction="row" padding={1}>
      <Tooltip text="Download PNG" position="top">
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
      <Tooltip text="Save JSON state" position="top">
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
      <Tooltip text="Load JSON state" position="top">
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
      <Tooltip text="Clear canvas" position="top">
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