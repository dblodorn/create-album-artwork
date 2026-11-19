import { afterEach, describe, expect, it } from 'vitest'

import type { Viewer } from '@/lib/auth/session'

import { allowedEmails, canUseBackgroundRemoval } from './access'

const viewer = (email: string, isAdmin = false): Viewer => ({
  id: 'u1',
  email,
  name: null,
  image: null,
  isAdmin,
})

describe('canUseBackgroundRemoval', () => {
  const original = process.env.FAL_ALLOWED_EMAILS
  afterEach(() => {
    process.env.FAL_ALLOWED_EMAILS = original
  })

  it('admits nobody when the list is unset or empty', () => {
    delete process.env.FAL_ALLOWED_EMAILS
    expect(canUseBackgroundRemoval(viewer('dain@db13.us'))).toBe(false)
    process.env.FAL_ALLOWED_EMAILS = ' , '
    expect(canUseBackgroundRemoval(viewer('dain@db13.us'))).toBe(false)
  })

  it('matches case- and whitespace-insensitively', () => {
    process.env.FAL_ALLOWED_EMAILS = ' Dain@DB13.us , x@y.z'
    expect(allowedEmails()).toEqual(new Set(['dain@db13.us', 'x@y.z']))
    expect(canUseBackgroundRemoval(viewer('DAIN@db13.us '))).toBe(true)
  })

  it('ignores admin status and refuses the signed out', () => {
    process.env.FAL_ALLOWED_EMAILS = 'dain@db13.us'
    expect(canUseBackgroundRemoval(viewer('boss@example.com', true))).toBe(false)
    expect(canUseBackgroundRemoval(null)).toBe(false)
  })
})
