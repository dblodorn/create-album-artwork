import { Button, DropdownMenu } from 'reshaped'

import css from './CanvasEditor.module.css'
import { MENU_GROUPS, type MenuCommandId } from './lib/commands'
import { SHORTCUTS_OFF } from './lib/keyboard'
import type { EditCommand } from './lib/useEditCommands'

export function EditMenu({ commands }: { commands: Record<MenuCommandId, EditCommand> }) {
  return (
    <DropdownMenu position="bottom-start">
      <DropdownMenu.Trigger>
        {(attributes) => (
          <Button size="small" variant="ghost" attributes={attributes}>
            Edit
          </Button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content attributes={SHORTCUTS_OFF}>
        {MENU_GROUPS.map((group) => (
          <DropdownMenu.Section key={group[0]}>
            {group.map((id) => {
              const command = commands[id]
              return (
                <DropdownMenu.Item
                  key={id}
                  onClick={command.run}
                  disabled={!command.enabled}
                  endSlot={<span className={css.MenuShortcut}>{command.shortcut}</span>}
                >
                  {command.label}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Section>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
