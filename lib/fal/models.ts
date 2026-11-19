/*
 * Background-removal models the app offers. The browser only ever sends an
 * id from this table; the server maps it to a fal endpoint and its input.
 * No secrets here, so the client imports the same list for its picker.
 */

export const MAX_PROMPT_LENGTH = 300

type Model = {
  label: string
  description: string
  supportsPrompt: boolean
  endpoint: string
  toInput: (imageUrl: string, prompt?: string) => Record<string, unknown>
}

const MODELS = {
  'rmbg-3': {
    label: 'Bria RMBG 3.0',
    description: 'Best on hard edges (hair, mesh, reflections). Can keep only what you name.',
    supportsPrompt: true,
    endpoint: 'bria/rmbg-3',
    toInput: (image_url, prompt) => (prompt ? { image_url, prompt } : { image_url }),
  },
  birefnet: {
    label: 'BiRefNet v2',
    description: 'Fastest and cheapest. Good for clear subjects.',
    supportsPrompt: false,
    endpoint: 'fal-ai/birefnet/v2',
    // 2048 matches the editor's longest-edge cap for image layers.
    toInput: (image_url) => ({
      image_url,
      model: 'General Use (Light)',
      operating_resolution: '2048x2048',
      output_format: 'png',
    }),
  },
  pixelcut: {
    label: 'Pixelcut',
    description: 'Clean product-style cutouts.',
    supportsPrompt: false,
    endpoint: 'pixelcut/background-removal',
    // sync_mode defaults to true here, which would inline the result.
    toInput: (image_url) => ({ image_url, output_format: 'rgba', sync_mode: false }),
  },
} satisfies Record<string, Model>

export type ModelId = keyof typeof MODELS

export const DEFAULT_MODEL: ModelId = 'rmbg-3'

export const isModelId = (id: unknown): id is ModelId =>
  typeof id === 'string' && Object.hasOwn(MODELS, id)

export const getModel = (id: ModelId): Model => MODELS[id]

/** What the picker shows: id, label, description, prompt support. */
export const MODEL_OPTIONS = (Object.keys(MODELS) as ModelId[]).map((id) => ({
  id,
  label: MODELS[id].label,
  description: MODELS[id].description,
  supportsPrompt: MODELS[id].supportsPrompt,
}))
