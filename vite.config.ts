import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Serves /api/rule in development with the same handler the Vercel Function uses.
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'ruleflow-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/rule', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let input: unknown = null
        try {
          input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          /* handled as a bad request below */
        }
        const { handleRuleRequest } = await server.ssrLoadModule('/src/server/ruleHandler.ts')
        const { status, body } = await handleRuleRequest(input, { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL })
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApi(env)],
    server: { host: '127.0.0.1', port: 5190, strictPort: true },
  }
})
