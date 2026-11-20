import { useEffect, useState } from 'react'
import { Loader, Modal, Text, View } from 'reshaped'

import { Pill } from '@/design'

import type { ChangelogEntry } from '@/lib/changelog'

import css from './CanvasEditor.module.css'
import { SHORTCUTS_OFF } from './lib/keyboard'

export function ChangelogModal({ active, onClose }: { active: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  // Fetched once, the first time the modal opens.
  useEffect(() => {
    if (!active || entries) return
    let cancelled = false
    fetch('/api/changelog')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { entries: ChangelogEntry[] }) => !cancelled && setEntries(body.entries))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [active, entries])

  return (
    <Modal active={active} onClose={onClose} size="520px" attributes={SHORTCUTS_OFF}>
      <View gap={4}>
        <View direction="row" justify="space-between" align="center">
          <Modal.Title>Changelog</Modal.Title>
          <Pill onClick={onClose}>
            Close
          </Pill>
        </View>
        <div className={css.Changelog}>
          {failed && <Text color="critical">Couldn't load the changelog.</Text>}
          {!failed && !entries && <Loader />}
          {entries?.map((entry) => (
            <section key={`${entry.date}-${entry.title}`} className={css.ChangelogEntry}>
              <Text variant="body-2" weight="medium">
                {entry.title || entry.date}
              </Text>
              <Text variant="caption-1" color="neutral-faded">
                {entry.date}
              </Text>
              <ul>
                {entry.items.map((item) => (
                  <li key={item}>
                    <Text variant="body-3">{item}</Text>
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
