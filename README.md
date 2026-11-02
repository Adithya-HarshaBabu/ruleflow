# Ruleflow

**Live demo: [ruleflow-six.vercel.app](https://ruleflow-six.vercel.app)**

**Business rules in plain English, powered by Gemini.** Describe a rule like
*“flag orders over $500 from brand-new customers for review”* and Ruleflow turns it into a structured,
fully editable rule, then tests it live against sample orders.

## Features
- **Plain English → rule** with Gemini structured output (JSON Schema), validated with Zod and retried once on bad output
- **Edit with AI:** “also exclude VIPs”, “raise the threshold to $800”
- **Nested rule builder:** ALL/ANY groups, NOT, drag-and-drop between groups (dnd-kit), type-aware operators and inputs
- **Live testing** against 40 sample orders, with a per-order trace showing which conditions passed
- **Flow view** of the rule as a decision diagram (React Flow), with the traced path highlighted
- Plain-English explanation, undo/redo, save to the browser, JSON import and export

## Run locally
```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (https://aistudio.google.com/apikey)
npm run dev                  # http://127.0.0.1:5190
```
The Gemini key stays on the server: `/api/rule` runs as a Vercel Function in production and inside the
Vite dev server locally (same handler, `src/server/ruleHandler.ts`).

## Architecture
- `src/rules/`: domain model, field catalog, evaluator with tracing, explainer, and the LLM schema/converter
- `src/components/`: rule builder, flow view, actions editor, test panel, prompt panel
- `src/server/ruleHandler.ts`: Gemini call, validation, rate limiting
- `api/rule.ts`: Vercel Function entry point

Gemini returns a flat list of nodes with parent links (simpler and more reliable for structured output
than a recursive schema); `fromLlm` rebuilds the tree, coerces values by field type and rejects
anything that doesn't fit.

## Deploy
Import the repo into Vercel and set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default
`gemini-3.5-flash-lite`, with `gemini-3.8-flash` as backup) in the project's environment variables.
