import type { FabricObject } from 'fabric'
import { useCallback, useEffect, useRef, useState } from 'react'

import { HistoryStack, type Snapshot, captureSnapshot, restoreSnapshot } from './history'
import { isText } from './objectTypes'
import type { FabricJSEditor } from './useFabricJSEditor'

/*
 * Records undo steps from the same signals autosave and the Layers panel use:
 * Fabric's object events and `editor.commit(label)`. Everything in one
 * animation frame becomes one step, so a Clear of ten objects is one undo.
 * `reset()` runs once the saved scene is restored, dropping the steps the
 * restore itself produced.
 */

type ModifiedEvent = { action?: string; target?: FabricObject }

const labelForModified = ({ action, target }: ModifiedEvent): string => {
  if (action === 'drag') return 'Move'
  if (action?.startsWith('scale')) return 'Scale'
  if (action === 'rotate') return 'Rotate'
  if (!action && isText(target)) return 'Edit Text'
  return 'Edit'
}

export type History = {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
  undo: () => void
  redo: () => void
  /** Starts over from the current scene (after load), and starts recording. */
  reset: () => void
  /** Runs `fn` and records everything it changes as one step named `label`. */
  transaction: (label: string, fn: () => unknown) => Promise<void>
  /** Marks the next commit as a nudge, so quick runs merge into one step. */
  markNudge: () => void
}

type Controls = Omit<History, 'canUndo' | 'canRedo' | 'undoLabel' | 'redoLabel'> & {
  stack: HistoryStack<Snapshot>
}

const noop = () => {}

export function useHistory(editor: FabricJSEditor | undefined): History {
  const [, setVersion] = useState(0)
  const controls = useRef<Controls | null>(null)

  useEffect(() => {
    if (!editor) return
    const { canvas } = editor
    const stack = new HistoryStack(captureSnapshot(canvas))
    const bump = () => setVersion((v) => v + 1)

    // Records from the start (so a Fast Refresh remount keeps working); the
    // reset after the initial restore drops anything recorded before it.
    let ready = true
    let restoring = false
    let frame = 0
    let dirty = false
    let eventLabel: string | null = null
    let commitLabel: string | null = null
    let txLabel: string | null = null
    let txDepth = 0
    let mergeKey: string | undefined
    let editingText = false
    let textBeforeEditing: string | undefined

    const clearPending = () => {
      dirty = false
      eventLabel = commitLabel = txLabel = null
      mergeKey = undefined
    }

    const flush = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (!ready || restoring || txDepth || !dirty) return
      stack.push(txLabel ?? commitLabel ?? eventLabel ?? 'Edit', captureSnapshot(canvas), mergeKey)
      clearPending()
      bump()
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush)
    }

    const signal = (label: string) => {
      if (!ready || restoring || editingText) return
      dirty = true
      eventLabel ??= label
      schedule()
    }

    const onAdded = () => signal('Add')
    const onRemoved = () => signal('Delete')
    const onModified = (e: ModifiedEvent) => signal(labelForModified(e))
    // Typing is one step, recorded when inline editing ends.
    const onEditingEntered = ({ target }: { target?: FabricObject }) => {
      editingText = true
      textBeforeEditing = isText(target) ? target.text : undefined
    }
    const onEditingExited = ({ target }: { target?: FabricObject }) => {
      editingText = false
      if (isText(target) && target.text !== textBeforeEditing) signal('Edit Text')
    }
    const unsubscribe = editor.subscribe((label) => {
      if (!ready || restoring) return
      dirty = true
      if (label) commitLabel ??= label
      schedule()
    })

    canvas.on('object:added', onAdded)
    canvas.on('object:removed', onRemoved)
    canvas.on('object:modified', onModified)
    canvas.on('text:editing:entered', onEditingEntered)
    canvas.on('text:editing:exited', onEditingExited)

    const apply = (snapshot: Snapshot | null) => {
      if (!snapshot) return
      restoring = true
      try {
        restoreSnapshot(canvas, snapshot)
        // Autosave and the Layers panel follow commits; history ignores this one.
        editor.commit()
      } finally {
        restoring = false
      }
      clearPending()
      bump()
    }

    controls.current = {
      stack,
      undo: () => {
        flush()
        apply(stack.undo())
      },
      redo: () => {
        flush()
        apply(stack.redo())
      },
      reset: () => {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        clearPending()
        stack.reset(captureSnapshot(canvas))
        ready = true
        bump()
      },
      transaction: async (label, fn) => {
        flush()
        txDepth++
        try {
          await fn()
        } finally {
          txDepth--
          if (!txDepth && dirty) {
            txLabel = label
            flush()
          }
        }
      },
      markNudge: () => {
        mergeKey = 'nudge'
      },
    }
    bump()

    return () => {
      unsubscribe()
      canvas.off('object:added', onAdded)
      canvas.off('object:removed', onRemoved)
      canvas.off('object:modified', onModified)
      canvas.off('text:editing:entered', onEditingEntered)
      canvas.off('text:editing:exited', onEditingExited)
      if (frame) cancelAnimationFrame(frame)
      controls.current = null
    }
  }, [editor])

  const undo = useCallback(() => controls.current?.undo(), [])
  const redo = useCallback(() => controls.current?.redo(), [])
  const reset = useCallback(() => controls.current?.reset(), [])
  const transaction = useCallback(
    async (label: string, fn: () => unknown) => {
      if (controls.current) await controls.current.transaction(label, fn)
      else await fn()
    },
    []
  )
  const markNudge = useCallback(() => controls.current?.markNudge() ?? noop(), [])

  const stack = controls.current?.stack
  return {
    canUndo: stack?.canUndo ?? false,
    canRedo: stack?.canRedo ?? false,
    undoLabel: stack?.undoLabel ?? null,
    redoLabel: stack?.redoLabel ?? null,
    undo,
    redo,
    reset,
    transaction,
    markNudge,
  }
}
