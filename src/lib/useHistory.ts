import { useCallback, useState } from 'react'

/** State with undo/redo. Consecutive edits with the same `coalesceKey` (e.g. typing in one field) merge into one step. */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState({ past: [] as T[], present: initial, future: [] as T[], lastKey: '' })

  const set = useCallback((next: T, coalesceKey = '') => {
    setState((s) => {
      if (Object.is(next, s.present)) return s
      const merge = coalesceKey !== '' && coalesceKey === s.lastKey
      return {
        past: merge ? s.past : [...s.past, s.present].slice(-100),
        present: next,
        future: [],
        lastKey: coalesceKey,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past.at(-1)!, future: [s.present, ...s.future], lastKey: '' } : s))
  }, [])

  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), lastKey: '' } : s))
  }, [])

  return { value: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}
