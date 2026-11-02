import { z } from 'zod'
import { ACTION_TYPES, ACTIONS, fieldByKey, FIELDS, OPERATORS } from './schema'
import { newId } from './ids'
import type { Action, Condition, Group, Operator, Rule, RuleNode } from './types'

// Gemini returns a flat list of nodes with parent links (simpler for structured output than a
// recursive schema). Values arrive as strings and are coerced by each field's type.

const operatorNames = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'not_in', 'contains', 'is_true', 'is_false'] as const

export const LlmRuleSchema = z.object({
  name: z.string().describe('Short title for the rule, e.g. "High-value new customer review"'),
  nodes: z
    .array(
      z.object({
        id: z.string().describe('Unique id such as "g1" or "c3"'),
        parentId: z.string().nullable().describe('Id of the parent group; null only for the single root group'),
        kind: z.enum(['group', 'condition']),
        combinator: z.enum(['and', 'or']).nullable().describe('For groups: how children combine'),
        negate: z.boolean().nullable().describe('For groups: true to invert the group (NOT)'),
        field: z.string().nullable().describe('For conditions: one of the allowed field keys'),
        operator: z.enum(operatorNames).nullable(),
        value: z
          .string()
          .nullable()
          .describe('For conditions: the value as text. Lists comma-separated; "between" as "low,high"; null for is_true/is_false'),
      }),
    )
    .describe('All groups and conditions. Exactly one group has parentId null.'),
  actions: z.array(
    z.object({
      type: z.enum(ACTION_TYPES as [string, ...string[]]),
      param: z.string().nullable().describe('apply_discount: percent number; set_priority: low|normal|high; send_email: template'),
    }),
  ),
})

export type LlmRule = z.infer<typeof LlmRuleSchema>

export const llmJsonSchema = z.toJSONSchema(LlmRuleSchema)

export function domainPrompt(): string {
  const fields = FIELDS.map((f) => {
    const ops = OPERATORS[f.type].join(', ')
    const opts = f.options ? ` values: ${f.options.join(' | ')};` : ''
    return `- ${f.key} (${f.type}${f.unit ? `, ${f.unit}` : ''}):${opts} operators: ${ops}`
  }).join('\n')
  const actions = ACTION_TYPES.map((t) => {
    const param = ACTIONS[t].param
    const detail = !param ? 'no param' : param.options ? `param: ${param.options.join(' | ')}` : `param: ${param.label.toLowerCase()} (number)`
    return `- ${t} (${detail})`
  }).join('\n')
  return `You turn plain-English business rules for an e-commerce store into a structured rule.

Allowed fields:
${fields}

Allowed actions (with their param):
${actions}

Guidelines:
- Use exactly one root group (parentId null). Nest groups to express mixed AND/OR logic and use negate for NOT.
- Use only the listed fields, operators and enum values. Map synonyms sensibly (e.g. "first-time buyer" -> customerType eq new, "big order" -> orderTotal).
- Exclusions invert the condition: "unless X", "except X", "but not X", "excluding X" mean the rule must NOT match when X is true. Use neq / not_in / is_false, or a negated group.
- Pick the action that matches the requested outcome: asking a customer to verify identity -> send_email with verify_identity; discounts -> apply_discount with the percent; priority changes -> set_priority; stopping an order -> block_order; manual checks -> flag_for_review. Several outcomes -> several actions.
- When the request is vague about a threshold, pick a sensible value.
- If no outcome is stated at all, use flag_for_review.
- Keep the rule as small as possible while matching the request.`
}

function coerce(field: string, operator: Operator, raw: string | null): Condition['value'] {
  const type = fieldByKey.get(field)?.type
  if (operator === 'is_true' || operator === 'is_false') return null
  const text = (raw ?? '').trim()
  if (operator === 'between') {
    const [lo, hi] = text.split(/[,–-]|\band\b/).map((s) => Number(s.replace(/[^0-9.]/g, '')))
    return [lo || 0, hi || 0]
  }
  if (operator === 'in' || operator === 'not_in') return text.split(',').map((s) => s.trim()).filter(Boolean)
  if (type === 'number') return Number(text.replace(/[^0-9.-]/g, '')) || 0
  return text
}

/** Converts and validates Gemini's flat output into a rule tree. Throws with a readable message. */
export function fromLlm(raw: unknown): Rule {
  const parsed = LlmRuleSchema.parse(raw)
  const byParent = new Map<string | null, LlmRule['nodes']>()
  for (const n of parsed.nodes) byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n])
  const roots = (byParent.get(null) ?? []).filter((n) => n.kind === 'group')
  if (roots.length !== 1) throw new Error('The AI returned a rule without a single root group.')

  const seen = new Set<string>()
  const build = (n: LlmRule['nodes'][number]): RuleNode | null => {
    if (seen.has(n.id)) return null
    seen.add(n.id)
    if (n.kind === 'group') {
      const children = (byParent.get(n.id) ?? []).map(build).filter((c): c is RuleNode => c !== null)
      return { id: newId('g'), kind: 'group', combinator: n.combinator ?? 'and', negate: Boolean(n.negate), children }
    }
    const field = n.field && fieldByKey.get(n.field)
    if (!field || !n.operator) return null
    const operator = (OPERATORS[field.type] as string[]).includes(n.operator)
      ? (n.operator as Operator)
      : OPERATORS[field.type][0]
    return { id: newId('c'), kind: 'condition', field: field.key, operator, value: coerce(field.key, operator, n.value) }
  }

  const root = build(roots[0]) as Group
  const actions: Action[] = parsed.actions.map((a) => ({
    id: newId('a'),
    type: a.type as Action['type'],
    param: a.param ?? undefined,
  }))
  return { name: parsed.name, root, actions }
}

/** The reverse: describe the current rule to Gemini for "refine" requests. */
export function toLlm(rule: Rule): LlmRule {
  const nodes: LlmRule['nodes'] = []
  const walk = (node: RuleNode, parentId: string | null) => {
    if (node.kind === 'group') {
      nodes.push({ id: node.id, parentId, kind: 'group', combinator: node.combinator, negate: node.negate, field: null, operator: null, value: null })
      node.children.forEach((c) => walk(c, node.id))
    } else {
      const value = Array.isArray(node.value) ? node.value.join(',') : node.value === null ? null : String(node.value)
      nodes.push({ id: node.id, parentId, kind: 'condition', combinator: null, negate: null, field: node.field, operator: node.operator, value })
    }
  }
  walk(rule.root, null)
  return { name: rule.name, nodes, actions: rule.actions.map((a) => ({ type: a.type, param: a.param ?? null })) }
}
