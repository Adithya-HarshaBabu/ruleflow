import { ACTION_TYPES, ACTIONS } from '../rules/schema'
import { newId } from '../rules/ids'
import type { Action, ActionType } from '../rules/types'

export function ActionsEditor({ actions, onChange }: { actions: Action[]; onChange: (a: Action[], key?: string) => void }) {
  const update = (id: string, patch: Partial<Action>, key?: string) =>
    onChange(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)), key)

  return (
    <div className="actions">
      <div className="then-label">THEN</div>
      <div className="action-list">
        {actions.length === 0 && <p className="empty-hint">No actions yet. Add what should happen when an order matches.</p>}
        {actions.map((a) => {
          const def = ACTIONS[a.type]
          return (
            <div key={a.id} className="action">
              <select
                value={a.type}
                onChange={(e) => {
                  const type = e.target.value as ActionType
                  update(a.id, { type, param: ACTIONS[type].param?.options?.[0] ?? (type === 'apply_discount' ? '10' : undefined) })
                }}
                aria-label="Action"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTIONS[t].label}
                  </option>
                ))}
              </select>
              {def.param &&
                (def.param.options ? (
                  <select value={a.param ?? ''} onChange={(e) => update(a.id, { param: e.target.value })} aria-label={def.param.label}>
                    {def.param.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <span className="value-wrap">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={a.param ?? ''}
                      placeholder={def.param.placeholder}
                      onChange={(e) => update(a.id, { param: e.target.value }, `param-${a.id}`)}
                      aria-label={def.param.label}
                    />
                    <span className="unit">%</span>
                  </span>
                ))}
              <button className="icon danger" onClick={() => onChange(actions.filter((x) => x.id !== a.id))} aria-label="Remove action">
                ×
              </button>
            </div>
          )
        })}
        <button className="ghost small add-action" onClick={() => onChange([...actions, { id: newId('a'), type: 'flag_for_review' }])}>
          + Action
        </button>
      </div>
    </div>
  )
}
