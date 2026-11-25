import { Modal, Text, View } from 'reshaped'

import { Pill } from '@/design'

import { COLOPHON } from '@/lib/colophon'

import css from './CanvasEditor.module.css'
import { SHORTCUTS_OFF } from './lib/keyboard'

const headingId = (heading: string) => `colophon-${heading.toLowerCase().replace(/\s+/g, '-')}`

export function ColophonModal({ active, onClose }: { active: boolean; onClose: () => void }) {
  return (
    <Modal active={active} onClose={onClose} size="520px" attributes={SHORTCUTS_OFF}>
      <View gap={4}>
        <View direction="row" justify="space-between" align="center">
          <Modal.Title>Colophon</Modal.Title>
          <Pill onClick={onClose}>
            Close
          </Pill>
        </View>
        <div className={css.Colophon}>
          {COLOPHON.map((section) => (
            <section key={section.heading} aria-labelledby={headingId(section.heading)}>
              <Text as="h3" variant="caption-1" color="neutral-faded" attributes={{ id: headingId(section.heading) }}>
                {section.heading}
              </Text>
              <ul>
                {section.entries.map((entry) => (
                  <li key={entry.url}>
                    <a href={entry.url} target="_blank" rel="noopener noreferrer">
                      <Text as="span" variant="body-2">
                        {entry.name}
                      </Text>
                    </a>
                    <Text variant="body-3" color="neutral-faded">
                      {entry.note}
                    </Text>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </View>
    </Modal>
  )
}
