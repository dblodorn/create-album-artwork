import { useCallback, useEffect, useState } from 'react'

export function useKeyPress(targetKey: KeyboardEvent['key']): boolean {
  const [keyPressed, setKeyPressed] = useState(false)

  const handleDown = useCallback(
    ({ key }: KeyboardEvent) => {
      if (key === targetKey) setKeyPressed(true)
    },
    [targetKey]
  )

  const handleUp = useCallback(
    ({ key }: KeyboardEvent) => {
      if (key === targetKey) setKeyPressed(false)
    },
    [targetKey]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)

    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
    }
  }, [handleDown, handleUp])

  return keyPressed
}