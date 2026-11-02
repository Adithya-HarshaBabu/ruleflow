import { handleRuleRequest } from '../src/server/ruleHandler.js'

// Vercel Function (Node.js runtime): POST /api/rule
export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const input = await request.json().catch(() => null)
  const { status, body } = await handleRuleRequest(
    input,
    { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL },
    ip,
  )
  return Response.json(body, { status })
}
