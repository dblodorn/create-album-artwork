'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Reshaped } from 'reshaped'

import {
  DARK_QUERY,
  FALLBACK_MODE,
  STORAGE_KEY,
  THEME,
  parseChoice,
  readChoice,
  resolveMode,
  writeChoice,
  type ColorMode,
  type ColorModeChoice,
} from './colorMode'

type ColorModeContextValue = {
  /** What the person picked: light, dark or system. */
  choice: ColorModeChoice
  /** What's showing now. */
  mode: ColorMode
  setChoice: (choice: ColorModeChoice) => void
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null)

/*
 * Read in state initialisers, not settled in an effect, so the first client
 * render already agrees with what COLOR_MODE_SCRIPT painted. Reshaped writes
 * the mode to <html> from an effect, so no markup React compares at hydration
 * depends on these.
 */
function systemIsDarkNow(): boolean {
  if (typeof window === 'undefined') return FALLBACK_MODE === 'dark'
  return window.matchMedia?.(DARK_QUERY).matches ?? FALLBACK_MODE === 'dark'
}

/**
 * Reshaped for the whole app, with the `dmbk` theme and a controlled colour
 * mode: the stored choice, resolved against the OS preference and followed
 * live (OS changes, and changes made in another tab).
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ColorModeChoice>(() =>
    typeof window === 'undefined' ? 'system' : readChoice(),
  )
  const [systemIsDark, setSystemIsDark] = useState(systemIsDarkNow)

  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY)
    if (!query) return
    const follow = () => setSystemIsDark(query.matches)
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setChoiceState(parseChoice(event.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setChoice = useCallback((next: ColorModeChoice) => {
    setChoiceState(next)
    writeChoice(next)
  }, [])

  const mode = resolveMode(choice, systemIsDark)

  /*
   * Reshaped (4.1) only passes a controlled `colorMode` through its context;
   * it writes the <html> attribute that every themed rule reads only from its
   * own setMode. So the attribute is kept in step here, before paint.
   */
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-rs-color-mode', mode)
  }, [mode])
  const value = useMemo(() => ({ choice, mode, setChoice }), [choice, mode, setChoice])

  return (
    <ColorModeContext.Provider value={value}>
      <Reshaped theme={THEME} colorMode={mode}>
        {children}
      </Reshaped>
    </ColorModeContext.Provider>
  )
}

export function useColorMode(): ColorModeContextValue {
  const value = useContext(ColorModeContext)
  if (!value) throw new Error('useColorMode must be used inside <ColorModeProvider>')
  return value
}
