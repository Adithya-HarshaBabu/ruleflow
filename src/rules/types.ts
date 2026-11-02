export type FieldType = 'number' | 'enum' | 'boolean' | 'text'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  unit?: string
  hint?: string
}

export type Operator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'is_true'
  | 'is_false'

export type Value = number | string | string[] | [number, number] | null

export interface Condition {
  id: string
  kind: 'condition'
  field: string
  operator: Operator
  value: Value
}

export interface Group {
  id: string
  kind: 'group'
  combinator: 'and' | 'or'
  negate: boolean
  children: RuleNode[]
}

export type RuleNode = Group | Condition

export type ActionType = 'flag_for_review' | 'block_order' | 'apply_discount' | 'set_priority' | 'send_email'

export interface Action {
  id: string
  type: ActionType
  /** Discount percent, priority level or email template, depending on the action. */
  param?: string
}

export interface Rule {
  name: string
  root: Group
  actions: Action[]
}

export type Order = Record<string, number | string | boolean>
