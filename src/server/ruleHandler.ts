import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { domainPrompt, fromLlm, llmJsonSchema, toLlm } from '../rules/llm'
import type { Rule } from '../rules/types'

export interface HandlerResult {
  status: number
  body: { rule?: Rule; error?: string }
}

// Flash-Lite handles schema-constrained extraction well and answers in seconds; the larger Flash
// model is the backup when Lite is overloaded or its answer fails validation.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const FALLBACK_MODEL = 'gemini-3.8-flash'
const MAX_PROMPT = 600
/** Per-attempt time limit; past this the request moves on to the other model. */
const ATTEMPT_TIMEOUT_MS = 18_000

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
  const primary = env.model || DEFAULT_MODEL
  let feedback = ''
  let busy = false
  let useThinkingLevel = true
  // Up to 3 attempts: bad output is retried with the validation error fed back; temporary overloads
  // (503/500) and timeouts back off and switch models.
  for (let attempt = 0; attempt < 3; attempt++) {
    // After a slow/overloaded attempt or an invalid answer, try the other model.
    const model = busy || feedback ? FALLBACK_MODEL : primary
    try {
      const response = await ai.models.generateContent({
        model,
        contents: feedback ? `${contents}\n\nYour previous answer was invalid: ${feedback}. Fix it.` : contents,
        config: {
          systemInstruction: domainPrompt(),
          responseMimeType: 'application/json',
          responseJsonSchema,
          temperature: 0.2,
          maxOutputTokens: 4096,
          // Mapping text to a known schema needs little reasoning; low thinking keeps it fast.
          ...(useThinkingLevel && { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
          abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        },
      })
      const text = response.text
      if (!text) throw new Error('The model returned an empty response.')
      try {
        return { status: 200, body: { rule: fromLlm(JSON.parse(text)) } }
      } catch (error) {
        feedback = (error instanceof Error ? error.message : String(error)).slice(0, 500)
        busy = false
        console.error(`[ruleflow] attempt ${attempt + 1} (${model}) returned an invalid rule:`, feedback)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[ruleflow] attempt ${attempt + 1} (${model}) failed:`, message.slice(0, 500))
      if (useThinkingLevel && /thinking/i.test(message)) {
        // Some models don't accept a thinking level; retry without it.
        useThinkingLevel = false
        continue
      }
      if (/API key|PERMISSION_DENIED|RESOURCE_EXHAUSTED|quota|NOT_FOUND|\b40[034]\b/i.test(message)) {
        return { status: 502, body: { error: `Gemini error: ${message.slice(0, 300)}` } }
      }
      // Overloaded / internal errors are usually momentary: wait, then try again.
      busy = true
      await new Promise((r) => setTimeout(r, 600))
    }
  }
  if (busy) {
    return { status: 503, body: { error: 'Gemini is busy right now. Please try again in a moment.' } }
  }
  return { status: 502, body: { error: 'The AI could not produce a valid rule. Try rephrasing.' } }
}
