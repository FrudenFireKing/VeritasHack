/**
 * VERITAS — live-mode server.
 *
 * What it does:
 *   1. Serves the built frontend from dist/ (production).
 *   2. /api/health — tells the frontend whether a Tavily key exists (live/demo mode)
 *      and whether an LLM assessor is configured.
 *   3. /api/audit — accepts text, extracts claims, searches live sources
 *      through Tavily, then judges every claim:
 *        - with an LLM (any OpenAI-compatible API) when LLM_API_KEY is set, or
 *        - with the publication-date heuristic as a fallback.
 *
 * The TAVILY_API_KEY and LLM_API_KEY are read from the .env file in the project
 * root. .env is listed in .gitignore — the keys NEVER reach the frontend or git.
 *
 * Run:    npm start        (after npm run build)
 * Port:   8787
 */

import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { extractClaims } from '../src/lib/extract.js'

const require = createRequire(import.meta.url)
const express = require('express')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Minimal .env parser (no external dependencies) ──────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const TAVILY_KEY = process.env.TAVILY_API_KEY || ''
const TAVILY_URL = process.env.TAVILY_BASE_URL || 'https://api.tavily.com/search'
// Optional LLM assessor: any OpenAI-compatible chat completions endpoint.
const LLM_KEY = process.env.LLM_API_KEY || ''
const LLM_URL = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini'
const PORT = process.env.PORT || 8787

const app = express()
app.use(express.json({ limit: '64kb' }))

// IMPORTANT: API routes are registered BEFORE the static file serving,
// otherwise the '*' catch-all would intercept /api/* and live mode would never activate.

// ── Health: live mode or demo ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    mode: TAVILY_KEY ? 'live' : 'demo',
    tavily: Boolean(TAVILY_KEY),
    ai: Boolean(LLM_KEY),
  })
})

// ── Evidence search in Tavily ──────────────────────────────────────────
async function searchEvidence(query, maxResults = 4) {
  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TAVILY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      include_answer: 'basic',
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`tavily ${res.status}`)
  const data = await res.json()
  return (data.results || []).map((r) => {
    // Publication date: Tavily does not always return one — then look for the year in the snippet
    let year = r.published_date ? String(r.published_date).slice(0, 4) : null
    if (!year) {
      const m = String(r.content || '').match(/\b(20\d{2}|19\d{2})\b/)
      year = m ? m[1] : 'n.d.'
    }
    return {
      title: r.title || 'Untitled source',
      year,
      url: r.url,
      // Snippet is the factual basis for the LLM assessor's verdict
      snippet: String(r.content || '').slice(0, 400),
    }
  })
}

/**
 * Freshness heuristic without an LLM: if the sources carry dates and they are
 * fresh — the claim holds; if only old ones — it went stale; with conflicting
 * dates — flag it. An honest pilot: without a model, verdicts stay conservative.
 */
function verdictFromEvidence(claim, evidence, nowYear) {
  if (evidence.length === 0) {
    return {
      verdict: 'UNCONFIRMED',
      confidence: 30,
      explanation: 'Live search returned no usable sources for this claim.',
      fresher: null,
    }
  }
  const years = evidence.map((e) => parseInt(e.year, 10)).filter((y) => !Number.isNaN(y))
  const freshest = Math.max(...years, 0)
  const oldest = Math.min(...years, nowYear)
  const age = nowYear - freshest
  const currentYearMention = new RegExp(`\\b${nowYear}\\b`).test(claim)

  if (currentYearMention && age > 1) {
    return {
      verdict: 'CONTRADICTED',
      confidence: 70,
      explanation: `The claim asserts ${nowYear}, but the freshest live evidence found is from ${freshest}.`,
      fresher: evidence[0]?.title ? `Latest source on record: "${evidence[0].title}" (${freshest}).` : null,
    }
  }
  if (age <= 1) {
    return {
      verdict: 'FRESH',
      confidence: 75,
      explanation: `Live sources from ${freshest} corroborate the claim; nothing fresher contradicts it.`,
      fresher: null,
    }
  }
  if (age <= 3) {
    return {
      verdict: 'STALE',
      confidence: 60,
      explanation: `The freshest live evidence is ${freshest}; the claim may have drifted since (oldest source: ${oldest}).`,
      fresher: evidence[0]?.title ? `Latest source on record: "${evidence[0].title}" (${freshest}).` : null,
    }
  }
  return {
    verdict: 'STALE',
    confidence: 45,
    explanation: `All live evidence predates ${nowYear - 2}: the claim is drawn from an older snapshot of the world.`,
    fresher: null,
  }
}

