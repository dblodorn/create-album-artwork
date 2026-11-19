import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * A fal run, handed to the browser as a signed token instead of a raw request
 * id. It names the run's owner, so status and cancel only work for the person
 * who started it, without a database. Signed with a key derived from the fal
 * key (no extra secret); rotating that key invalidates runs in flight.
 */

export type Job = { endpoint: string; requestId: string; viewerId: string; exp: number }

const TTL_MS = 10 * 60 * 1000

const signingKey = () => {
  const falKey = process.env.FAL_AI_API_KEY
  if (!falKey) throw new Error('FAL_AI_API_KEY is not set.')
  return createHmac('sha256', falKey).update('bg-removal-job-v1').digest()
}

const sign = (payload: string) =>
  createHmac('sha256', signingKey()).update(payload).digest('base64url')

export function signJob(job: Omit<Job, 'exp'>): string {
  const payload = Buffer.from(JSON.stringify({ ...job, exp: Date.now() + TTL_MS })).toString(
    'base64url'
  )
  return `${payload}.${sign(payload)}`
}

/** The job, or null if the token is forged, expired or someone else's. */
export function verifyJob(token: unknown, viewerId: string): Job | null {
  if (typeof token !== 'string' || token.length > 2048) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null

  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  try {
    const job = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Job
    if (typeof job.exp !== 'number' || job.exp < Date.now()) return null
    if (job.viewerId !== viewerId) return null
    if (typeof job.endpoint !== 'string' || typeof job.requestId !== 'string') return null
    return job
  } catch {
    return null
  }
}
