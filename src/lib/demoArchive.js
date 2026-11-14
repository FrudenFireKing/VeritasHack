/**
 * VERITAS — synthetic archive for demo mode.
 * Each rule: keywords for matching, fresher data,
 * a verdict and evidence with publication dates (like a live search result).
 *
 * To add your own topic, append an object to the RULES array following the pattern.
 */

export const RULES = [
  // ─── Social networks ───────────────────────────────────────────────
  {
    match: /\b(facebook)\b/i,
    test: /\b2\.8\s*billion\b/i,
    verdict: 'STALE',
    confidence: 92,
    explanation:
      'The figure of 2.8 billion refers to older reporting; official disclosures show a higher and still-growing audience.',
    fresher: 'As of Q1 2023, Facebook had 2.96 billion monthly active users according to official reports.',
    evidence: [
      { title: 'Global Social Media Statistics Report 2023', year: '2023' },
      { title: 'Facebook Company Overview', year: '2023-03' },
      { title: 'Meta Q1 2023 Earnings Release', year: '2023-04' },
    ],
  },
  {
    match: /\b(largest|biggest|most popular)\b.*\b(social network|platform)\b/i,
    test: /\bfacebook\b/i,
    verdict: 'STALE',
    confidence: 70,
    explanation:
      'Facebook is no longer a safe default for "largest": newer reporting moves the ranking and the metric definition (MAU vs DAU) matters.',
    fresher: 'Facebook remains the largest by monthly users (2.96B, 2023), but TikTok leads by downloads and time spent in several regions.',
    evidence: [
      { title: 'Global Social Media Statistics Report 2023', year: '2023' },
      { title: 'Most Popular Social Networks 2023', year: '2023' },
      { title: 'Platform Audience Rankings', year: '2022' },
    ],
  },
  {
    match: /\binstagram\b/i,
    test: /\b2\s*billion\b/i,
    verdict: 'FRESH',
    confidence: 88,
    explanation:
      'Instagram reported two billion monthly active users, consistent with the archived evidence.',
    fresher: null,
    evidence: [
      { title: 'Instagram Reaches 2 Billion Users', year: '2023' },
      { title: 'Meta Investor Update', year: '2023-02' },
    ],
  },
  {
    match: /\b(x|twitter)\b/i,
    test: /\b(leading|top|main|number one)\b.*\b(news|platform)\b/i,
    verdict: 'UNCONFIRMED',
    confidence: 45,
    explanation:
      'The archived evidence is mixed: engagement depends on region and metric, and ownership changes make long-term claims fragile.',
    fresher: null,
    evidence: [
      { title: 'News Consumption Survey', year: '2023' },
      { title: 'Platform Traffic Benchmarks', year: '2022' },
    ],
  },

  // ─── Operating systems ─────────────────────────────────────────────
  {
    match: /\bwindows\b/i,
    test: /\bwindows\s*12\b/i,
    verdict: 'CONTRADICTED',
    confidence: 90,
    explanation:
      'No such release exists in the vendor archive: the claim about "Windows 12, released in 2025" is contradicted by sources.',
    fresher: 'As of late 2025, the latest Windows release is Windows 11 (24H2); Microsoft has not shipped a "Windows 12".',
    evidence: [
      { title: 'Microsoft Windows Release History', year: '2025' },
      { title: 'Windows 11 24H2 Announcement', year: '2024-10' },
      { title: 'Microsoft Product Lifecycle', year: '2025' },
    ],
  },
  {
    match: /\bwindows\s*11\b/i,
    test: /\b(2021|succeeded)\b/i,
    verdict: 'FRESH',
    confidence: 86,
    explanation:
      'Windows 11 did succeed Windows 10 in 2021 — the claim matches the vendor archive.',
    fresher: null,
    evidence: [
      { title: 'Windows 11 Launch Notes', year: '2021-10' },
      { title: 'Windows Lifecycle Fact Sheet', year: '2023' },
    ],
  },
  {
    match: /\bwindows\s*7\b/i,
    test: /\b(more than half|half of|majority|most)\b/i,
    verdict: 'CONTRADICTED',
    confidence: 84,
    explanation:
      'Windows 7 is long past its support horizon; current usage-share surveys put it in low single digits.',
    fresher: 'Steam Hardware Survey (2025) shows Windows 10/11 dominate; Windows 7 accounts for under 2% of systems.',
    evidence: [
      { title: 'Steam Hardware & Software Survey', year: '2025' },
      { title: 'Desktop OS Market Share', year: '2023' },
    ],
  },
  {
    match: /\b(macos|mac os)\b/i,
    test: /\b(sonoma)\b/i,
    verdict: 'FRESH',
    confidence: 82,
    explanation:
      'macOS Sonoma was indeed released in September 2023 — consistent with the vendor archive.',
    fresher: null,
    evidence: [
      { title: 'macOS Sonoma Release Notes', year: '2023-09' },
      { title: 'Apple Newsroom Archive', year: '2023' },
    ],
  },

  // ─── Aviation ──────────────────────────────────────────────────────
  {
    match: /\b(boeing\s*747|747)\b/i,
    test: /\b(largest|biggest|larger than)\b/i,
    verdict: 'STALE',
    confidence: 70,
    explanation:
      'The claim is no longer accurate as of November 2026: newer aircraft models like the Airbus A380 have surpassed the Boeing 747 in passenger capacity.',
    fresher:
      'The Airbus A380 can carry up to 853 passengers in a high-density configuration, making it the largest passenger aircraft by capacity.',
    evidence: [
      { title: 'Boeing 747 - The Queen of the Skies', year: '2022' },
      { title: 'Aircraft Size Comparison', year: '2023' },
      { title: 'Boeing 777 Fleet Statistics', year: '2023' },
    ],
  },
  {
    match: /\b(a380|airbus)\b/i,
    test: /\b(853|2007|passengers)\b/i,
    verdict: 'FRESH',
    confidence: 84,
    explanation:
      'The A380 entered commercial service in 2007 and its certified maximum capacity is 853 passengers — matches the archive.',
    fresher: null,
    evidence: [
      { title: 'A380 Aircraft Characteristics', year: '2023' },
      { title: 'Airbus Commercial Archive', year: '2022' },
    ],
  },
  {
    match: /\bconcorde\b/i,
    test: /\b(still|currently|today|flies)\b/i,
    verdict: 'CONTRADICTED',
    confidence: 95,
    explanation:
      'Concorde was retired in 2003; no scheduled Concorde service exists today.',
    fresher: 'Concorde’s last commercial flight was in October 2003 (British Airways heritage fleet notes, 2019).',
    evidence: [
      { title: 'Concorde Retirement Announcement', year: '2003' },
      { title: 'British Airways Heritage Fleet', year: '2019' },
    ],
  },

  // ─── General rules ────────────────────────────────────────────────
  {
    match: /\b(current|today|now|as of)\b.*\b(year|date|time)\b/i,
    verdict: 'STALE',
    confidence: 40,
    explanation:
      'Time-sensitive phrasing without a fixed date: the archive shows such statements drift within months.',
    fresher: null,
    evidence: [
      { title: 'VERITAS Synthetic Archive: Temporal Drift Notes', year: '2024' },
    ],
  },
]

/** Default rule — when no keyword matched. */
export const FALLBACK_RULE = {
  verdict: 'UNCONFIRMED',
  confidence: 30,
  explanation:
    'The synthetic VERITAS archive has no direct match for this claim; in demo mode it is honestly marked unconfirmed.',
  fresher: null,
  evidence: [{ title: 'VERITAS Synthetic Archive: no direct match', year: '2024' }],
}

/** Returns the archive rule for a claim. */
export function matchRule(claim) {
  for (const rule of RULES) {
    if (rule.match.test(claim)) {
      // If the rule has an extra test, honor it (match refinement)
      if (rule.test && !rule.test.test(claim)) continue
      return rule
    }
  }
  return FALLBACK_RULE
}
