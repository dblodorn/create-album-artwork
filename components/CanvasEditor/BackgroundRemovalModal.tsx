import type { FabricImage } from 'fabric'
import { useEffect, useState } from 'react'
import { Checkbox, Loader, Modal, Radio, RadioGroup, Text, TextArea, View } from 'reshaped'

import { Pill } from '@/design'

import { DEFAULT_MODEL, MAX_PROMPT_LENGTH, MODEL_OPTIONS, type ModelId } from '@/lib/fal/models'
import { useBackgroundRemoval } from '@/lib/fal/useBackgroundRemoval'

import css from './CanvasEditor.module.css'
import { SHORTCUTS_OFF } from './lib/keyboard'

export function BackgroundRemovalModal({
  target,
  onClose,
  onApply,
}: {
  // The image layer being processed; null when closed.
  target: FabricImage | null
  onClose: () => void
  onApply: (result: string, keepOriginal: boolean) => Promise<void>
}) {
  const { state, run, reset } = useBackgroundRemoval()
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL)
  const [prompt, setPrompt] = useState('')
  const [keepOriginal, setKeepOriginal] = useState(false)
  const [applying, setApplying] = useState(false)

  // Each opening starts fresh; Keep original is always off to begin with.
  useEffect(() => {
    if (!target) return
    reset()
    setModel(DEFAULT_MODEL)
    setPrompt('')
    setKeepOriginal(false)
  }, [target, reset])

  const close = () => {
    reset()
    onClose()
  }

  const supportsPrompt = MODEL_OPTIONS.find((option) => option.id === model)?.supportsPrompt
  const remove = () => target && run(target, model, supportsPrompt ? prompt : '')

  const apply = async () => {
    if (state.phase !== 'preview' || applying) return
    setApplying(true)
    try {
      await onApply(state.result, keepOriginal)
      close()
    } finally {
      setApplying(false)
    }
  }

  const source = target?.getSrc()
  const working = state.phase === 'working'

  return (
    <Modal
      active={!!target}
      onClose={close}
      size="480px"
      ariaLabel="Remove background"
      attributes={SHORTCUTS_OFF}
    >
      <View gap={4}>
        <Modal.Title>Remove background</Modal.Title>

        <div className={css.CutoutPreview}>
          {state.phase === 'preview' ? (
            <img src={state.result} alt="Background removed" />
          ) : (
            source && <img src={source} alt="Selected image" />
          )}
          {working && (
            <div className={css.CutoutWorking}>
              <Loader size="medium" />
              <Text variant="caption-1">Removing background…</Text>
            </div>
          )}
        </div>

        {state.phase === 'error' && (
          <Text variant="body-2" color="critical" attributes={{ role: 'alert' }}>
            {state.message}
          </Text>
        )}

        {state.phase !== 'preview' && (
          <View gap={3}>
            <RadioGroup
              name="bg-removal-model"
              value={model}
              onChange={({ value }) => setModel(value as ModelId)}
              disabled={working}
            >
              <View gap={2}>
                {MODEL_OPTIONS.map((option) => (
                  <Radio key={option.id} value={option.id}>
                    <Text variant="body-2" weight="medium">
                      {option.label}
                    </Text>
                    <Text variant="caption-1" color="neutral-faded">
                      {option.description}
                    </Text>
                  </Radio>
                ))}
              </View>
            </RadioGroup>

            {supportsPrompt && (
              <View gap={1}>
                <Text variant="body-2" weight="medium">
                  What to keep <Text as="span" color="neutral-faded">(optional)</Text>
                </Text>
                <TextArea
                  name="bg-removal-prompt"
                  value={prompt}
                  onChange={({ value }) => setPrompt(value.slice(0, MAX_PROMPT_LENGTH))}
                  placeholder="e.g. only the guitar"
                  disabled={working}
                  inputAttributes={{ maxLength: MAX_PROMPT_LENGTH, rows: 2 }}
                />
              </View>
            )}
          </View>
        )}

        <Checkbox
          name="bg-removal-keep-original"
          checked={keepOriginal}
          onChange={({ checked }) => setKeepOriginal(checked)}
          disabled={working || applying}
        >
          Keep original (add the cutout as a new layer above it)
        </Checkbox>

        <View direction="row" gap={2} justify="end">
          <Pill onClick={close}>
            Cancel
          </Pill>
          {state.phase === 'preview' ? (
            <>
              <Pill onClick={reset} disabled={applying}>
                Try again
              </Pill>
              <Pill color="primary" onClick={apply} loading={applying}>
                Apply
              </Pill>
            </>
          ) : (
            <Pill color="primary" onClick={remove} disabled={working || !target}>
              {state.phase === 'error' ? 'Try again' : 'Remove'}
            </Pill>
          )}
        </View>
      </View>
    </Modal>
  )
}
