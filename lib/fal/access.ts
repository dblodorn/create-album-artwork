import 'server-only'

import type { Viewer } from '@/lib/auth/session'

/*
 * Who may use fal-backed features. Runs are billed to the app owner's fal
 * account, so only addresses on `FAL_ALLOWED_EMAILS` (comma-separated,
 * case-insensitive) get in. Empty or unset admits nobody, and being a dmbk
 * admin doesn't count. Bring-your-own-key would replace this list.
 */

export function allowedEmails(): Set<string> {
  return new Set(
    (process.env.FAL_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function canUseBackgroundRemoval(viewer: Viewer | null): boolean {
  return !!viewer && allowedEmails().has(viewer.email.trim().toLowerCase())
}
