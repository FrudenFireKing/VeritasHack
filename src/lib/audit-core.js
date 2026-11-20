/**
 * VERITAS — audit core: the pure "brain" of the audit.
 *
 * Dependency-free module shared by the live-mode server (server/server.mjs),
 * the demo engine and the vitest suite. It contains everything that decides
 * or shapes a verdict:
 *   - buildQueries          → Tavily search queries for a claim
 *   - pickPublicationYear   → honest publication-year extraction (no snippet guessing)
 *   - domainsForClaim       → official vendor domains for version claims
 *   - verdictFromEvidence   → date-heuristic fallback when no LLM is configured
 *   - buildLlmMessages      → assessor prompt with the speculation guard
 *   - parseLlmVerdict       → strict JSON verdict parsing
 *   - SCORE / verdictLabel  → the 0–100 index and the wine-cellar scale
 */

// ── Search queries ─────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'for', 'with',
  'by', 'from', 'as', 'that', 'this', 'it', 'its', 'is', 'are', 'was', 'were',
  'be', 'been', 'has', 'have', 'had', 'while', 'then', 'than', 'there', 'their',
])

/**
 * Builds search queries from a claim: a cleaned full sentence first, then a
 * compact keyword query as a fallback (long verbose sentences often miss).
 */
export function buildQueries(claim) {
  const clean = String(claim || '')
    // Strip typographic quotes only — a straight apostrophe in "OpenAI's" is fine for search
    .replace(/[\u00AB\u00BB\u201C\u201D\u2018\u2019]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/, '')
  const primary = clean.replace(/^(the|a|an)\s+/i, '').slice(0, 180)
  const keywords = clean
    .replace(/'\w+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9$.+,\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .slice(0, 12)
    .join(' ')
  // Deduplicate: the keyword query only makes sense when it differs from the primary one
  return keywords && keywords !== primary.toLowerCase() ? [primary, keywords] : [primary]
}

// ── Publication years ──────────────────────────────────────────────────

const YEAR_IN_TEXT = /\b(19|20)\d{2}\b/

/**
 * Extracts a trustworthy publication year.
 * Rule (jury fix V5): only a real published_date counts — a year scraped out
 * of a snippet text is guesswork ("…Worldwide 2026" dated 2013). Anything
 * outside the sane range (1995 … this year) is treated as "n.d.".
 */
export function pickPublicationYear(publishedDate, nowYear = new Date().getFullYear()) {
  if (publishedDate) {
    const m = String(publishedDate).match(YEAR_IN_TEXT)
    if (m) {
      const y = Number(m[0]) // m[0] is the full 4-digit year
      if (y >= 1995 && y <= nowYear) return String(y)
    }
  }
  return 'n.d.'
}

// ── Official vendor domains for version claims ─────────────────────────

const VERSION_DOMAINS = [
  { re: /\b(windows|microsoft|office|xbox|edge|copilot)\b/i, domains: ['microsoft.com', 'learn.microsoft.com', 'support.microsoft.com'] },
  { re: /\b(macos|mac os|ios|ipados|ipad|iphone|watchos|tvos|visionos|apple)\b/i, domains: ['apple.com', 'support.apple.com', 'developer.apple.com'] },
  { re: /\bandroid\b/i, domains: ['android.com', 'blog.google', 'developer.android.com'] },
  { re: /\bchrome(os)?\b/i, domains: ['chromereleases.googleblog.com', 'blog.google'] },
  { re: /\bpython\b/i, domains: ['python.org', 'docs.python.org'] },
  { re: /\bnode\.?js\b/i, domains: ['nodejs.org'] },
  { re: /\breact\b/i, domains: ['react.dev', 'reactjs.org'] },
  { re: /\bopenai|gpt-\d|chatgpt\b/i, domains: ['openai.com', 'help.openai.com'] },
  { re: /\bjava\b/i, domains: ['oracle.com', 'openjdk.org'] },
  { re: /\bphp\b/i, domains: ['php.net'] },
  { re: /\brust\b/i, domains: ['rust-lang.org', 'blog.rust-lang.org'] },
  { re: /\bgolang|\bgo\s+\d+\.\d+\b/i, domains: ['go.dev'] },
]

/**
 * Returns the official vendor domains for a claim about software versions,
 * or null when the claim is not a version claim or the vendor is unknown.
 * Used to steer Tavily with include_domains so a "Windows 12" question is
 * answered by microsoft.com — not by rumor blogs.
 */
export function domainsForClaim(claim) {
  const text = String(claim || '')
  if (!/\b(version|released?|launch|upgrade|update|v\d+|latest)\b/i.test(text)) return null
  for (const { re, domains } of VERSION_DOMAINS) {
    if (re.test(text)) return domains
  }
  return null
}

/**
 * True when at least one evidence URL comes from the claim's official vendor
 * domain — used to cap over-confident FRESH verdicts on version claims.
 */
export function hasVendorSource(claim, evidence) {
  const domains = domainsForClaim(claim)
  if (!domains) return true // not a vendor-checkable claim — nothing to demand
  return (evidence || []).some((e) => {
    try {
      const host = String(e?.url || '').replace(/^https?:\/\//, '').replace(/^www\./, '')
      return domains.some((d) => host.startsWith(d) || host.includes(`.${d}`))
    } catch {
      return false
    }
  })
}

// ── Verdict model ──────────────────────────────────────────────────────

export const VERDICTS = new Set(['FRESH', 'STALE', 'CONTRADICTED', 'UNCONFIRMED'])

export const SCORE = { FRESH: 100, UNCONFIRMED: 50, STALE: 15, CONTRADICTED: 0 }

/** Overall batch grade — on the atelier's wine scale. */
export function verdictLabel(index) {
  if (index >= 80) return 'Fit to Bottle'
  if (index >= 55) return 'Cellar With Care'
  if (index >= 30) return 'Pour It Out'
  return 'Unfit to Bottle'
}

/**
 * Freshness heuristic without an LLM: if the sources carry dates and they are
 * fresh — the claim holds; if only old ones — it went stale; with conflicting
 * dates — flag it. An honest pilot: without a model, verdicts stay conservative.
 */
export function verdictFromEvidence(claim, evidence, nowYear, searchError) {
  if (evidence.length === 0) {
    return {
      verdict: 'UNCONFIRMED',
      confidence: 30,
      explanation: searchError
        ? `Live search failed (${searchError}). The claim could not be checked against the web.`
        : 'Live search returned no usable sources for this claim.',
      fresher: null,
    }
  }
  const years = evidence.map((e) => parseInt(e.year, 10)).filter((y) => !Number.isNaN(y))
  // Undated is not ancient: Tavily returns a real published_date only for some
  // results, and snippet-scraped years are guesswork (V5 rule). If NO source
  // carries a usable date there is nothing to measure age against — the honest
  // verdict is UNCONFIRMED, not STALE (jury fix V9: missing dates used to
  // collapse every claim into "evidence predates 2024" → 45% STALE).
  if (years.length === 0) {
    return {
      verdict: 'UNCONFIRMED',
      confidence: 35,
      explanation:
        'None of the live sources carries a publication date, so the freshness heuristic cannot judge the claim. An LLM assessor would judge it on content.',
      fresher: null,
    }
  }
  const freshest = Math.max(...years)
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
    explanation: `The freshest dated source found is from ${freshest}: the claim is drawn from an older snapshot of the world.`,
    fresher: null,
  }
}

// ── LLM assessor prompt ────────────────────────────────────────────────

/**
 * Builds the assessor conversation. The system prompt carries the speculation
 * guard (jury fix V4): articles that merely discuss or speculate about a fact
 * must never confirm it — the original pipeline famously turned "Windows 12,
 * released in 2025" rumor coverage into a confident FRESH.
 */
export function buildLlmMessages(claim, evidence, nowYear) {
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
        `SPECULATION GUARD — this is the most important rule:\n` +
        `- An article that discusses, speculates, asks or rumors about whether X will exist or happen is NOT confirmation of X. ` +
        `Phrases like "could come", "is expected", "rumored", "leaked", "we think", "what to expect" describe a hypothesis, not a fact.\n` +
        `- Treat such speculation as no confirmation: answer UNCONFIRMED (or CONTRADICTED if other evidence shows the opposite).\n` +
        `- For claims about product versions or releases, only an official vendor source (release notes, documentation, vendor announcement) ` +
        `may confirm the fact. If no official source is present, lower the confidence accordingly.\n` +
        `- A snippet's mention of a year is not proof of a release date; check what the sentence actually asserts.\n` +
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
export function parseLlmVerdict(raw) {
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