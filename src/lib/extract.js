/**
 * VERITAS — extraction of checkable claims from text.
 * A dependency-free module: used by both the frontend (demo mode)
 * and the live-mode server (server/server.mjs).
 */

const SUPERLATIVES =
  /\b(largest|biggest|smallest|most|leading|first|last|current|latest|newest|oldest|remains|still|only|fastest|longest|shortest|richest|top)\b/i
const RANK_WORDS = /\b(largest|biggest|leading|first|top|number one|no\.?\s?1|dominant|most popular)\b/i
const NUM_WORDS = /\b(billion|million|thousand|percent|%)|\b\d[\d.,]*\s*(billion|million|thousand|%)/i
const YEAR_RE = /\b(19|20)\d{2}\b/
const VERSION_RE = /\b(version|v\d+|windows\s+\d+|ios\s+\d+|android\s+\d+|release[d]?\s+in|launched\s+in|model\s+[a-z0-9-]+)\b/i

// Track-native claim classes (jury fix W9): the track text names "pricing,
// API versions, regulations, or company information" — so the classifier
// carries explicit categories for each of them.
const PRICING_RE =
  /[$€£₽]|\b(price|pricing|priced|cost|costs|fee|fees|per 1k|per 1,000|per million|subscription|tariff|free tier)\b/i
const REGULATION_RE =
  /\b(gdpr|ccpa|hipaa|ai act|regulation[s]?|regulatory|regulator|law|laws|act\b|directive|legislation|compliance|compliant|sanction[s]?|banned?|lawsuit|court|tribunal|statute|mandate)\b/i
const COMPANY_RE =
  /\b(ceo|cto|cfo|coo|funding|raised?|investment|investor[s]?|valuation|market cap|acquisition|acquired|merger|merged|ipo|headquarters|founded|founder|co-founder|bankrupt\w*|layoffs|subsidiary)\b/i

/**
 * Words that legitimately begin with a lowercase letter but still start a
 * new sentence (jury fix V6 — "…PCs worldwide. macOS Sonoma was released…"
 * used to glue two facts into one claim and earn them a single verdict).
 */
const LOWERCASE_STARTS =
  /^(macos|mac os|iphone|ipad|ios|ipados|watchos|tvos|visionos|ebay|imessage|homepod|airpods?|icloud|siri|x\.?|nvidia|openai|deepseek|tavily|bifrost)\b/i

/**
 * Splits text into sentences (up to ~320 characters long).
 * A segment that starts with a lowercase word outside the whitelist is glued
 * back to the previous sentence instead of spawning a bogus claim.
 */
export function splitSentences(text) {
  const raw = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
  const merged = []
  for (const part of raw) {
    const prev = merged[merged.length - 1]
    const startsProperly = /^[A-Z«"'(]/.test(part) || LOWERCASE_STARTS.test(part)
    if (prev && !startsProperly) {
      merged[merged.length - 1] = `${prev} ${part}`
    } else {
      merged.push(part)
    }
  }
  return merged.filter((s) => s.trim().length >= 16 && s.trim().length <= 320)
}

/** Classifies the claim type for the card badge. */
export function classifyType(sentence) {
  if (RANK_WORDS.test(sentence)) return 'RANKING'
  // Company facts before pricing: "raised $6.6B" is company info, not a price.
  if (COMPANY_RE.test(sentence)) return 'COMPANY'
  if (PRICING_RE.test(sentence)) return 'PRICING'
  if (REGULATION_RE.test(sentence)) return 'REGULATION'
  if (VERSION_RE.test(sentence)) return 'VERSION'
  if (NUM_WORDS.test(sentence)) return 'STATISTIC'
  if (YEAR_RE.test(sentence)) return 'DATE'
  return 'STATUS'
}

/**
 * Picks up to `limit` claims: the more digits, dates and "rank" words
 * a sentence has, the higher its priority. Original order is preserved.
 */
export function extractClaims(text, limit = 5) {
  const scored = splitSentences(text).map((sentence, i) => {
    let score = 0
    if (/\d/.test(sentence)) score += 2
    if (YEAR_RE.test(sentence)) score += 2
    if (SUPERLATIVES.test(sentence)) score += 3
    if (NUM_WORDS.test(sentence)) score += 2
    if (/\b(still|remains|currently|today|as of)\b/i.test(sentence)) score += 2
    if (PRICING_RE.test(sentence) || REGULATION_RE.test(sentence) || COMPANY_RE.test(sentence)) score += 1
    return { sentence: sentence.trim(), index: i, score }
  })
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((c) => ({ claim: c.sentence, type: classifyType(c.sentence) }))
}
