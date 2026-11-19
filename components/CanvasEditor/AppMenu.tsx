import { useState } from 'react'
import { Button, DropdownMenu } from 'reshaped'

import { ChangelogModal } from './ChangelogModal'
import { SHORTCUTS_OFF } from './lib/keyboard'

const REPO_URL = 'https://github.com/dblodorn/create-album-artwork'

export function AppMenu() {
  const [changelogOpen, setChangelogOpen] = useState(false)

  return (
    <>
      <DropdownMenu position="bottom-start">
        <DropdownMenu.Trigger>
          {(attributes) => (
            <Button
              size="small"
              variant="ghost"
              attributes={{ ...attributes, 'aria-label': 'Album Artwork' }}
            >
              <span aria-hidden>🎨</span>
            </Button>
          )}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content attributes={SHORTCUTS_OFF}>
          <DropdownMenu.Section>
            <DropdownMenu.Item onClick={() => setChangelogOpen(true)}>Changelog…</DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={() => window.open(REPO_URL, '_blank', 'noopener,noreferrer')}
            >
              View on GitHub
            </DropdownMenu.Item>
          </DropdownMenu.Section>
        </DropdownMenu.Content>
      </DropdownMenu>
      <ChangelogModal active={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  )
}
