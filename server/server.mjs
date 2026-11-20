/**
 * VERITAS — live-mode server.
 *
 * What it does:
 *   1. Serves the built frontend from dist/ (production).
 *   2. /api/health — tells the frontend whether a Tavily key exists (live/demo mode)
 *      and whether an LLM assessor is configured (and through which gateway).
 *   3. /api/audit — accepts text, extracts claims, searches live sources
 *      through Tavily, then judges every claim:
 *        - with an LLM routed through the Bifrost gateway (track requirement)
 *          or any other OpenAI-compatible endpoint, and
 *        - with the publication-date heuristic as a fallback.
 *
 * Keys are read from the .env file in the project root. .env is listed in
 * .gitignore — the keys NEVER reach the frontend or git.
 *
 * Run:    npm start        (after npm run build)
 * Port:   8787
 */

import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { extractClaims } from '../src/lib/extract.js'
import {
  buildQueries,
  pickPublicationYear,
  domainsForClaim,
  hasVendorSource,
  verdictFromEvidence,
  buildLlmMessages,
  parseLlmVerdict,
  verdictLabel,
} from '../src/lib/audit-core.js'

const require = createRequire(import.meta.url)
const express = require('express')
const rateLimit = require('express-rate-limit')

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

// ── Assessor endpoint: Bifrost first (track requirement), then any gateway ──
// Bifrost by Maxim AI is an open-source AI gateway exposing an OpenAI-compatible
// API (default http://localhost:8080/v1/chat/completions). Point BIFROST_BASE_URL
// at a Bifrost deployment and every assessor call is routed, logged and governed
// by the gateway instead of hitting a model vendor directly.
const BIFROST_URL = (process.env.BIFROST_BASE_URL || '').replace(/\/$/, '')
// BIFROST_AUTH selects the Authorization header style: 'bearer' (default) sends
// `Bearer <BIFROST_API_KEY>`; 'basic' sends `Basic <BIFROST_API_KEY>` — used when
// panel authentication is enabled in Bifrost, where the gateway expects
// Basic credentials (base64 of "admin:password", shown in the Bifrost UI).
const BIFROST_AUTH = (process.env.BIFROST_AUTH || 'bearer').toLowerCase() === 'basic' ? 'basic' : 'bearer'
const LLM_KEY = process.env.BIFROST_API_KEY || process.env.LLM_API_KEY || ''
const LLM_URL = BIFROST_URL || (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const LLM_MODEL = process.env.BIFROST_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini'
const PORT = process.env.PORT || 8787

const app = express()
app.use(express.json({ limit: '64kb' }))

// ── Rate limiting: the public audit route must not burn the Tavily quota ──
const auditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate limit reached: too many audits from this address, try again in a few minutes' },
})

// IMPORTANT: API routes are registered BEFORE the static file serving,
// otherwise the '*' catch-all would intercept /api/* and live mode would never activate.

// ── Health: live mode or demo ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    mode: TAVILY_KEY ? 'live' : 'demo',
    tavily: Boolean(TAVILY_KEY),
    ai: Boolean(LLM_KEY),
    gateway: BIFROST_URL ? 'bifrost' : LLM_KEY ? 'direct' : 'none',
  })
})

// ── TTL cache for Tavily searches (jury fix V8) ────────────────────────
// Repeated audits of the same text should not pay the full search price —
// and the public endpoint must not be able to drain the quota either.
const CACHE_TTL_MS = 20 * 60 * 1000
const CACHE_MAX_ENTRIES = 300
const searchCache = new Map()

function cacheGet(key) {
  const hit = searchCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) {
    searchCache.delete(key)
    return null
  }
  return hit.value
}

function cacheSet(key, value) {
  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    // evict the oldest entry (insertion order)
    searchCache.delete(searchCache.keys().next().value)
  }
  searchCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
}