// ── LLM assessment of a claim against live evidence ────────────────
// Any OpenAI-compatible chat completions endpoint works:
// OpenAI, Groq, OpenRouter, Gemini (OpenAI-compat mode), local Ollama, etc.
const VERDICTS = new Set(['FRESH', 'STALE', 'CONTRADICTED', 'UNCONFIRMED'])

function buildLlmMessages(claim, evidence, nowYear) {
  const evidenceText = evidence
    .map((e, i) => `- [${i + 1}] (${e.year}) ${e.title}: ${e.snippet || 'no snippet'}`)
    .join('\n')
  return [
    {
      role: 'system',
      content:
        `You are the freshness auditor of VERITAS, a stale-answer detector for AI-generated answers. ` +
        `Today's year is ${nowYear}. You receive one claim taken from an AI answer and live web evidence ` +
        `(title, publication year, snippet) found by the Tavily search engine.\n` +
        `Judge ONLY the temporal accuracy of the claim against this evidence:\n` +
        `- "FRESH": recent evidence corroborates the claim as still accurate today;\n` +
        `- "STALE": the claim was once true but evidence shows the fact has aged, changed or drifted;\n` +
        `- "CONTRADICTED": evidence directly refutes the claim;\n` +
        `- "UNCONFIRMED": evidence is irrelevant or insufficient to judge.\n` +
        `Respond with ONLY a minified JSON object, no markdown fences, no extra text, in this exact shape:\n` +
        `{"verdict":"FRESH|STALE|CONTRADICTED|UNCONFIRMED","confidence":<integer 0-100>,` +
        `"explanation":"<one short sentence citing the freshest source year>",` +
        `"fresher":"<the corrected up-to-date fact with its year, or null>"}`,
    },
    {
      role: 'user',
      content: `Claim: "${claim}"\n\nLive evidence:\n${evidenceText}`,
    },
  ]
}

/** Extracts a strict verdict object from an LLM reply that may contain prose or fences. */
function parseLlmVerdict(raw) {
  const text = String(raw || '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no JSON in LLM reply')
  const parsed = JSON.parse(text.slice(start, end + 1))
  const verdict = String(parsed.verdict || '').toUpperCase()
  if (!VERDICTS.has(verdict)) throw new Error(`bad verdict: ${verdict}`)
  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)))
  const fresherRaw = parsed.fresher
  const fresher =
    fresherRaw && String(fresherRaw).trim().toLowerCase() !== 'null'
      ? String(fresherRaw).slice(0, 240)
      : null
  return {
    verdict,
    confidence,
    explanation: String(parsed.explanation || 'Assessed by the LLM against live evidence.').slice(0, 300),
    fresher,
    evaluator: 'llm',
  }
}

/**
 * Judges a claim with the configured LLM. Returns null on any failure —
 * the caller then falls back to the date heuristic, so a broken LLM key
 * never breaks the audit.
 */
