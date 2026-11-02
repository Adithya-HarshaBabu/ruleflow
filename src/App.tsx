import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionsEditor } from './components/ActionsEditor'
import { FlowView } from './components/FlowView'
import { PromptPanel } from './components/PromptPanel'
import { RuleBuilder } from './components/RuleBuilder'
import { TestPanel } from './components/TestPanel'
import { askAI } from './lib/api'
import { loadSaved, storeSaved, type SavedRule } from './lib/storage'
import { useHistory } from './lib/useHistory'
import { ORDERS } from './rules/data'
import { indexTrace, trace } from './rules/evaluate'
import { explainRule } from './rules/explain'
import { newId } from './rules/ids'
import { countConditions, emptyRule } from './rules/tree'
import type { Rule } from './rules/types'

const STARTER: Rule = {
  name: 'High-value first orders',
  root: {
    id: 'g-root',
    kind: 'group',
    combinator: 'and',
    negate: false,
    children: [
      { id: 'c-total', kind: 'condition', field: 'orderTotal', operator: 'gt', value: 500 },
      { id: 'c-new', kind: 'condition', field: 'customerType', operator: 'eq', value: 'new' },
    ],
  },
  actions: [{ id: 'a-flag', type: 'flag_for_review' }],
}

export default function App() {
  const history = useHistory<Rule>(STARTER)
  const rule = history.value
  const [view, setView] = useState<'builder' | 'flow'>('builder')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedRule[]>(loadSaved)
  const [toast, setToast] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<Rule>, key?: string) => history.set({ ...rule, ...patch }, key)

  const order = ORDERS.find((o) => o.id === selectedOrder)
  const traceMap = useMemo(() => (order ? indexTrace(trace(rule.root, order)) : undefined), [order, rule.root])
  const explanation = useMemo(() => explainRule(rule), [rule])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) history.redo()
        else history.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const runAI = async (mode: 'generate' | 'refine', prompt: string) => {
    setBusy(true)
    setError(null)
    try {
      const next = await askAI(mode, prompt, mode === 'refine' ? rule : undefined)
      history.set(next)
      setToast(mode === 'refine' ? 'Rule updated' : 'Rule generated. Every part is editable.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const saveRule = () => {
    const entry: SavedRule = { id: newId('s'), savedAt: Date.now(), rule }
    const next = [entry, ...saved.filter((s) => s.rule.name !== rule.name)].slice(0, 20)
    setSaved(next)
    storeSaved(next)
    setToast('Saved to this browser')
  }

  const removeSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id)
    setSaved(next)
    storeSaved(next)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rule, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${rule.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'rule'}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Rule
      if (parsed?.root?.kind !== 'group' || !Array.isArray(parsed.actions)) throw new Error('Not a Ruleflow rule')
      history.set(parsed)
      setToast('Rule imported')
    } catch {
      setError('That file is not a Ruleflow rule (JSON exported from this app).')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <path d="M8 10h7l4 6-4 6H8m11-6h5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Ruleflow</span>
          <span className="tagline">Business rules in plain English, powered by Gemini</span>
        </div>
        <a className="ghost small" href="https://github.com/Adithya-HarshaBabu/ruleflow" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </header>

      <main className="layout">
        <div className="col-main">
          <PromptPanel busy={busy} error={error} hasRule={countConditions(rule.root) > 0} onSubmit={runAI} />

          <section className="card rule">
            <div className="rule-top">
              <input
                className="rule-name"
                value={rule.name}
                onChange={(e) => update({ name: e.target.value }, 'name')}
                aria-label="Rule name"
              />
              <div className="toolbar">
                <div className="segmented small" role="radiogroup" aria-label="View">
                  <button role="radio" aria-checked={view === 'builder'} className={view === 'builder' ? 'on' : ''} onClick={() => setView('builder')}>
                    Builder
                  </button>
                  <button role="radio" aria-checked={view === 'flow'} className={view === 'flow' ? 'on' : ''} onClick={() => setView('flow')}>
                    Flow
                  </button>
                </div>
                <button className="icon" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo" title="Undo (⌘Z)">
                  ↶
                </button>
                <button className="icon" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
                  ↷
                </button>
                <button className="ghost small" onClick={saveRule}>
                  Save
                </button>
                <button className="ghost small" onClick={exportJson}>
                  Export
                </button>
                <button className="ghost small" onClick={() => importRef.current?.click()}>
                  Import
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) importJson(f)
                    e.target.value = ''
                  }}
                />
                <button className="ghost small" onClick={() => history.set(emptyRule())}>
                  New
                </button>
              </div>
            </div>

            <p className="explanation" aria-live="polite">
              <span className="muted small">In plain English</span>
              {explanation}
            </p>

            {order && (
              <div className="tracing">
                Showing how order <strong>{order.id}</strong> is evaluated
                <button className="ghost small" onClick={() => setSelectedOrder(null)}>
                  Clear
                </button>
              </div>
            )}

            {view === 'builder' ? (
              <RuleBuilder root={rule.root} onChange={(root, key) => update({ root }, key)} trace={traceMap} />
            ) : (
              <FlowView rule={rule} trace={traceMap} />
            )}

            <ActionsEditor actions={rule.actions} onChange={(actions, key) => update({ actions }, key)} />
          </section>

          <TestPanel root={rule.root} selectedId={selectedOrder} onSelect={setSelectedOrder} />
        </div>

        <aside className="col-side">
          <section className="card">
            <h2>Saved rules</h2>
            {saved.length === 0 ? (
              <p className="muted small">Rules you save are kept in this browser.</p>
            ) : (
              <ul className="saved">
                {saved.map((s) => (
                  <li key={s.id}>
                    <button className="saved-open" onClick={() => history.set(s.rule)}>
                      <strong>{s.rule.name}</strong>
                      <span className="muted small">{explainRule(s.rule)}</span>
                    </button>
                    <button className="icon danger" onClick={() => removeSaved(s.id)} aria-label={`Delete ${s.rule.name}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card about">
            <h2>How it works</h2>
            <ol>
              <li>Describe a rule. Gemini returns it as schema-checked JSON (structured output).</li>
              <li>Every part is editable: drag conditions between groups, switch ALL/ANY, add NOT.</li>
              <li>The rule runs instantly against 40 sample orders, and you can trace any order step by step.</li>
            </ol>
          </section>
        </aside>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
