import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, DropdownMenu, Loader, Text, View, useToast } from 'reshaped'

import css from './CanvasEditor.module.css'
import { useColorMode } from '@/design'
import { SignInError, type Viewer, useViewer } from '@/lib/auth/client'

/*
 * Sign-in control and account menu, at the right end of the top bar.
 *
 * Google Identity Services renders the button and hands back an ID token for
 * the shared dmbk OAuth client; `/api/session` trades it with the accounts API
 * for a session. GIS only renders on the client's authorized JavaScript
 * origins (sleeve.dmbk.io, create-album-artwork.vercel.app, localhost:3000),
 * so Vercel preview URLs can't sign in.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

type GoogleId = {
  initialize(config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    ux_mode?: 'popup' | 'redirect'
  }): void
  renderButton(
    parent: HTMLElement,
    options: { type?: string; theme?: string; size?: string; text?: string; shape?: string }
  ): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

// GIS holds one global config and warns when it's initialized again, which
// remounting the button (after sign-out) would do. Initialize once and route
// its callback to whichever button is mounted.
type CredentialHandler = (response: { credential?: string }) => void
let credentialHandler: CredentialHandler | null = null
let gisInitialized = false

export function AccountMenu() {
  const { viewer, status } = useViewer()

  return (
    <div className={css.AccountSlot}>
      {status === 'loading' ? null : viewer ? (
        <SignedIn viewer={viewer} />
      ) : (
        <SignInButton />
      )}
    </div>
  )
}

function SignInButton() {
  const { signIn } = useViewer()
  const { mode } = useColorMode()
  const toast = useToast()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== 'undefined' && !!window.google?.accounts?.id
  )
  const [scriptFailed, setScriptFailed] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  const onCredential = useCallback(
    async ({ credential }: { credential?: string }) => {
      if (!credential) {
        toast.show({ color: 'critical', text: "Google didn't return a sign-in. Try again." })
        return
      }
      setSigningIn(true)
      try {
        await signIn(credential)
      } catch (err) {
        toast.show({
          color: 'critical',
          text: err instanceof SignInError ? err.message : "Sign-in isn't available right now.",
        })
      } finally {
        setSigningIn(false)
      }
    },
    [signIn, toast]
  )

  useEffect(() => {
    const id = window.google?.accounts?.id
    if (!scriptReady || !id || !CLIENT_ID || !buttonRef.current) return
    credentialHandler = onCredential
    if (!gisInitialized) {
      id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => credentialHandler?.(response),
        ux_mode: 'popup',
      })
      gisInitialized = true
    }
    // GIS draws the button itself, so it can't follow the theme's tokens:
    // re-render it with the matching Google theme when the colour mode changes.
    buttonRef.current.replaceChildren()
    id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: mode === 'dark' ? 'filled_black' : 'outline',
      size: 'medium',
      text: 'signin',
      shape: 'pill',
    })
  }, [scriptReady, onCredential, mode])

  if (!CLIENT_ID || scriptFailed) {
    return (
      <Text variant="caption-1" color="neutral-faded">
        Sign-in unavailable
      </Text>
    )
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setScriptFailed(true)}
      />
      {signingIn && <Loader size="small" ariaLabel="Signing in" />}
      {/* Google renders into this; kept mounted while signing in so a failed
          attempt can be retried without reloading. */}
      <div ref={buttonRef} className={css.GoogleButton} hidden={signingIn} />
    </>
  )
}

function SignedIn({ viewer }: { viewer: Viewer }) {
  const { signOut } = useViewer()
  const [imageFailed, setImageFailed] = useState(false)
  const label = viewer.name || viewer.email
  const src = viewer.image && !imageFailed ? viewer.image : undefined

  return (
    <DropdownMenu position="bottom-end">
      <DropdownMenu.Trigger>
        {(attributes) => (
          <button
            {...attributes}
            type="button"
            className={css.AvatarButton}
            aria-label={`Account: ${label}`}
            title={label}
          >
            <Avatar
              size={7}
              src={src}
              alt=""
              initials={initialsFor(viewer)}
              imageAttributes={{
                referrerPolicy: 'no-referrer',
                onError: () => setImageFailed(true),
              }}
            />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <View paddingInline={3} paddingBlock={2} gap={0.5}>
          {viewer.name && (
            <Text variant="body-3" weight="medium">
              {viewer.name}
            </Text>
          )}
          <Text variant="caption-1" color="neutral-faded">
            {viewer.email}
          </Text>
        </View>
        <DropdownMenu.Section>
          <DropdownMenu.Item onClick={() => void signOut()}>Sign out</DropdownMenu.Item>
        </DropdownMenu.Section>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}

// First letters of the name's first two words, or the email's first letter.
function initialsFor({ name, email }: Viewer): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  const letters = words.length
    ? words.slice(0, 2).map((word) => word[0])
    : [email[0]]
  return letters.join('').toUpperCase()
}
