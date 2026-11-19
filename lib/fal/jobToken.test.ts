import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { signJob, verifyJob } from './jobToken'

const job = { endpoint: 'bria/rmbg-3', requestId: 'r1', viewerId: 'u1' }

describe('job tokens', () => {
  beforeEach(() => {
    vi.stubEnv('FAL_AI_API_KEY', 'test-key')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('verifies a fresh token for its owner', () => {
    expect(verifyJob(signJob(job), 'u1')).toMatchObject(job)
  })

  it("rejects someone else's token", () => {
    expect(verifyJob(signJob(job), 'u2')).toBeNull()
  })

  it('rejects a tampered payload or signature', () => {
    const [payload, signature] = signJob(job).split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), requestId: 'r2' })
    ).toString('base64url')
    expect(verifyJob(`${forged}.${signature}`, 'u1')).toBeNull()
    expect(verifyJob(`${payload}.${signature.slice(0, -2)}AA`, 'u1')).toBeNull()
  })

  it('rejects expired tokens and malformed input', () => {
    vi.useFakeTimers()
    const token = signJob(job)
    vi.advanceTimersByTime(11 * 60 * 1000)
    expect(verifyJob(token, 'u1')).toBeNull()
    for (const bad of [undefined, 123, '', 'nope', 'a.b.c', 'x'.repeat(3000)]) {
      expect(verifyJob(bad, 'u1')).toBeNull()
    }
  })

  it('invalidates tokens when the fal key rotates', () => {
    const token = signJob(job)
    vi.stubEnv('FAL_AI_API_KEY', 'rotated')
    expect(verifyJob(token, 'u1')).toBeNull()
  })
})
