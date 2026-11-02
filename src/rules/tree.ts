import { newId } from './ids'
import { FIELDS, OPERATORS } from './schema'
import type { Condition, Group, Rule, RuleNode } from './types'

export const emptyRule = (): Rule => ({
  name: 'Untitled rule',
  root: { id: newId('g'), kind: 'group', combinator: 'and', negate: false, children: [] },
  actions: [],
})

export function newCondition(): Condition {
  const field = FIELDS[0]
  return { id: newId('c'), kind: 'condition', field: field.key, operator: OPERATORS[field.type][0], value: 0 }
}

export const newGroup = (): Group => ({ id: newId('g'), kind: 'group', combinator: 'or', negate: false, children: [newCondition()] })

/** Returns a copy of the tree with the node `id` replaced by `fn(node)` (or removed if fn returns null). */
export function mapNode(root: Group, id: string, fn: (n: RuleNode) => RuleNode | null): Group {
  const visit = (node: RuleNode): RuleNode | null => {
    if (node.id === id) return fn(node)
    if (node.kind === 'condition') return node
    const children = node.children.map(visit).filter((c): c is RuleNode => c !== null)
    return { ...node, children }
  }
  return visit(root) as Group
}

export function findNode(root: RuleNode, id: string): RuleNode | null {
  if (root.id === id) return root
  if (root.kind === 'condition') return null
  for (const child of root.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return null
}

export function contains(ancestor: RuleNode, id: string): boolean {
  return findNode(ancestor, id) !== null
}

/**
 * Moves `dragId` to sit before `beforeId` (when given) inside group `targetGroupId`, or at its end.
 * Refuses moves that would put a group inside itself.
 */
export function moveNode(root: Group, dragId: string, targetGroupId: string, beforeId?: string): Group {
  if (dragId === root.id || dragId === beforeId) return root
  const dragged = findNode(root, dragId)
  if (!dragged || contains(dragged, targetGroupId)) return root
  const without = mapNode(root, dragId, () => null)
  return mapNode(without, targetGroupId, (g) => {
    if (g.kind !== 'group') return g
    const children = [...g.children]
    const at = beforeId ? children.findIndex((c) => c.id === beforeId) : -1
    children.splice(at === -1 ? children.length : at, 0, dragged)
    return { ...g, children }
  })
}

export const countConditions = (node: RuleNode): number =>
  node.kind === 'condition' ? 1 : node.children.reduce((n, c) => n + countConditions(c), 0)
