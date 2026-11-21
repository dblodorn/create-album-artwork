// Small Fabric scenes in the export format, for seeding and Load JSON.
export const RECT_SCENE = {
  version: '7.0.0',
  objects: [{ type: 'Rect', left: 300, top: 300, width: 400, height: 400, fill: '#e4572e' }],
  background: '#ffe8a3',
}

export const jsonFile = (name: string, body: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(body)),
})
