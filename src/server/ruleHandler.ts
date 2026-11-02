import { GoogleGenAI } from '@google/genai'
import { domainPrompt, fromLlm, llmJsonSchema, toLlm } from '../rules/llm'
import type { Rule } from '../rules/types'

export interface HandlerResult {
  status: number
  body: { rule?: Rule; error?: string }
}

const DEFAULT_MODEL = 'gemini-3.8-flash'
const MAX_PROMPT = 600

// Best-effort abuse protection for a public demo: per-IP limits held in memory per server instance.
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60_000)
  const lastMinute = recent.filter((t) => now - t < 60_000).length
  if (lastMinute >= 8 || recent.length >= 60) return true
  hits.set(ip, [...recent, now])
  return false
}

// Gemini's JSON-schema support doesn't need the $schema marker zod adds.
const { $schema: _ignored, ...responseJsonSchema } = llmJsonSchema as Record<string, unknown>

export async function handleRuleRequest(
  input: unknown,
  env: { apiKey?: string; model?: string },
  ip = 'local',
): Promise<HandlerResult> {
  if (!env.apiKey) {
    return { status: 503, body: { error: 'AI is not configured on this server (GEMINI_API_KEY is missing).' } }
  }
  const body = (input ?? {}) as { mode?: string; prompt?: unknown; rule?: Rule }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (prompt.length < 3) return { status: 400, body: { error: 'Describe the rule in a few words.' } }
  if (prompt.length > MAX_PROMPT) return { status: 400, body: { error: `Keep the description under ${MAX_PROMPT} characters.` } }
  if (body.mode !== 'generate' && body.mode !== 'refine') return { status: 400, body: { error: 'Unknown mode.' } }
  if (rateLimited(ip)) return { status: 429, body: { error: 'Too many requests. Try again in a minute.' } }

  let contents: string
  if (body.mode === 'refine') {
    let current: string
    try {
      current = JSON.stringify(toLlm(body.rule as Rule))
    } catch {
      return { status: 400, body: { error: 'The current rule could not be read.' } }
    }
    contents = `Current rule:\n${current}\n\nChange requested: ${prompt}\n\nReturn the complete updated rule.`
  } else {
    contents = `Rule request: ${prompt}`
  }

  const ai = new GoogleGenAI({ apiKey: env.apiKey })
  const model = env.model || DEFAULT_MODEL
  let lastError = ''
  // One retry with the validation error fed back, in case the first answer doesn't fit the schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: attempt === 0 ? contents : `${contents}\n\nYour previous answer was invalid: ${lastError}. Fix it.`,
        config: {
          systemInstruction: domainPrompt(),
          responseMimeType: 'application/json',
          responseJsonSchema,
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      })
      const text = response.text
      if (!text) throw new Error('The model returned an empty response.')
      return { status: 200, body: { rule: fromLlm(JSON.parse(text)) } }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // API errors (auth, quota, model) won't be fixed by retrying.
      if (/API key|permission|quota|not found|429|403|404/i.test(message)) {
        return { status: 502, body: { error: `Gemini error: ${message.slice(0, 300)}` } }
      }
      lastError = message.slice(0, 500)
    }
  }
  return { status: 502, body: { error: 'The AI could not produce a valid rule. Try rephrasing.' } }
}
