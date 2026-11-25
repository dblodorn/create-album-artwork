import { useState } from 'react'
import { Button, DropdownMenu } from 'reshaped'

import { COLOR_MODE_CHOICES, type ColorModeChoice, useColorMode } from '@/design'

import { ChangelogModal } from './ChangelogModal'
import { ColophonModal } from './ColophonModal'
import { SHORTCUTS_OFF } from './lib/keyboard'

const REPO_URL = 'https://github.com/dblodorn/create-album-artwork'

const APPEARANCE_LABELS: Record<ColorModeChoice, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

export function AppMenu() {
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [colophonOpen, setColophonOpen] = useState(false)
  const { choice, setChoice } = useColorMode()

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
            <DropdownMenu.Item onClick={() => setColophonOpen(true)}>Colophon…</DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={() => window.open(REPO_URL, '_blank', 'noopener,noreferrer')}
            >
              View on GitHub
            </DropdownMenu.Item>
          </DropdownMenu.Section>
          {/* A radio group: the current choice is checked (✓). Reshaped's `selected`
              styling greys the label, so it would read as disabled. */}
          <DropdownMenu.Section>
            {COLOR_MODE_CHOICES.map((option) => (
              <DropdownMenu.Item
                key={option}
                endSlot={option === choice ? <span aria-hidden>✓</span> : undefined}
                onClick={() => setChoice(option)}
                attributes={{ role: 'menuitemradio', 'aria-checked': option === choice }}
              >
                {APPEARANCE_LABELS[option]}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Section>
        </DropdownMenu.Content>
      </DropdownMenu>
      <ChangelogModal active={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <ColophonModal active={colophonOpen} onClose={() => setColophonOpen(false)} />
    </>
  )
}
