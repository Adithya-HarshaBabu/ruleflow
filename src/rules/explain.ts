import { ACTIONS, fieldByKey, OPERATOR_LABELS } from './schema'
import type { Action, Condition, Group, Rule, RuleNode } from './types'

export function formatValue(c: Condition): string {
  const field = fieldByKey.get(c.field)
  const unit = field?.unit
  const fmt = (x: unknown) => (unit === '$' ? `$${x}` : unit ? `${x} ${unit}` : String(x))
  if (c.operator === 'is_true' || c.operator === 'is_false') return ''
  if (c.operator === 'between' && Array.isArray(c.value)) return `${fmt(c.value[0])} and ${fmt(c.value[1])}`
  if (Array.isArray(c.value)) return c.value.join(', ')
  return fmt(c.value ?? '')
}

export function describeCondition(c: Condition): string {
  const label = fieldByKey.get(c.field)?.label.toLowerCase() ?? c.field
  if (c.operator === 'is_true') return `${label} is true`
  if (c.operator === 'is_false') return `${label} is false`
  return `${label} ${OPERATOR_LABELS[c.operator]} ${formatValue(c)}`.trim()
}

function describeNode(node: RuleNode, depth: number): string {
  if (node.kind === 'condition') return describeCondition(node)
  return describeGroup(node, depth)
}

function describeGroup(group: Group, depth = 0): string {
  if (group.children.length === 0) return group.negate ? 'no order' : 'every order'
  const parts = group.children.map((c) => describeNode(c, depth + 1))
  const joined = parts.length === 1 ? parts[0] : parts.join(group.combinator === 'and' ? ' and ' : ' or ')
  if (group.negate) return `not (${joined})`
  return depth > 0 && parts.length > 1 ? `(${joined})` : joined
}

export function describeAction(a: Action): string {
  const def = ACTIONS[a.type]
  switch (a.type) {
    case 'apply_discount':
      return `apply a ${a.param || '?'}% discount`
    case 'set_priority':
      return `set fulfilment priority to ${a.param || '?'}`
    case 'send_email':
      return `send the "${a.param || '?'}" email`
    default:
      return def.label.charAt(0).toLowerCase() + def.label.slice(1)
  }
}

/** A plain-English reading of the whole rule. */
export function explainRule(rule: Rule): string {
  const when = describeGroup(rule.root)
  const then = rule.actions.length ? rule.actions.map(describeAction).join(', then ') : 'do nothing yet'
  return `When ${when}, ${then}.`
}
