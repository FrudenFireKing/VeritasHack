import { describe, it, expect } from 'vitest'
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

describe('buildQueries', () => {
  it('keeps the possessive apostrophe in brand names', () => {
    const [primary] = buildQueries("OpenAI's pricing changed in 2023.")
    expect(primary).toContain("OpenAI's pricing")
  })

  it('strips stopwords from the keyword fallback', () => {
    const [, keywords] = buildQueries('The largest social network in the world is Facebook.')
    expect(keywords.split(' ')).not.toContain('the')
    expect(keywords).toContain('facebook')
  })

  it('returns a single query when the keyword version adds nothing', () => {
    const queries = buildQueries('Facebook')
    expect(queries).toHaveLength(1)
  })
})

describe('pickPublicationYear (jury fix V5)', () => {
  const NOW = 2026

  it('trusts a real published_date', () => {
    expect(pickPublicationYear('2025-11-03', NOW)).toBe('2025')
  })

  it('does not guess the year from snippet text', () => {
    expect(pickPublicationYear(null, NOW)).toBe('n.d.')
    expect(pickPublicationYear('', NOW)).toBe('n.d.')
  })

  it('rejects implausible years outside 1995…now', () => {
    expect(pickPublicationYear('1899-01-01', NOW)).toBe('n.d.')
    expect(pickPublicationYear('2030-05-20', NOW)).toBe('n.d.')
  })
})

describe('domainsForClaim / hasVendorSource (jury fix V4)', () => {
  it('maps Windows claims to official Microsoft domains', () => {
    expect(domainsForClaim('The latest major Windows version is Windows 12, released in 2025.')).toContain(
      'microsoft.com'
    )
  })

  it('returns null for non-version claims', () => {
    expect(domainsForClaim('The Boeing 747 remains the largest passenger aircraft.')).toBeNull()
  })

  it('recognises a vendor source among the evidence', () => {
    const evidence = [
      { title: 'Some blog', year: '2025', url: 'https://blog.example.com/windows-12' },
      { title: 'Microsoft announcement', year: '2025', url: 'https://learn.microsoft.com/en-us/windows/whats-new' },
    ]
    expect(hasVendorSource('The latest Windows version is Windows 12.', evidence)).toBe(true)
  })

  it('flags the absence of a vendor source', () => {
    const evidence = [{ title: 'Rumor blog', year: '2025', url: 'https://rumors.example.com/windows-12-coming' }]
    expect(hasVendorSource('The latest Windows version is Windows 12.', evidence)).toBe(false)
  })
})

describe('verdictFromEvidence', () => {
  it('returns UNCONFIRMED when there is no evidence', () => {
    const v = verdictFromEvidence('Some claim.', [], 2026, 'tavily HTTP 432')
    expect(v.verdict).toBe('UNCONFIRMED')
    expect(v.explanation).toContain('tavily HTTP 432')
  })

  it('returns FRESH when evidence is at most one year old', () => {
    const v = verdictFromEvidence('Claim.', [{ year: '2025' }], 2026)
    expect(v.verdict).toBe('FRESH')
  })

  it('returns STALE when evidence is 2–3 years old', () => {
    const v = verdictFromEvidence('Claim.', [{ year: '2023' }], 2026)
    expect(v.verdict).toBe('STALE')
  })

  it('returns CONTRADICTED when the claim asserts a year far ahead of evidence', () => {
    const v = verdictFromEvidence('It was all changed in 2026.', [{ year: '2023' }], 2026)
    expect(v.verdict).toBe('CONTRADICTED')
  })
})

describe('parseLlmVerdict', () => {
  it('parses a strict JSON verdict', () => {
    const v = parseLlmVerdict('{"verdict":"FRESH","confidence":80,"explanation":"ok","fresher":null}')
    expect(v.verdict).toBe('FRESH')
    expect(v.confidence).toBe(80)
    expect(v.evaluator).toBe('llm')
  })

  it('survives markdown fences and surrounding prose', () => {
    const raw = 'Here is my answer:\n```json\n{"verdict":"STALE","confidence":55,"explanation":"aged","fresher":"Windows 11 (2024)"}\n```'
    const v = parseLlmVerdict(raw)
    expect(v.verdict).toBe('STALE')
    expect(v.fresher).toBe('Windows 11 (2024)')
  })

  it('rejects unknown verdict labels', () => {
    expect(() => parseLlmVerdict('{"verdict":"MAYBE","confidence":50}')).toThrow(/bad verdict/)
  })

  it('clamps confidence into 0–100', () => {
    expect(parseLlmVerdict('{"verdict":"FRESH","confidence":120}').confidence).toBe(100)
    expect(parseLlmVerdict('{"verdict":"FRESH","confidence":-5}').confidence).toBe(0)
  })

  it('treats literal null-ish fresher values as null', () => {
    expect(parseLlmVerdict('{"verdict":"FRESH","confidence":70,"fresher":"null"}').fresher).toBeNull()
    expect(parseLlmVerdict('{"verdict":"FRESH","confidence":70,"fresher":""}').fresher).toBeNull()
  })

  it('throws when no JSON object is present', () => {
    expect(() => parseLlmVerdict('no json here')).toThrow(/no JSON/)
  })
})

describe('buildLlmMessages (speculation guard)', () => {
  const messages = buildLlmMessages('Windows 12 is out.', [{ title: 'Rumor', year: '2025', snippet: 'I think Windows 12 is coming' }], 2026)

  it('carries the speculation guard in the system prompt', () => {
    const system = messages[0].content
    expect(system).toMatch(/SPECULATION GUARD/i)
    expect(system).toMatch(/NOT confirmation/i)
    expect(system).toMatch(/official vendor source/i)
  })

  it('includes the claim and numbered evidence in the user message', () => {
    expect(messages[1].content).toContain('Windows 12 is out.')
    expect(messages[1].content).toContain('[1]')
  })
})

describe('verdictLabel — the wine scale', () => {
  it('maps index bands to cellar labels', () => {
    expect(verdictLabel(100)).toBe('Fit to Bottle')
    expect(verdictLabel(80)).toBe('Fit to Bottle')
    expect(verdictLabel(55)).toBe('Cellar With Care')
    expect(verdictLabel(31)).toBe('Pour It Out')
    expect(verdictLabel(0)).toBe('Unfit to Bottle')
  })
})
