import React from 'react'
import Seal from './Seal.jsx'

const STATS = [
  { value: 'up to 5', label: 'claims per pass' },
  { value: '4 each', label: 'sources per claim' },
  { value: '0—100', label: 'freshness index' },
]

export default function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-10">
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
        <div className="animate-rise-in">
          <p className="eyebrow">Veritas · November 2026</p>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mt-6 text-cream">
            Truth has a
            <br />
            <em className="text-sage font-medium">shelf life</em>
            <span className="text-cream">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-cream-dim leading-relaxed">
            VERITAS is a freshness atelier for AI answers. We extract factual claims, cross-check
            them against the live web via Tavily, and stamp every batch: fresh, stale, or
            contradicted by sources. No &ldquo;take our word for it&rdquo; — only dated evidence.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#lab"
              className="inline-flex items-center bg-primary text-primary-foreground px-7 py-3.5 text-sm font-semibold tracking-wider uppercase hover:opacity-90 transition-opacity"
            >
              Enter the laboratory
            </a>
            <a
              href="#how"
              className="inline-flex items-center border border-olive-line-strong px-7 py-3.5 text-sm font-semibold tracking-wider uppercase text-cream hover:bg-secondary transition-colors"
            >
              How it works
            </a>
          </div>
          <dl className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-3xl text-cream">{s.value}</dd>
                <dd className="eyebrow mt-1.5">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="hidden lg:block animate-rise-in" style={{ animationDelay: '120ms' }}>
          <Seal />
        </div>
      </div>
    </section>
  )
}
