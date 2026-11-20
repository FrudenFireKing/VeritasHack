/**
 * VERITAS — E2E harness.
 *
 * The full report pipeline exercised the way production runs it: the real
 * server/server.mjs is spawned as a child process on an ephemeral port,
 * with TAVILY_BASE_URL and the LLM/Bifrost endpoint pointed at local mock
 * upstreams. This covers, end to end:
 *   - Bifrost gateway routing (BIFROST_BASE_URL wins over direct endpoints);
 *   - the assessor prompt (speculation guard) and strict-JSON verdict parsing;
 *   - Tavily advanced search depth + official vendor-domain steering;
 *   - the vendor-confidence cap on FRESH version claims;
 *   - the TTL search cache (identical audits do not re-hit Tavily);
 *   - the date-heuristic fallback when the model upstream fails;
 *   - the rate limiter on the public audit route (40 per 15 minutes).
 */
import { describe, it, expect, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_ENTRY = path.join(ROOT, 'server', 'server.mjs')
const E2E_TIMEOUT = 30000

// ── Mock upstreams: one HTTP server playing Tavily and the LLM gateway ──
function startUpstreams() {
  const state = {
    tavilyHits: 0,
    llmHits: 0,
    llmAuth: [],
    tavilyRequests: [],
    llmRequests: [],
    tavilyResult: {
      results: [
        {
          title: 'Mock source: the claim holds',
          url: 'https://blog.example.com/react-release',
          content: 'A 2026 mock snippet confirming the fact for the harness.',
          published_date: '2026-02-10',
        },
      ],
    },
    llmContent:
      '{"verdict":"FRESH","confidence":90,"explanation":"Mock evidence from 2026 corroborates the claim.","fresher":null}',
    llmStatus: 200,
  }
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      let body = {}
      try {
        body = raw ? JSON.parse(raw) : {}
      } catch {
        body = {}
      }
      if (req.url.includes('/tavily')) {
        state.tavilyHits += 1
        state.tavilyRequests.push(body)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(state.tavilyResult))
        return
      }
      // everything else under /llm* behaves like an OpenAI-compatible gateway
      state.llmHits += 1
      state.llmAuth.push(req.headers.authorization || null)
      state.llmRequests.push(body)
      res.setHeader('Content-Type', 'application/json')
      if (state.llmStatus !== 200) {
        res.statusCode = state.llmStatus
        res.end(JSON.stringify({ error: 'mock upstream failure' }))
        return
      }
      res.end(JSON.stringify({ choices: [{ message: { content: state.llmContent } }] }))
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, state }))
  })
}

// ── Spawn server/server.mjs as the production entry point ──────────────
function startVeritas(port, upstreamPort, { gateway, auth } = {}) {
  const env = {
    ...process.env,
    PORT: String(port),
    TAVILY_API_KEY: 'tvly-e2e-mock',
    TAVILY_BASE_URL: `http://127.0.0.1:${upstreamPort}/tavily/search`,
    // keep a stray developer .env from overriding the mock endpoints
    LLM_BASE_URL: gateway === 'bifrost' ? '' : `http://127.0.0.1:${upstreamPort}/llm/v1`,
    LLM_API_KEY: 'llm-e2e-mock',
    ...(gateway === 'bifrost'
      ? {
          BIFROST_BASE_URL: `http://127.0.0.1:${upstreamPort}/llm/v1`,
          BIFROST_API_KEY: 'bfr-e2e-mock',
          BIFROST_MODEL: 'mock-model-via-bifrost',
          ...(auth ? { BIFROST_AUTH: auth } : {}),
        }
      : {}),
  }
  const child = spawn(process.execPath, [SERVER_ENTRY], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const stderr = []
  child.stderr.on('data', (d) => stderr.push(String(d)))
  return { child, stderr }
}

async function waitHealthy(port, child, stderr, ms = 10000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (res.ok) return await res.json()
    } catch {
      /* server not up yet */
    }
    if (child.exitCode !== null) {
      throw new Error(`server exited early:\n${stderr.join('')}`)
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`server on :${port} never became healthy:\n${stderr.join('')}`)
}

