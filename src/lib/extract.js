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

/** Splits text into sentences (up to ~320 characters long). */
export function splitSentences(text) {
  const raw = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z«"'(])/)
  return raw.filter((s) => s.trim().length >= 16 && s.trim().length <= 320)
}

/** Classifies the claim type for the card badge. */
export function classifyType(sentence) {
  if (RANK_WORDS.test(sentence)) return 'RANKING'
  if (NUM_WORDS.test(sentence)) return 'STATISTIC'
  if (VERSION_RE.test(sentence)) return 'VERSION'
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
    return { sentence: sentence.trim(), index: i, score }
  })
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((c) => ({ claim: c.sentence, type: classifyType(c.sentence) }))
}
