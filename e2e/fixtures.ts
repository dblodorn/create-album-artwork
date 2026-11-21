import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { type Page, test as base, expect } from '@playwright/test'

import { E2E_GLOBAL, type E2EHook } from '@/components/CanvasEditor/lib/useE2EHook'

import { DMBK, FIXTURE_HOST } from './mocks/dmbk'
import { CUTOUT_URL, DONE, type FalError, PENDING, SUBMIT } from './mocks/fal'
import { SESSIONS, type SessionState } from './mocks/session'

const image = (name: string) => readFileSync(fileURLToPath(new URL(`./mocks/images/${name}`, import.meta.url)))
const PNG = { 'content-type': 'image/png', 'access-control-allow-origin': '*' }

// Hosts the app may reach besides localhost: canvas text uses Google Fonts.
const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

/** Reads the app's read-only test hook (only installed with `?e2e`). */
export function hook<K extends keyof E2EHook>(page: Page, key: K) {
  return page.evaluate(
    ([global, name]) => {
      const h = (window as unknown as Record<string, Record<string, () => unknown>>)[global]
      return h ? h[name]() : undefined
    },
    [E2E_GLOBAL, key] as const
  ) as Promise<ReturnType<E2EHook[K]>>
}

type Fixtures = {
  /** Opens the editor with the test hook and waits until the first scene is shown. */
  app: { open: (query?: string) => Promise<void> }
  /** Runs before any page script (a function, or raw JS): seed IndexedDB / localStorage. */
  seed: (script: (() => void) | string) => Promise<void>
  /** Fails the test on any request off localhost that no mock handled. */
  net: { blocked: string[] }
  session: (state: SessionState) => Promise<void>
  dmbk: { calls: { operation: string; variables: unknown }[]; fail: (error: string, status?: number) => void }
  fal: { fail: (error: FalError, status?: number) => void; submits: number }
}

export const test = base.extend<Fixtures>({
  net: [
    async ({ page }, use) => {
      const net = { blocked: [] as string[] }
      // Registered first, so every later page.route (the mocks) wins over it.
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url())
        if (url.hostname === 'localhost' || url.protocol === 'data:' || url.protocol === 'blob:') {
          return route.fallback()
        }
        if (ALLOWED_HOSTS.includes(url.hostname)) return route.fallback()
        if (url.origin === FIXTURE_HOST) {
          return route.fulfill({ status: 200, headers: PNG, body: image('photo.png') })
        }
        if (url.href.split('?')[0] === CUTOUT_URL) {
          return route.fulfill({ status: 200, headers: PNG, body: image('cutout.png') })
        }
        net.blocked.push(url.href)
        return route.abort('blockedbyclient')
      })
      await use(net)
      expect(net.blocked, 'unexpected requests off localhost').toEqual([])
    },
    { auto: true },
  ],

  app: async ({ page }, use) => {
    await use({
      open: async (query = '') => {
        await page.goto(`/?e2e${query ? `&${query}` : ''}`)
        await expect.poll(() => hook(page, 'ready'), { timeout: 15_000 }).toBe(true)
      },
    })
  },

  seed: async ({ page }, use) => {
    await use(async (script) => {
      await page.addInitScript(typeof script === 'string' ? { content: script } : script)
    })
  },

  session: async ({ page }, use) => {
    await use(async (state) => {
      await page.route('**/api/session', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ json: SESSIONS[state] })
          : route.fulfill({ status: 405, json: { error: 'method' } })
      )
    })
  },

  dmbk: async ({ page }, use) => {
    const state = {
      calls: [] as { operation: string; variables: unknown }[],
      failure: null as { error: string; status: number } | null,
    }
    await page.route('**/api/dmbk', (route) => {
      const { operation, variables } = route.request().postDataJSON() as {
        operation: keyof typeof DMBK
        variables: unknown
      }
      state.calls.push({ operation, variables })
      if (state.failure) return route.fulfill({ status: state.failure.status, json: { error: state.failure.error } })
      return route.fulfill({ json: { data: DMBK[operation] } })
    })
    await use({
      calls: state.calls,
      fail: (error, status = 503) => {
        state.failure = { error, status }
      },
    })
  },

  fal: async ({ page }, use) => {
    const state = { failure: null as { error: FalError; status: number } | null, submits: 0, polls: 0 }
    await page.route('**/api/background-removal', (route) => {
      state.submits++
      if (state.failure) return route.fulfill({ status: state.failure.status, json: { error: state.failure.error } })
      return route.fulfill({ json: SUBMIT })
    })
    await page.route('**/api/background-removal/job', (route) => {
      if (route.request().method() === 'DELETE') return route.fulfill({ json: { ok: true } })
      // One pending poll, then done: exercises the working state.
      return route.fulfill({ json: state.polls++ === 0 ? PENDING : DONE })
    })
    const api = {
      fail: (error: FalError, status = 403) => {
        state.failure = { error, status }
      },
      get submits() {
        return state.submits
      },
    }
    await use(api)
  },
})

export { expect }
