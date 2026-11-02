import type { Rule } from '../rules/types'

export async function askAI(mode: 'generate' | 'refine', prompt: string, rule?: Rule): Promise<Rule> {
  const res = await fetch('/api/rule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, prompt, rule }),
  })
  const body = (await res.json().catch(() => ({}))) as { rule?: Rule; error?: string }
  if (!res.ok || !body.rule) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body.rule
}
