/**
 * VERITAS — bridge to live mode.
 * If server/server.mjs is running next to the frontend with a Tavily key,
 * /api/health answers { mode: 'live' } and the audit goes to the live web.
 * The key never leaves the server: the frontend only knows that it exists.
 */

import { auditText } from './demoEngine.js'

export async function checkMode() {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(1500) })
    if (!res.ok) throw new Error('bad status')
    const data = await res.json()
    return data.mode === 'live' ? 'live' : 'demo'
  } catch {
    return 'demo'
  }
}

export async function runAudit(text, onStep) {
  const steps = [
    'Unrolling the manuscript',
    'Extracting the claims',
    'Cross-checking the web evidence',
    'Rendering the verdicts',
    'Binding the report',
  ]

  // Progress is purely the atelier's visual ritual; the real work happens below.
  let step = 0
  const tick = setInterval(() => {
    if (step < steps.length - 1) {
      step += 1
      onStep?.(step, steps[step])
    }
  }, 620)

  try {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(30000),
    })
    clearInterval(tick)
    if (!res.ok) throw new Error('api unavailable')
    const report = await res.json()
    return report
  } catch {
    // No live server — work honestly on the synthetic archive.
    clearInterval(tick)
    return auditText(text)
  } finally {
    clearInterval(tick)
    onStep?.(5, null) // 5 = all steps finished
  }
}
