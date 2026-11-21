import { useEffect, useRef } from 'react'
import { Button, Modal, Text, View } from 'reshaped'

import { Pill } from '@/design'

import css from './CanvasEditor.module.css'
import { Close } from './icons'
import { SHORTCUTS_OFF } from './lib/keyboard'
import { NAME_MAX } from './lib/openFiles'
import type { OpenFiles } from './lib/useOpenFiles'

/**
 * The open files as tabs, between the menus and the account control. The strip
 * scrolls sideways when the tabs don't fit; its edges fade, so the tabs read
 * as sliding under the fixed menus and account control.
 */
export function FileTabs({ files }: { files: OpenFiles }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const { activeId } = files

  // A vertical wheel over the strip scrolls it sideways (trackpads and
  // Shift+wheel already do).
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY) || strip.scrollWidth <= strip.clientWidth) return
      e.preventDefault()
      strip.scrollLeft += e.deltaY
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  }, [])

  // Keep the active tab in view: after a switch, New, Load, or a reload.
  useEffect(() => {
    if (!activeId) return
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-file-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId, files.files.length])

  return (
    <>
      <div ref={stripRef} className={css.FileTabs} role="tablist" aria-label="Open files">
        {files.files.map((file) => {
          const active = file.id === activeId
          return (
            <div key={file.id} className={css.FileTab} data-active={active || undefined} data-file-id={file.id}>
              {files.renamingId === file.id ? (
                <RenameInput
                  initial={file.name}
                  onDone={(name) => files.rename(file.id, name)}
                  onCancel={files.cancelRename}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={css.FileTabLabel}
                  title={file.name}
                  onClick={() => void files.switchTo(file.id)}
                  onDoubleClick={() => {
                    if (active) files.startRename()
                  }}
                >
                  {file.name}
                </button>
              )}
              <Button
                size="small"
                variant="ghost"
                rounded
                icon={Close}
                className={css.FileTabClose}
                attributes={{ 'aria-label': `Close ${file.name}` }}
                onClick={() => void files.requestClose(file.id)}
              />
            </div>
          )
        })}
      </div>
      <CloseFileModal files={files} />
    </>
  )
}

function RenameInput({
  initial,
  onDone,
  onCancel,
}: {
  initial: string
  onDone: (name: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      className={css.FileTabInput}
      defaultValue={initial}
      maxLength={NAME_MAX}
      aria-label="File name"
      onKeyDown={(e) => {
        if (e.key === 'Enter') ref.current?.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          onCancel()
        }
      }}
      onBlur={(e) => {
        if (!cancelled.current) onDone(e.currentTarget.value)
      }}
    />
  )
}

function CloseFileModal({ files }: { files: OpenFiles }) {
  const file = files.pendingClose
  return (
    <Modal
      active={!!file}
      onClose={files.cancelClose}
      size="420px"
      ariaLabel="Close file"
      attributes={SHORTCUTS_OFF}
    >
      <View gap={4}>
        <Modal.Title>Close “{file?.name}”?</Modal.Title>
        <Text>
          Its work will be lost. Files are only kept in this browser, so it can&apos;t be
          recovered. Save JSON first to keep a copy.
        </Text>
        <View direction="row" gap={2} justify="end">
          <Pill onClick={files.cancelClose}>Cancel</Pill>
          <Pill color="critical" onClick={() => void files.confirmClose()}>
            Close
          </Pill>
        </View>
      </View>
    </Modal>
  )
}