async function evaluateWithLLM(claim, evidence, nowYear) {
  if (!LLM_KEY || evidence.length === 0) return null
  try {
    const res = await fetch(`${LLM_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LLM_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0,
        max_tokens: 300,
        messages: buildLlmMessages(claim, evidence, nowYear),
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`llm ${res.status}`)
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    return parseLlmVerdict(content)
  } catch (err) {
    console.warn(`[veritas] LLM assessment skipped for a claim: ${err.message}`)
    return null
  }
}

const SCORE = { FRESH: 100, UNCONFIRMED: 50, STALE: 15, CONTRADICTED: 0 }
function verdictLabel(index) {
  if (index >= 80) return 'Fit to Bottle'
  if (index >= 55) return 'Cellar With Care'
  if (index >= 30) return 'Pour It Out'
  return 'Unfit to Bottle'
}

// ── Main audit route ────────────────────────────────────────────────────
app.post('/api/audit', async (req, res) => {
  const started = Date.now()
  const text = String(req.body?.text || '').slice(0, 6000)
  if (!text.trim()) return res.status(400).json({ error: 'text is required' })

  if (!TAVILY_KEY) {
    return res.status(503).json({ error: 'live mode unavailable: no TAVILY_API_KEY' })
  }

  const nowYear = new Date().getFullYear()
  const claims = extractClaims(text, 5)

  try {
    const reports = await Promise.all(
      claims.map(async (c) => {
        // Strip "noise" words so the search query stays precise
        const query = c.claim.replace(/^(the|a|an)\s+/i, '').slice(0, 180)
        let evidence = []
        try {
          evidence = await searchEvidence(query)
        } catch {
          evidence = []
        }
        // Prefer the LLM verdict; fall back to the date heuristic on any failure.
        const v = (await evaluateWithLLM(c.claim, evidence, nowYear)) || {
          ...verdictFromEvidence(c.claim, evidence, nowYear),
          evaluator: 'heuristic',
        }
        return {
          claim: c.claim,
          type: c.type,
          verdict: v.verdict,
          confidence: v.confidence,
          explanation: v.explanation,
          fresher: v.fresher,
          evaluator: v.evaluator,
          evidence: evidence.slice(0, 4),
        }
      })
    )

    const index =
      reports.length > 0
        ? Math.round(reports.reduce((acc, c) => acc + SCORE[c.verdict], 0) / reports.length)
        : 0
    const aiAssessed = reports.filter((c) => c.evaluator === 'llm').length

    return res.json({
      mode: 'live',
      aiAssessed,
      examinedAt: new Date().toISOString(),
      elapsedSec: Math.round(((Date.now() - started) / 1000) * 10) / 10,
      index,
      verdictLabel: verdictLabel(index),
      summary:
        index >= 55
          ? 'The live audit finds the batch serviceable: most claims hold against current web evidence.'
          : 'The live audit finds the batch aged: several claims no longer match the freshest web evidence.',
      claims: reports,
    })
  } catch (err) {
    console.error('[veritas] audit failed:', err.message)
    return res.status(500).json({ error: 'audit failed' })
  }
})

// ── Static serving of the built frontend (after the API routes) ────────
const distDir = path.join(ROOT, 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => {
  const indexFile = path.join(distDir, 'index.html')
  // Checked dynamically: the build is picked up without a server restart
  if (existsSync(indexFile)) return res.sendFile(indexFile)
  res
    .status(503)
    .type('html')
    .send(
      '<meta charset="utf-8"><body style="font-family:sans-serif;background:#12160d;color:#efeddc;padding:40px">' +
        '<h2>VERITAS: the frontend is not built yet</h2><p>Run <code>npm run build</code> and reload the page.</p>' +
        '<p>For development, <code>npm run dev</code> is more convenient (http://localhost:5173).</p></body>'
    )
})

app.listen(PORT, () => {
  console.log(`[veritas] server on http://localhost:${PORT}`)
  console.log(
    `[veritas] mode: ${TAVILY_KEY ? 'LIVE (Tavily)' : 'DEMO (no TAVILY_API_KEY)'}` +
      (LLM_KEY ? ` | LLM assessor: ${LLM_MODEL}` : ' | LLM assessor: off (date heuristic)')
  )
})
