import { useRef } from 'react'
import { Button, DropdownMenu, Text, useToast } from 'reshaped'

import css from './CanvasEditor.module.css'
import { SHORTCUTS_OFF } from './lib/keyboard'
import { MAX_OPEN_FILES } from './lib/openFiles'
import { downloadJSON, downloadPNG } from './lib/uploadCanvas'
import type { FabricJSEditor } from './lib/useFabricJSEditor'
import type { OpenFiles } from './lib/useOpenFiles'

export function FileMenu({
  editor,
  files,
  hasObjects,
}: {
  editor: FabricJSEditor | undefined
  files: OpenFiles
  hasObjects: boolean
}) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { canOpenMore, activeName } = files

  const handleLoadJSONFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    // Opens in a new tab; a file that isn't a scene opens nothing (and says so).
    const dropped = await files.openFromJSON(file)
    if (dropped) {
      toast.show({
        color: 'warning',
        text: `${dropped} image(s) in that file referenced temporary blob: URLs and were skipped.`,
      })
    }
  }

  return (
    <>
      <DropdownMenu position="bottom-start">
        <DropdownMenu.Trigger>
          {(attributes) => (
            <Button size="small" variant="ghost" attributes={attributes}>
              File
            </Button>
          )}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content attributes={SHORTCUTS_OFF}>
          <DropdownMenu.Section>
            <DropdownMenu.Item disabled={!canOpenMore} onClick={() => void files.newFile()}>
              New
            </DropdownMenu.Item>
            <DropdownMenu.Item disabled={!canOpenMore} onClick={() => fileInputRef.current?.click()}>
              Load JSON…
            </DropdownMenu.Item>
            {!canOpenMore && (
              <Text variant="caption-1" color="neutral-faded" className={css.MenuNote}>
                {MAX_OPEN_FILES} files are open, the most at once. Close one to open another.
              </Text>
            )}
          </DropdownMenu.Section>
          <DropdownMenu.Section>
            <DropdownMenu.Item onClick={files.startRename}>Rename…</DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => files.activeId && void files.requestClose(files.activeId)}>
              Close
            </DropdownMenu.Item>
          </DropdownMenu.Section>
          <DropdownMenu.Section>
            <DropdownMenu.Item onClick={() => editor && void downloadPNG(editor, activeName)}>
              Download PNG
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => editor && downloadJSON(editor, activeName)}>
              Save JSON
            </DropdownMenu.Item>
          </DropdownMenu.Section>
          <DropdownMenu.Section>
            <DropdownMenu.Item
              color="critical"
              disabled={!hasObjects}
              onClick={() => editor?.deleteAll()}
            >
              Clear canvas
            </DropdownMenu.Item>
          </DropdownMenu.Section>
        </DropdownMenu.Content>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleLoadJSONFile}
        hidden
      />
    </>
  )
}
