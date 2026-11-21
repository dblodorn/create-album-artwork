import type { Features } from '@/lib/auth/client'
import type { Viewer } from '@/lib/auth/session'

// GET /api/session bodies for each sign-in state. Signed out is also the app's
// own answer with no Google client ID, but stating it keeps tests explicit.
export type SessionState = 'signed-out' | 'signed-in' | 'allowed' | 'admin'

const viewer = (isAdmin: boolean): Viewer => ({
  id: 'e2e-viewer',
  email: 'e2e@example.test',
  name: 'E2E Tester',
  image: null,
  isAdmin,
})

export const SESSIONS = {
  'signed-out': { viewer: null, features: { backgroundRemoval: false, photos: false } },
  'signed-in': { viewer: viewer(false), features: { backgroundRemoval: false, photos: false } },
  allowed: { viewer: viewer(false), features: { backgroundRemoval: true, photos: false } },
  admin: { viewer: viewer(true), features: { backgroundRemoval: true, photos: true } },
} satisfies Record<SessionState, { viewer: Viewer | null; features: Features }>
