'use client'

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

/*
 * The session, from the browser's side. The session token is an HTTP-only
 * cookie this code can't read; it only asks `/api/session` who is signed in,
 * and posts a Google ID token there to sign in.
 *
 * This is for deciding what UI to show. A gate that protects something must
 * check on the server, with `viewerFromRequest()` / `requireViewer()`.
 */

export type Viewer = {
  id: string
  email: string
  name: string | null
  image: string | null
  isAdmin: boolean
}

/** Gated features the server says this viewer can use. UI only. */
export type Features = { backgroundRemoval: boolean; photos: boolean }

const NO_FEATURES: Features = { backgroundRemoval: false, photos: false }

export type SessionStatus = 'loading' | 'signed-in' | 'signed-out' | 'unavailable'

/** Why a sign-in didn't produce a session, worded for the person signing in. */
export class SignInError extends Error {}

type SessionValue = {
  viewer: Viewer | null
  status: SessionStatus
  isAdmin: boolean
  features: Features
  signIn: (idToken: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [features, setFeatures] = useState<Features>(NO_FEATURES)

  useEffect(() => {
    let cancelled = false
    fetch('/api/session', { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json()) as {
          viewer: Viewer | null
          features?: Features
          error?: string
        }
        if (cancelled) return
        setViewer(body.viewer)
        setFeatures(body.viewer ? (body.features ?? NO_FEATURES) : NO_FEATURES)
        setStatus(
          body.viewer ? 'signed-in' : body.error === 'unavailable' ? 'unavailable' : 'signed-out'
        )
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (idToken: string) => {
    let res: Response
    try {
      res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
    } catch {
      throw new SignInError("Sign-in isn't available right now. Try again shortly.")
    }
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string }
      throw new SignInError(
        error === 'refused'
          ? "This Google account isn't allowed to sign in."
          : "Sign-in isn't available right now. Try again shortly."
      )
    }
    const { viewer, features } = (await res.json()) as { viewer: Viewer; features?: Features }
    setViewer(viewer)
    setFeatures(features ?? NO_FEATURES)
    setStatus('signed-in')
  }, [])

  const signOut = useCallback(async () => {
    // The server clears the cookie even if the API can't be reached.
    await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined)
    setViewer(null)
    setFeatures(NO_FEATURES)
    setStatus('signed-out')
  }, [])

  const value = useMemo(
    () => ({ viewer, status, isAdmin: viewer?.isAdmin ?? false, features, signIn, signOut }),
    [viewer, status, features, signIn, signOut]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useViewer(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useViewer must be used inside <SessionProvider>.')
  return value
}
