import { useEffect, useState, type FormEvent } from 'react'
import { EXAMPLE_PROMPTS } from '../rules/examples'

interface Props {
  busy: boolean
  error: string | null
  hasRule: boolean
  onSubmit: (mode: 'generate' | 'refine', prompt: string) => void
}

export function PromptPanel({ busy, error, hasRule, onSubmit }: Props) {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'generate' | 'refine'>('generate')
  const effectiveMode = hasRule ? mode : 'generate'
  const [elapsed, setElapsed] = useState(0)

  // Show how long the AI has been working, so slow responses don't look stuck.
  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => {
      clearInterval(id)
      setElapsed(0)
    }
  }, [busy])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (prompt.trim().length >= 3 && !busy) onSubmit(effectiveMode, prompt.trim())
  }

  return (
    <section className="card prompt">
      <div className="card-head">
        <h2>
          <span className="spark" aria-hidden="true">✦</span> Describe it in plain English
        </h2>
        {hasRule && (
          <div className="segmented small" role="radiogroup" aria-label="AI mode">
            <button role="radio" aria-checked={mode === 'generate'} className={mode === 'generate' ? 'on' : ''} onClick={() => setMode('generate')}>
              New rule
            </button>
            <button role="radio" aria-checked={mode === 'refine'} className={mode === 'refine' ? 'on' : ''} onClick={() => setMode('refine')}>
              Edit current
            </button>
          </div>
        )}
      </div>
      <form onSubmit={submit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
          }}
          rows={3}
          maxLength={600}
          placeholder={
            effectiveMode === 'refine'
              ? 'e.g. “also exclude VIP customers” or “raise the threshold to $800”'
              : 'e.g. “Flag orders over $500 from brand-new customers for review”'
          }
          aria-label="Rule description"
        />
        <div className="prompt-actions">
          <span className="muted small">⌘↵ to send · Gemini turns it into an editable rule</span>
          <button className="primary" disabled={busy || prompt.trim().length < 3}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> <span className="busy-label">Thinking… {elapsed > 2 ? `${elapsed}s` : ''}</span>
              </>
            ) : effectiveMode === 'refine' ? (
              'Update rule'
            ) : (
              'Generate rule'
            )}
          </button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="examples">
        <span className="muted small">Try:</span>
        {EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex}
            className="example"
            onClick={() => {
              setPrompt(ex)
              setMode('generate')
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </section>
  )
}
