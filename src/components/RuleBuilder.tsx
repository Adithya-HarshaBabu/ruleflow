import { useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { FIELDS, fieldByKey, OPERATOR_LABELS, OPERATORS } from '../rules/schema'
import { describeCondition } from '../rules/explain'
import { countConditions, findNode, mapNode, moveNode, newCondition, newGroup } from '../rules/tree'
import type { Trace } from '../rules/evaluate'
import type { Condition, Group, Operator, RuleNode, Value } from '../rules/types'

interface Props {
  root: Group
  /** `key` groups rapid edits (typing) into one undo step. */
  onChange: (root: Group, key?: string) => void
  /** Per-node results for the selected test order. */
  trace?: Map<string, Trace>
}

export function RuleBuilder({ root, onChange, trace }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor))
  const active = activeId ? findNode(root, activeId) : null

  const update: Update = (id, fn, key) => onChange(mapNode(root, id, fn), key)

  // Drop targets are slots between items ("before:<id>:<group>") or the end of a group ("end:<group>").
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) return
    const [kind, a, b] = String(over.id).split(':')
    if (kind === 'before') onChange(moveNode(root, String(active.id), b, a))
    if (kind === 'end') onChange(moveNode(root, String(active.id), a))
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className={`builder ${activeId ? 'dragging' : ''}`}>
        <GroupView group={root} isRoot update={update} trace={trace} activeId={activeId} />
      </div>
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="drag-chip">
            {active.kind === 'condition'
              ? describeCondition(active)
              : `${active.combinator.toUpperCase()} group · ${countConditions(active)} conditions`}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

type Update = (id: string, fn: (n: RuleNode) => RuleNode | null, key?: string) => void

interface NodeProps {
  update: Update
  trace?: Map<string, Trace>
  activeId: string | null
}

function GroupView({ group, isRoot, update, trace, activeId }: NodeProps & { group: Group; isRoot?: boolean }) {
  const t = trace?.get(group.id)
  const set = (patch: Partial<Group>) => update(group.id, (n) => ({ ...(n as Group), ...patch }))
  const addChild = (child: RuleNode) => set({ children: [...group.children, child] })

  const body = (
    <div className={`group depth-${isRoot ? 0 : 1} ${t ? (t.passed ? 'pass' : 'fail') : ''}`}>
      <div className="group-head">
        <div className="segmented" role="radiogroup" aria-label="Combine conditions with">
          {(['and', 'or'] as const).map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={group.combinator === c}
              className={group.combinator === c ? 'on' : ''}
              onClick={() => set({ combinator: c })}
            >
              {c === 'and' ? 'ALL' : 'ANY'}
            </button>
          ))}
        </div>
        <span className="group-label">{group.combinator === 'and' ? 'of these must match' : 'of these can match'}</span>
        <label className="not-toggle">
          <input type="checkbox" checked={group.negate} onChange={(e) => set({ negate: e.target.checked })} /> NOT
        </label>
        {t && <ResultBadge passed={t.passed} />}
        <span className="spacer" />
        <button className="ghost small" onClick={() => addChild(newCondition())}>
          + Condition
        </button>
        <button className="ghost small" onClick={() => addChild(newGroup())}>
          + Group
        </button>
        {!isRoot && (
          <button className="icon danger" onClick={() => update(group.id, () => null)} aria-label="Delete group">
            ×
          </button>
        )}
      </div>

      <div className="children">
        {group.children.length === 0 && (
          <p className="empty-hint">No conditions yet, so this matches every order. Add a condition or describe a rule above.</p>
        )}
        {group.children.map((child) => (
          <div key={child.id}>
            <DropSlot id={`before:${child.id}:${group.id}`} disabled={activeId === child.id} />
            {child.kind === 'group' ? (
              <GroupView group={child} update={update} trace={trace} activeId={activeId} />
            ) : (
              <ConditionRow condition={child} update={update} trace={trace} activeId={activeId} />
            )}
          </div>
        ))}
        <DropSlot id={`end:${group.id}`} end />
      </div>
    </div>
  )

  return isRoot ? body : <DraggableItem id={group.id}>{body}</DraggableItem>
}

function DraggableItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div ref={setNodeRef} className={`draggable ${isDragging ? 'is-dragging' : ''}`}>
      <button className="handle" {...listeners} {...attributes} aria-label="Drag to move">
        ⠿
      </button>
      <div className="draggable-body">{children}</div>
    </div>
  )
}

function DropSlot({ id, end, disabled }: { id: string; end?: boolean; disabled?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })
  return <div ref={setNodeRef} className={`slot ${end ? 'slot-end' : ''} ${isOver ? 'over' : ''}`} aria-hidden="true" />
}

