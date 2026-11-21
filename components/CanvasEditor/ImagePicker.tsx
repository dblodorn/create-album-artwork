import { useCallback, useRef, useState } from 'react'
import { Button, Modal, Tabs, TextField, View } from 'reshaped'

import { Hint, Pill } from '@/design'

import css from './CanvasEditor.module.css'
import { Photo } from './icons'
import { ImageUploader } from './ImageUploader'
import { LoraBrowser } from './LoraBrowser'
import { PhotosBrowser } from './PhotosBrowser'

export function ImagePicker({
  onImageSelect,
  disabled,
  text = 'Add image',
}: {
  onImageSelect?: (image: string) => Promise<void>
  disabled?: boolean
  text?: string
}) {
  const [showModal, setShowModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  // Resolves true once the image is on the canvas. On failure onImageSelect has
  // already shown a toast, so the picker just stays open.
  const handleSelectImage = useCallback(
    async (image: string) => {
      if (busyRef.current) return false
      busyRef.current = true
      setBusy(true)
      try {
        await onImageSelect?.(image)
        setShowModal(false)
        return true
      } catch {
        return false
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [onImageSelect]
  )

  const handleUrlSubmit = useCallback(async () => {
    if (urlInput.trim() && (await handleSelectImage(urlInput.trim()))) {
      setUrlInput('')
    }
  }, [urlInput, handleSelectImage])

  return (
    <>
      <Hint text={text} position="end">
        {(attributes) => (
          <Button
            size="small"
            onClick={() => setShowModal(true)}
            icon={Photo}
            color="neutral"
            rounded
            disabled={disabled}
            attributes={{ ...attributes, 'aria-label': text }}
            className={css.CircleButton}
          />
        )}
      </Hint>
      <Modal
        active={showModal}
        onClose={() => setShowModal(false)}
        className={css.ImageGridWrapper}
      >
        <Tabs itemWidth="equal" defaultValue="upload">
          <Tabs.List>
            <Tabs.Item value="upload">Upload</Tabs.Item>
            <Tabs.Item value="url">URL</Tabs.Item>
            <Tabs.Item value="lora">LoRA</Tabs.Item>
            <Tabs.Item value="photos">Photos</Tabs.Item>
          </Tabs.List>
          <Tabs.Panel value="upload">
            <ImageUploader handleSelectImage={handleSelectImage} busy={busy} />
          </Tabs.Panel>
          <Tabs.Panel value="url">
            <View gap={4} paddingTop={6} align="center">
              <View width="80%">
                <TextField
                  name="imageUrl"
                  placeholder="https://example.com/image.png"
                  value={urlInput}
                  onChange={({ value }: any) => setUrlInput(value)}
                />
              </View>
              <Pill onClick={handleUrlSubmit} disabled={!urlInput.trim()} loading={busy}>
                Add image
              </Pill>
            </View>
          </Tabs.Panel>
          {/* Panels mount only while active, so nothing is fetched until opened. */}
          <Tabs.Panel value="lora">
            <LoraBrowser onSelect={handleSelectImage} />
          </Tabs.Panel>
          <Tabs.Panel value="photos">
            <PhotosBrowser onSelect={handleSelectImage} />
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </>
  )
}