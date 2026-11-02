import type { Rule } from '../rules/types'

export interface SavedRule {
  id: string
  savedAt: number
  rule: Rule
}

const KEY = 'ruleflow.saved'

export function loadSaved(): SavedRule[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function storeSaved(list: SavedRule[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable (private mode); saving just won't persist */
  }
}