async function audit(port, text) {
  const res = await fetch(`http://127.0.0.1:${port}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return { status: res.status, body: await res.json() }
}

// ── Ephemeral ports, claimed by binding to :0 first ─────────────────────
async function freePort() {
  return new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port
      s.close(() => resolve(port))
    })
  })
}

const STACK = [] // { server?, child? } — closed/killed in afterAll
async function boot({ gateway, auth } = {}) {
  // Bind the mock upstream first (kernel-assigned port) — the child is then
  // spawned with the upstream's ACTUAL port in its env URLs.
  const upstream = await startUpstreams()
  const veritasPort = await freePort()
  const { child, stderr } = startVeritas(veritasPort, upstream.port, { gateway, auth })
  const health = await waitHealthy(veritasPort, child, stderr)
  const instance = { server: upstream.server, child }
  STACK.push(instance)
  return { port: veritasPort, state: upstream.state, health }
}

afterAll(() => {
  for (const { server, child } of STACK) {
    try {
      server?.close()
      child?.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
})

const REACT_VERSION_CLAIM = 'The latest version of React was released in 2024.'
const ARTEMIS_CLAIM = 'NASA launched the Artemis II mission in November 2025.'

describe('VERITAS end-to-end (mocked Tavily + Bifrost upstreams)', () => {
  it(
    'routes the assessor through the Bifrost gateway and sends the speculation-guard prompt',
    async () => {
      const { port, state, health } = await boot({ gateway: 'bifrost' })

      // Health announces the gateway, exactly what the UI badge shows.
      expect(health.mode).toBe('live')
      expect(health.gateway).toBe('bifrost')

      const { status, body } = await audit(port, ARTEMIS_CLAIM)
      expect(status).toBe(200)
      expect(body.gateway).toBe('bifrost')
      expect(body.aiAssessed).toBe(1)
      expect(body.claims[0].evaluator).toBe('llm')
      expect(body.claims[0].verdict).toBe('FRESH')
      expect(body.claims[0].confidence).toBe(90)

      // Tavily upstream: advanced search depth, dated sources requested.
      expect(state.tavilyRequests[0].search_depth).toBe('advanced')

      // Assessor upstream: the Bifrost-routed call carries the model name,
      // the speculation guard and the claim/evidence pair.
      expect(state.llmRequests[0].model).toBe('mock-model-via-bifrost')
      const system = state.llmRequests[0].messages[0].content
      expect(system).toContain('SPECULATION GUARD')
      expect(system).toContain('UNCONFIRMED')
      expect(state.llmRequests[0].messages[1].content).toContain(ARTEMIS_CLAIM)
    },
    E2E_TIMEOUT
  )

  it(
    'sends Basic credentials when BIFROST_AUTH=basic (panel auth enabled)',
    async () => {
      const { port, state } = await boot({ gateway: 'bifrost', auth: 'basic' })

      const { status, body } = await audit(port, ARTEMIS_CLAIM)
      expect(status).toBe(200)
      expect(body.gateway).toBe('bifrost')
      expect(body.claims[0].evaluator).toBe('llm')
      // The gateway is addressed with admin Basic credentials (base64 of
      // "admin:password") instead of a Bearer token.
      expect(state.llmAuth[0]).toBe('Basic bfr-e2e-mock')
    },
    E2E_TIMEOUT
  )

  it(
    'steers version claims to official vendor domains and caps overconfident FRESH verdicts',
    async () => {
      const { port, state } = await boot() // direct OpenAI-compatible endpoint

      const { status, body } = await audit(port, REACT_VERSION_CLAIM)
      expect(status).toBe(200)

      // First search attempt is restricted to the official vendor domains.
      expect(state.tavilyRequests[0].include_domains).toEqual(['react.dev', 'reactjs.org'])

      // Mock sources are NOT vendor pages, so a FRESH version claim from the
      // LLM (confidence 90) must be capped at 65 and labelled.
      const claim = body.claims[0]
      expect(claim.type).toBe('VERSION')
      expect(claim.verdict).toBe('FRESH')
      expect(claim.confidence).toBeLessThanOrEqual(65)
      expect(claim.explanation).toContain('confidence capped')
    },
    E2E_TIMEOUT
  )

  it(
    'caches Tavily searches: an identical audit does not re-hit the upstream',
    async () => {
      const { port, state } = await boot()

      const first = await audit(port, ARTEMIS_CLAIM)
      const hitsAfterFirst = state.tavilyHits
      expect(hitsAfterFirst).toBeGreaterThan(0)

      const second = await audit(port, ARTEMIS_CLAIM)
      expect(state.tavilyHits).toBe(hitsAfterFirst)
      expect(second.status).toBe(first.status)
      expect(second.body.index).toBe(first.body.index)
    },
    E2E_TIMEOUT
  )

  it(
    'falls back to the publication-date heuristic when the model upstream fails',
    async () => {
      const { port, state } = await boot()
      state.llmStatus = 500 // the gateway is down — the audit must survive

      const { status, body } = await audit(port, REACT_VERSION_CLAIM)
      expect(status).toBe(200)
      const claim = body.claims[0]
      expect(claim.evaluator).toBe('heuristic')
      // Evidence is dated 2026 — the same year as the audit — so FRESH...
      expect(claim.verdict).toBe('FRESH')
      // ...but the mock sources are non-vendor pages, so the version claim's
      // confidence is capped at 65 even on the heuristic path.
      expect(claim.confidence).toBe(65)
      expect(claim.explanation).toContain('confidence capped')
    },
    E2E_TIMEOUT
  )

  it(
    'rate-limits the public audit route at 40 requests per 15 minutes',
    async () => {
      const { port } = await boot()

      let lastOk = 0
      let limited = null
      for (let i = 0; i < 41; i++) {
        const { status, body } = await audit(port, ARTEMIS_CLAIM)
        if (status === 200) lastOk += 1
        else {
          limited = { status, body }
          break
        }
      }
      expect(lastOk).toBe(40)
      expect(limited.status).toBe(429)
      expect(limited.body.error).toContain('rate limit')
    },
    E2E_TIMEOUT
  )
})
