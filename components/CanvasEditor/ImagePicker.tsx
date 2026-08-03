import { useCallback, useState } from 'react'
import { Button, Modal, Tabs, TextField, Tooltip, View } from 'reshaped'

import css from './CanvasEditor.module.css'
import { Photo } from './icons'
import { ImageUploader } from './ImageUploader'

export function ImagePicker({
  onImageSelect,
  disabled,
  text = 'Add image',
}: {
  onImageSelect?: (image: string) => void
  disabled?: boolean
  text?: string
}) {
  const [showModal, setShowModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const handleSelectImage = useCallback(
    (image: string) => {
      onImageSelect?.(image)
      setShowModal(false)
    },
    [setShowModal, onImageSelect]
  )

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      handleSelectImage(urlInput.trim())
      setUrlInput('')
    }
  }, [urlInput, handleSelectImage])

  return (
    <>
      <Tooltip text={text} position="end">
        {(attributes) => (
          <Button
            size="small"
            onClick={() => setShowModal(true)}
            icon={Photo}
            color="neutral"
            rounded
            disabled={disabled}
            attributes={attributes}
            className={css.CircleButton}
          />
        )}
      </Tooltip>
      <Modal
        active={showModal}
        onClose={() => setShowModal(false)}
        className={css.ImageGridWrapper}
      >
        <Tabs itemWidth="equal" defaultValue="upload">
          <Tabs.List>
            <Tabs.Item value="upload">Upload</Tabs.Item>
            <Tabs.Item value="url">URL</Tabs.Item>
          </Tabs.List>
          <Tabs.Panel value="upload">
            <ImageUploader handleSelectImage={handleSelectImage} />
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
              <Button
                rounded
                size="large"
                variant="solid"
                color="neutral"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
              >
                Add Image
              </Button>
            </View>
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </>
  )
}