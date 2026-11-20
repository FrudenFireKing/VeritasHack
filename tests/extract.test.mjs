import { describe, it, expect } from 'vitest'
import { splitSentences, classifyType, extractClaims } from '../src/lib/extract.js'

describe('splitSentences', () => {
  it('keeps lowercase whitelisted starts as separate sentences (jury fix V6)', () => {
    const text =
      'Windows 7 still powers more than half of all PCs worldwide. macOS Sonoma was released in September 2023.'
    const parts = splitSentences(text)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/worldwide\.$/)
    expect(parts[1]).toMatch(/^macOS Sonoma/)
  })

  it('glues lowercase continuations back into the previous sentence', () => {
    const text = 'The audit examined the report. the results were inconclusive for several weeks afterward.'
    const parts = splitSentences(text)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toContain('the results were inconclusive')
  })

  it('handles iPhone / eBay style starts', () => {
    const text = 'Sales grew 10% last year. iPhone shipments also rose. eBay reported similar gains.'
    const parts = splitSentences(text)
    expect(parts).toHaveLength(3)
    expect(parts[1]).toMatch(/^iPhone/)
    expect(parts[2]).toMatch(/^eBay/)
  })

  it('filters out fragments shorter than 16 characters', () => {
    const parts = splitSentences('Wait. Yes! This is a perfectly checkable sentence about Windows versions.')
    expect(parts.every((s) => s.trim().length >= 16)).toBe(true)
  })

  it('drops oversized sentences above 320 characters', () => {
    const long = 'A'.repeat(400) + '.'
    expect(splitSentences(long)).toHaveLength(0)
  })
})

describe('classifyType', () => {
  it('detects PRICING claims (track class)', () => {
    expect(classifyType('GPT-4 Turbo costs $0.03 per 1K tokens through the API.')).toBe('PRICING')
  })

  it('detects REGULATION claims (track class)', () => {
    expect(classifyType('The GDPR requires companies to protect personal data of EU residents.')).toBe('REGULATION')
  })

  it('detects COMPANY claims (track class)', () => {
    expect(classifyType('OpenAI raised $6.6 billion in funding at a $157 billion valuation.')).toBe('COMPANY')
  })

  it('prefers COMPANY over PRICING for funding claims', () => {
    expect(classifyType('Microsoft acquired Activision Blizzard for $69 billion.')).toBe('COMPANY')
  })

  it('detects VERSION claims', () => {
    expect(classifyType('The latest major Windows version is Windows 12, released in 2025.')).toBe('VERSION')
  })

  it('falls back to STATISTIC for plain numbers', () => {
    expect(classifyType('Facebook has more than 2.8 billion monthly active users.')).toBe('STATISTIC')
  })

  it('falls back to STATUS when nothing specific matches', () => {
    expect(classifyType('The Concorde program was retired from service years ago.')).toBe('STATUS')
  })
})

describe('extractClaims', () => {
  it('splits the OS sample into three separate claims (regression: glued macOS)', () => {
    const text =
      'The latest major Windows version is Windows 12, released in 2025. Windows 7 still powers more than half of all PCs worldwide. macOS Sonoma was released in September 2023.'
    const claims = extractClaims(text, 5)
    expect(claims).toHaveLength(3)
    expect(claims[2].claim).toMatch(/^macOS Sonoma/)
    expect(claims[2].type).toBe('VERSION')
  })

  it('never returns more than the limit', () => {
    const text = Array.from({ length: 12 }, (_, i) => `Fact number ${i + 1} states that the count reached ${i + 10} million units.`).join(' ')
    expect(extractClaims(text, 5)).toHaveLength(5)
  })

  it('preserves original sentence order and picks fact-dense sentences first', () => {
    const text =
      'The first fact is that 40 million units were sold. Another sentence with no digits at all. The last fact says 20 million units remain.'
    const claims = extractClaims(text, 2)
    expect(claims).toHaveLength(2)
    expect(claims[0].claim).toMatch(/^The first fact/)
    expect(claims[1].claim).toMatch(/^The last fact/)
  })

  it('tags each claim with a type', () => {
    const claims = extractClaims('The Boeing 747 remains the largest passenger aircraft in the world.')
    expect(claims[0].type).toBe('RANKING')
  })
})