// ── Evidence search in Tavily ──────────────────────────────────────────
async function searchEvidence(query, maxResults = 4, includeDomains = null) {
  const cacheKey = `${includeDomains ? includeDomains.join('|') : '*'}::${query}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  let res
  try {
    res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TAVILY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        include_answer: 'basic',
        search_depth: 'advanced', // deeper content extraction → better dating (jury fix V5)
        ...(includeDomains ? { include_domains: includeDomains } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    // Network/DNS/timeout failures — name the cause instead of a silent empty set
    throw new Error(`network: ${err?.cause?.code || err.name || 'fetch failed'}`)
  }
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 160)
    } catch {}
    console.warn(
      `[veritas] tavily HTTP ${res.status} for query "${query.slice(0, 60)}…"${detail ? ` — ${detail}` : ''}`
    )
    throw new Error(`tavily HTTP ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  const data = await res.json()
  if ((data.results || []).length === 0) {
    console.log(`[veritas] tavily: 0 results for "${query.slice(0, 60)}…"`)
  }
  const evidence = (data.results || []).map((r) => {
    // Publication date: only a real published_date counts — a year scraped from
    // a snippet is guesswork, so anything absent/implausible becomes "n.d."
    const year = pickPublicationYear(r.published_date)
    return {
      title: r.title || 'Untitled source',
      year,
      url: r.url,
      // Snippet is the factual basis for the LLM assessor's verdict
      snippet: String(r.content || '').slice(0, 400),
    }
  })
  cacheSet(cacheKey, evidence)
  return evidence
}

/**
 * Freshness heuristic without an LLM lives in src/lib/audit-core.js
 * (verdictFromEvidence) so the vitest suite can exercise it headlessly.
 */

// ── LLM assessment of a claim against live evidence ────────────────────
// The assessor talks to the Bifrost gateway (BIFROST_BASE_URL) when configured,
// otherwise to any OpenAI-compatible endpoint (LLM_BASE_URL).
// OpenAI, Groq, OpenRouter, Gemini (OpenAI-compat mode), local Ollama, etc.
async function evaluateWithLLM(claim, evidence, nowYear) {
  if (!LLM_KEY || evidence.length === 0) return null
  try {
    const res = await fetch(`${LLM_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: BIFROST_AUTH === 'basic' ? `Basic ${LLM_KEY}` : `Bearer ${LLM_KEY}`,
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

// ── Main audit route ────────────────────────────────────────────────────
app.post('/api/audit', auditLimiter, async (req, res) => {
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
        // Primary query: the cleaned claim. Fallback: compact keywords — tried
        // only when the primary search errors out or comes back empty.
        // Version claims additionally get a first attempt restricted to the
        // official vendor domains, so "Windows 12" is answered by microsoft.com
        // rather than by rumor blogs (jury fix V4).
        const queries = buildQueries(c.claim)
        const officialDomains = domainsForClaim(c.claim)
        let evidence = []
        let searchError = null
        const attempts = officialDomains
          ? queries.flatMap((q) => [
              { q, domains: officialDomains },
              { q, domains: null },
            ])
          : queries.map((q) => ({ q, domains: null }))
        for (const { q, domains } of attempts) {
          try {
            evidence = await searchEvidence(q, 4, domains)
            if (evidence.length > 0) break
          } catch (err) {
            if (!searchError) searchError = err.message
          }
        }
        // Prefer the LLM verdict; fall back to the date heuristic on any failure.
        let v = (await evaluateWithLLM(c.claim, evidence, nowYear)) || {
          ...verdictFromEvidence(c.claim, evidence, nowYear, searchError),
          evaluator: 'heuristic',
        }
        // Vendor-confidence cap: a FRESH version claim with no official vendor
        // source among the results cannot be more than 65% confident.
        if (c.type === 'VERSION' && v.verdict === 'FRESH' && !hasVendorSource(c.claim, evidence)) {
          v = {
            ...v,
            confidence: Math.min(v.confidence, 65),
            explanation: `${v.explanation} (no official vendor source among the results — confidence capped).`,
          }
        }
        return {
          claim: c.claim,
          type: c.type,
          verdict: v.verdict,
          confidence: v.confidence,
          explanation: v.explanation,
          fresher: v.fresher,
          evaluator: v.evaluator,
          searchError: evidence.length === 0 ? searchError : null,
          evidence: evidence.slice(0, 4),
        }
      })
    )

    const index =
      reports.length > 0
        ? Math.round(
            reports.reduce((acc, c) => acc + { FRESH: 100, UNCONFIRMED: 50, STALE: 15, CONTRADICTED: 0 }[c.verdict], 0) /
              reports.length
          )
        : 0
    const aiAssessed = reports.filter((c) => c.evaluator === 'llm').length

    return res.json({
      mode: 'live',
      gateway: BIFROST_URL ? 'bifrost' : 'direct',
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
      (LLM_KEY
        ? ` | assessor: ${LLM_MODEL} via ${BIFROST_URL ? `Bifrost gateway (${BIFROST_AUTH} auth)` : 'direct endpoint'}`
        : ' | assessor: off (date heuristic)')
  )
})
