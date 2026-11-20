import { describe, it, expect } from 'vitest'
import { reportToMarkdown, exportStamp } from '../src/lib/exporters.js'

const REPORT = {
  mode: 'live',
  gateway: 'bifrost',
  examinedAt: '2026-11-17T10:00:00.000Z',
  elapsedSec: 3.2,
  aiAssessed: 1,
  index: 55,
  verdictLabel: 'Cellar With Care',
  summary: 'The live audit finds the batch serviceable.',
  claims: [
    {
      claim: 'The latest Windows version is Windows 12, released in 2025.',
      type: 'VERSION',
      verdict: 'CONTRADICTED',
      confidence: 90,
      explanation: 'Vendor sources show Windows 11 is the latest release.',
      fresher: 'Windows 11 24H2 is the latest release (Microsoft, 2025).',
      evidence: [
        { title: 'Windows 11 release notes', year: '2025', url: 'https://learn.microsoft.com/windows' },
        { title: 'Synthetic archive record', year: 'n.d.', url: null },
      ],
    },
  ],
}

describe('reportToMarkdown', () => {
  const md = reportToMarkdown(REPORT)

  it('renders the header metadata', () => {
    expect(md).toContain('# VERITAS — Freshness Report')
    expect(md).toContain('**Mode:** Live Web (bifrost)')
    expect(md).toContain('55/100 — *Cellar With Care*')
    expect(md).toContain('**AI assessed:** 1/1 claims')
  })

  it('renders claims with verdict, confidence and fresher data', () => {
    expect(md).toContain('## 1. CONTRADICTED — confidence 90% (VERSION)')
    expect(md).toContain('**Fresher data:** Windows 11 24H2')
  })

  it('renders evidence as links when a URL exists', () => {
    expect(md).toContain('[Windows 11 release notes](https://learn.microsoft.com/windows)')
  })

  it('marks evidence without a URL as an archived record', () => {
    expect(md).toContain('*(archived record — link unavailable)*')
  })

  it('handles an empty report without crashing', () => {
    expect(reportToMarkdown({})).toContain('# VERITAS — Freshness Report')
  })
})

describe('exportStamp', () => {
  it('builds a sortable filename stamp', () => {
    expect(exportStamp('2026-11-17T10:05:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/)
  })

  it('falls back gracefully on garbage input', () => {
    expect(exportStamp('not a date')).toBe('report')
  })
})
