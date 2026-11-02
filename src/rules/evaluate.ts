import { fieldByKey } from './schema'
import type { Condition, Group, Order, RuleNode } from './types'

export interface Trace {
  id: string
  passed: boolean
  children?: Trace[]
  /** The order's actual value for a condition, for display. */
  actual?: number | string | boolean
}

function evalCondition(c: Condition, order: Order): boolean {
  const actual = order[c.field]
  const field = fieldByKey.get(c.field)
  if (actual === undefined || !field) return false
  const v = c.value
  switch (c.operator) {
    case 'is_true':
      return actual === true
    case 'is_false':
      return actual === false
    case 'eq':
      return field.type === 'number' ? Number(actual) === Number(v) : String(actual).toLowerCase() === String(v).toLowerCase()
    case 'neq':
      return field.type === 'number' ? Number(actual) !== Number(v) : String(actual).toLowerCase() !== String(v).toLowerCase()
    case 'gt':
      return Number(actual) > Number(v)
    case 'gte':
      return Number(actual) >= Number(v)
    case 'lt':
      return Number(actual) < Number(v)
    case 'lte':
      return Number(actual) <= Number(v)
    case 'between': {
      const [lo, hi] = Array.isArray(v) ? v.map(Number) : [NaN, NaN]
      return Number(actual) >= Math.min(lo, hi) && Number(actual) <= Math.max(lo, hi)
    }
    case 'in':
      return Array.isArray(v) && v.map(String).includes(String(actual))
    case 'not_in':
      return Array.isArray(v) && !v.map(String).includes(String(actual))
    case 'contains':
      return String(actual).toLowerCase().includes(String(v ?? '').toLowerCase())
  }
}

/** Evaluates a node and records which parts passed, so the UI can explain each match. */
export function trace(node: RuleNode, order: Order): Trace {
  if (node.kind === 'condition') {
    return { id: node.id, passed: evalCondition(node, order), actual: order[node.field] }
  }
  const children = node.children.map((child) => trace(child, order))
  // An empty group matches everything, so a fresh rule starts by matching all orders.
  const combined =
    children.length === 0
      ? true
      : node.combinator === 'and'
        ? children.every((c) => c.passed)
        : children.some((c) => c.passed)
  return { id: node.id, passed: node.negate ? !combined : combined, children }
}

export const matches = (root: Group, order: Order) => trace(root, order).passed

export function indexTrace(t: Trace, map = new Map<string, Trace>()) {
  map.set(t.id, t)
  t.children?.forEach((c) => indexTrace(c, map))
  return map
}
