import type { ActionType, FieldDef, FieldType, Operator } from './types'

/** The sample domain: e-commerce orders. Rules can only reference these fields. */
export const FIELDS: FieldDef[] = [
  { key: 'orderTotal', label: 'Order total', type: 'number', unit: '$' },
  { key: 'itemCount', label: 'Item count', type: 'number' },
  { key: 'customerType', label: 'Customer type', type: 'enum', options: ['new', 'returning', 'vip'] },
  { key: 'accountAgeDays', label: 'Account age', type: 'number', unit: 'days' },
  { key: 'country', label: 'Shipping country', type: 'enum', options: ['US', 'CA', 'GB', 'DE', 'IN', 'BR', 'NG'] },
  { key: 'paymentMethod', label: 'Payment method', type: 'enum', options: ['card', 'paypal', 'crypto', 'bank_transfer', 'gift_card'] },
  { key: 'shippingSpeed', label: 'Shipping speed', type: 'enum', options: ['standard', 'express', 'overnight'] },
  { key: 'category', label: 'Main category', type: 'enum', options: ['electronics', 'fashion', 'home', 'grocery', 'gaming'] },
  { key: 'riskScore', label: 'Fraud risk score', type: 'number', hint: '0–100' },
  { key: 'couponUsed', label: 'Coupon used', type: 'boolean' },
  { key: 'billingMatchesShipping', label: 'Billing matches shipping', type: 'boolean' },
  { key: 'email', label: 'Customer email', type: 'text' },
]

export const fieldByKey = new Map(FIELDS.map((f) => [f.key, f]))

export const OPERATORS: Record<FieldType, Operator[]> = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  enum: ['eq', 'neq', 'in', 'not_in'],
  boolean: ['is_true', 'is_false'],
  text: ['eq', 'neq', 'contains'],
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  between: 'is between',
  in: 'is any of',
  not_in: 'is none of',
  contains: 'contains',
  is_true: 'is true',
  is_false: 'is false',
}

export const ACTIONS: Record<ActionType, { label: string; param?: { label: string; options?: string[]; placeholder?: string } }> = {
  flag_for_review: { label: 'Flag for manual review' },
  block_order: { label: 'Block the order' },
  apply_discount: { label: 'Apply a discount', param: { label: 'Percent', placeholder: '10' } },
  set_priority: { label: 'Set fulfilment priority', param: { label: 'Priority', options: ['low', 'normal', 'high'] } },
  send_email: { label: 'Send an email', param: { label: 'Template', options: ['welcome', 'verify_identity', 'thank_you', 'delay_notice'] } },
}

export const ACTION_TYPES = Object.keys(ACTIONS) as ActionType[]
