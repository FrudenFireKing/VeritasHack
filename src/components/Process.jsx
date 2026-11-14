import React from 'react'

const RITUALS = [
  {
    numeral: 'I',
    name: 'Extraction',
    text: 'A language model reads the AI answer the way an archivist reads a manuscript: it selects up to 5 verifiable facts — dates, figures, versions, and statuses like "largest" or "current".',
  },
  {
    numeral: 'II',
    name: 'Evidence',
    text: 'For every fact, the Tavily couriers bring fresh sources from the open web with publication dates. In demo mode, the synthetic VERITAS archive stands in for them.',
  },
  {
    numeral: 'III',
    name: 'Verdict',
    text: 'The auditor reconciles every claim with the evidence: fresh, stale, contradicted or unconfirmed. The result — a freshness index from 0 to 100 and a stamp with the date of examination.',
  },
]

export default function Process() {
  return (
    <section id="how" className="max-w-6xl mx-auto px-4 md:px-6 py-12 scroll-mt-20">
      <p className="eyebrow">Process</p>
      <h2 className="font-display text-4xl md:text-5xl text-cream mt-3">
        Three rituals of the atelier
      </h2>
      <div className="grid md:grid-cols-3 gap-5 mt-10">
        {RITUALS.map((r) => (
          <div key={r.numeral} className="panel p-6 md:p-7">
            <p className="font-display italic text-3xl text-gold">{r.numeral}</p>
            <h3 className="font-display text-2xl text-cream mt-4">{r.name}</h3>
            <p className="mt-3 text-sm text-cream-dim leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground leading-relaxed max-w-2xl">
        Hackathon track: Tavily problem statement &ldquo;Stale-Answer Detector&rdquo;. A
        TAVILY_API_KEY enables live search; without a key the atelier runs on its synthetic demo
        archive and honestly labels every piece of evidence.
      </p>
    </section>
  )
}
