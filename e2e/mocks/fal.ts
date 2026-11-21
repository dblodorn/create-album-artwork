// Background removal: submit → one pending poll → done, with the cutout served
// from a fal media URL the `net` fixture intercepts.
export const CUTOUT_URL = 'https://v3.fal.media/files/e2e/cutout.png'
export const SUBMIT = { job: 'e2e-job' }
export const PENDING = { status: 'pending' }
export const DONE = { status: 'done', image: { url: CUTOUT_URL } }
export type FalError = 'unauthenticated' | 'forbidden' | 'not_configured' | 'bad_request'