function ResultBadge({ passed }: { passed: boolean }) {
  return <span className={`result ${passed ? 'pass' : 'fail'}`}>{passed ? '✓ match' : '✗ no match'}</span>
}

function defaultValue(field: string, operator: Operator): Value {
  const def = fieldByKey.get(field)
  if (operator === 'is_true' || operator === 'is_false') return null
  if (operator === 'between') return [0, 100]
  if (operator === 'in' || operator === 'not_in') return def?.options ? [def.options[0]] : []
  if (def?.type === 'number') return 0
  if (def?.type === 'enum') return def.options?.[0] ?? ''
  return ''
}

function ConditionRow({ condition: c, update, trace }: NodeProps & { condition: Condition }) {
  const field = fieldByKey.get(c.field) ?? FIELDS[0]
  const t = trace?.get(c.id)
  const set = (patch: Partial<Condition>, key?: string) => update(c.id, (n) => ({ ...(n as Condition), ...patch }), key)

  const changeField = (key: string) => {
    const f = fieldByKey.get(key)!
    const operator = OPERATORS[f.type][0]
    set({ field: key, operator, value: defaultValue(key, operator) })
  }

  const changeOperator = (operator: Operator) => {
    // Keep what we can of the old value when switching between compatible operators.
    let value = defaultValue(c.field, operator)
    if (operator === 'between' && typeof c.value === 'number') value = [c.value, c.value * 2 || 100]
    else if ((operator === 'in' || operator === 'not_in') && typeof c.value === 'string') value = [c.value]
    else if (Array.isArray(c.value) && (operator === 'in' || operator === 'not_in') && (c.operator === 'in' || c.operator === 'not_in')) value = c.value
    else if (!Array.isArray(c.value) && c.value !== null && !['between', 'in', 'not_in', 'is_true', 'is_false'].includes(operator)) value = c.value
    set({ operator, value })
  }

  return (
    <DraggableItem id={c.id}>
      <div className={`condition ${t ? (t.passed ? 'pass' : 'fail') : ''}`}>
        <select value={c.field} onChange={(e) => changeField(e.target.value)} aria-label="Field">
          {FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <select value={c.operator} onChange={(e) => changeOperator(e.target.value as Operator)} aria-label="Operator">
          {OPERATORS[field.type].map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
        <ValueInput condition={c} onChange={(value, typing) => set({ value }, typing ? `value-${c.id}` : undefined)} />
        {t && (
          <span className={`result ${t.passed ? 'pass' : 'fail'}`} title="Value in the selected order">
            {t.passed ? '✓' : '✗'} {String(t.actual)}
          </span>
        )}
        <button className="icon danger" onClick={() => update(c.id, () => null)} aria-label="Delete condition">
          ×
        </button>
      </div>
    </DraggableItem>
  )
}

function ValueInput({ condition: c, onChange }: { condition: Condition; onChange: (v: Value, typing?: boolean) => void }) {
  const field = fieldByKey.get(c.field)!
  if (c.operator === 'is_true' || c.operator === 'is_false') return null

  if (c.operator === 'between') {
    const [lo, hi] = Array.isArray(c.value) ? (c.value as [number, number]) : [0, 0]
    return (
      <span className="between">
        <input type="number" value={lo} onChange={(e) => onChange([Number(e.target.value), hi], true)} aria-label="From" />
        <span>and</span>
        <input type="number" value={hi} onChange={(e) => onChange([lo, Number(e.target.value)], true)} aria-label="To" />
      </span>
    )
  }

  if ((c.operator === 'in' || c.operator === 'not_in') && field.options) {
    const selected = new Set(Array.isArray(c.value) ? c.value.map(String) : [])
    return (
      <span className="chips" role="group" aria-label="Values">
        {field.options.map((o) => (
          <button
            key={o}
            className={`chip ${selected.has(o) ? 'on' : ''}`}
            aria-pressed={selected.has(o)}
            onClick={() => {
              if (selected.has(o)) selected.delete(o)
              else selected.add(o)
              onChange(field.options!.filter((x) => selected.has(x)))
            }}
          >
            {o}
          </button>
        ))}
      </span>
    )
  }

  if (field.type === 'enum') {
    return (
      <select value={String(c.value ?? '')} onChange={(e) => onChange(e.target.value)} aria-label="Value">
        {field.options!.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    )
  }

  return (
    <span className="value-wrap">
      {field.unit === '$' && <span className="unit">$</span>}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={String(c.value ?? '')}
        onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value, true)}
        aria-label="Value"
        placeholder={field.hint}
      />
      {field.unit && field.unit !== '$' && <span className="unit">{field.unit}</span>}
    </span>
  )
}
