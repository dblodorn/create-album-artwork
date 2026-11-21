import type { Operations } from '@/lib/dmbk/client'

// Canned /api/dmbk results, typed against the client's own result types, so a
// change to the API's shape breaks `tsc` here instead of passing silently.
// Image URLs point at the fixture host the `net` fixture serves.
export const FIXTURE_HOST = 'https://fixtures.e2e'
export const PHOTO_URL = `${FIXTURE_HOST}/photo.png`

const image = (id: string, prompt: string) => ({
  id,
  url: `${PHOTO_URL}?${id}`,
  prompt,
  width: 64,
  height: 48,
  createdAt: '2026-11-01T00:00:00.000Z',
})

export const DMBK = {
  LoraTrainings: {
    loraTrainerTrainings: {
      edges: [
        {
          cursor: 'c1',
          node: {
            id: 'lora-1',
            triggerWord: 'NEONCITY',
            status: 'COMPLETED',
            createdAt: '2026-11-01T00:00:00.000Z',
            trainingImageUrls: [PHOTO_URL],
            images: { edges: [{ node: image('img-1', 'neon city at dusk') }] },
          },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: 'c1' },
    },
  },
  LoraTrainingImages: {
    node: {
      id: 'lora-1',
      triggerWord: 'NEONCITY',
      images: {
        edges: [
          { cursor: 'i1', node: image('img-1', 'neon city at dusk') },
          { cursor: 'i2', node: image('img-2', 'neon city in rain') },
        ],
        pageInfo: { hasNextPage: false, endCursor: 'i2' },
      },
    },
  },
  DmbkPhotos: {
    dmbkPhotos: {
      edges: [
        {
          cursor: 'p1',
          node: {
            id: 'photo-1',
            title: 'Harbour',
            hidden: false,
            width: 64,
            height: 48,
            thumbUrl: `${PHOTO_URL}?thumb`,
            displayUrl: `${PHOTO_URL}?display`,
          },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: 'p1' },
    },
  },
} satisfies { [Op in keyof Operations]: Operations[Op]['result'] }
