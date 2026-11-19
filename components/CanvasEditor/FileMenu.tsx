import { useRef } from 'react'
import { Button, DropdownMenu, useToast } from 'reshaped'

import { SHORTCUTS_OFF } from './lib/keyboard'
import { downloadJSON, downloadPNG, loadJSON } from './lib/uploadCanvas'
import type { FabricJSEditor } from './lib/useFabricJSEditor'
import type { History } from './lib/useHistory'

export function FileMenu({
  editor,
  history,
  hasObjects,
  onSceneLoaded,
}: {
  editor: FabricJSEditor | undefined
  history: History
  hasObjects: boolean
  onSceneLoaded?: () => void
}) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLoadJSONFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!editor || !file) return
    try {
      const dropped = await loadJSON(editor, file)
      // A loaded scene starts a fresh history.
      history.reset()
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
            <DropdownMenu.Item onClick={() => editor && void downloadPNG(editor)}>
              Download PNG
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => editor && downloadJSON(editor)}>
              Save JSON
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => fileInputRef.current?.click()}>
              Load JSON…
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
