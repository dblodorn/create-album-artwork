import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Small Fabric scenes in the export format, for seeding and Load JSON.
export const RECT_SCENE = {
  version: '7.0.0',
  objects: [{ type: 'Rect', left: 300, top: 300, width: 400, height: 400, fill: '#e4572e' }],
  background: '#ffe8a3',
}

export const TEXT_SCENE = {
  version: '7.0.0',
  objects: [{ type: 'Textbox', text: 'WORN', left: 500, top: 400, width: 600, fontSize: 120, fontFamily: 'Arial', fill: '#1d3557' }],
  background: '#ffffff',
}

// The fixture photo (64 × 48, opaque) embedded as a data URL, shown 400 × 300 on a magenta background.
const PHOTO_DATA_URL = `data:image/png;base64,${readFileSync(fileURLToPath(new URL('../mocks/images/photo.png', import.meta.url))).toString('base64')}`

export const IMAGE_SCENE = {
  version: '7.0.0',
  objects: [{ type: 'Image', src: PHOTO_DATA_URL, left: 300, top: 350, width: 64, height: 48, scaleX: 6.25, scaleY: 6.25 }],
  background: '#ff00ff',
}

export const jsonFile = (name: string, body: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(body)),
})
