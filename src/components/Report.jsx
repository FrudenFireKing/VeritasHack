import React from 'react'
import { VERDICT_META } from '../lib/demoEngine.js'
import { reportToMarkdown, downloadText, exportStamp } from '../lib/exporters.js'

const fmtFull = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Circular gauge of the 0–100 freshness index. */
function Gauge({ value }) {
  const r = 64
  const c = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, value)) / 100) * c
  return (
    <svg viewBox="0 0 160 160" className="w-44 h-44" role="img" aria-label={`Freshness index ${value} of 100`}>
      <circle cx="80" cy="80" r={r} fill="none" stroke="var(--olive-line)" strokeWidth="1.5" />
      <circle
        cx="80"
        cy="80"
        r={r}
        fill="none"
        stroke={value >= 55 ? 'var(--sage)' : value >= 30 ? 'var(--gold)' : 'var(--terra)'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(126 80 80)"
      />
      <text
        x="80"
        y="86"
        textAnchor="middle"
        fill="var(--foreground)"
        fontSize="42"
        fontFamily="'Cormorant Garamond', serif"
      >
        {value}
      </text>
      <text
        x="80"
        y="106"
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize="9"
        letterSpacing="3"
        fontFamily="Manrope, sans-serif"
      >
        OF 100
      </text>
    </svg>
  )
}

function Chip({ children, color }) {
  const style = color
    ? { borderColor: `${color}66`, color, backgroundColor: `${color}14` }
    : undefined
  return (
    <span
      style={style}
      className={`px-2.5 py-1 border text-[10.5px] tracking-[0.14em] uppercase ${
        color ? '' : 'border-border text-muted-foreground'
      }`}
    >
      {children}
    </span>
  )
}

function ClaimCard({ claim, isLive }) {
  const meta = VERDICT_META[claim.verdict] || VERDICT_META.UNCONFIRMED
  return (
    <article className="panel bg-olive-surface-2 p-5 md:p-6 animate-rise-in">
      <div className="flex flex-wrap items-center gap-2.5">
        <Chip color={meta.color}>{meta.label}</Chip>
        <Chip>{claim.type}</Chip>
        <span className="text-[10.5px] tracking-[0.14em] uppercase text-muted-foreground">
          Confidence {claim.confidence}%
        </span>
        <Chip color={isLive ? '#a3b18a' : '#c9b26b'}>
          {isLive ? 'Live Evidence' : 'Demo Evidence'}
        </Chip>
        {claim.evaluator === 'llm' && <Chip color="#c9b26b">AI Assessed</Chip>}
      </div>
      <h4 className="font-display text-xl md:text-2xl text-cream mt-4 leading-snug">
        &ldquo;{claim.claim}&rdquo;
      </h4>
      <p className="mt-2.5 text-sm text-cream-dim leading-relaxed">{claim.explanation}</p>
      {claim.fresher && (
        <div className="mt-4 border-l-2 border-gold pl-4 py-1">
          <p className="eyebrow text-gold" style={{ color: 'var(--gold)' }}>
            Fresher data
          </p>
          <p className="mt-1.5 text-sm text-cream leading-relaxed">{claim.fresher}</p>
        </div>
      )}
      <div className="mt-5 border-t border-border pt-4">
        <p className="eyebrow">Evidence from the web</p>
        <ul className="mt-3 space-y-2">
          {(claim.evidence || []).map((e, i) => (
            <li key={i} className="flex items-baseline gap-3 text-sm">
              <span className="text-muted-foreground text-xs tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              {e.url ? (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cream underline decoration-olive-line-strong underline-offset-4 hover:text-sage transition-colors"
                >
                  {e.title}
                </a>
              ) : (
                <span className="text-cream italic">{e.title}</span>
              )}
              <span className="text-muted-foreground">— {e.year}</span>
              {!e.url && (
                <span className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground">
                  archived record · link unavailable
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export default function Report({ report }) {
  return (
    <section className="panel p-6 md:p-10" aria-label="Freshness audit report">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Freshness report · Veritas</p>
          <h3 className="font-display text-3xl md:text-4xl text-cream mt-2.5">
            Batch examined {fmtFull.format(new Date(report.examinedAt))}
          </h3>
        </div>
        <div className="flex items-center gap-2.5">
          <Chip color={report.mode === 'live' ? '#a3b18a' : '#c9b26b'}>
            {report.mode === 'live' ? 'Live Web' : 'Demo Archive'}
          </Chip>
          {report.aiAssessed > 0 && (
            <Chip color="#c9b26b">
              AI Assessed {report.aiAssessed}/{report.claims.length}
            </Chip>
          )}
          <span className="px-2.5 py-1 border border-border text-[10.5px] tracking-[0.14em] uppercase text-muted-foreground tabular-nums">
            {report.elapsedSec} s
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="eyebrow text-muted-foreground">Export:</span>
        <button
          onClick={() => downloadText(`veritas-report_${exportStamp(report.examinedAt)}.md`, reportToMarkdown(report), 'text/markdown')}
          className="px-3 py-1.5 border border-border text-[11px] tracking-[0.12em] uppercase text-cream-dim hover:text-cream hover:border-olive-line-strong transition-colors"
        >
          Markdown
        </button>
        <button
          onClick={() => downloadText(`veritas-report_${exportStamp(report.examinedAt)}.json`, JSON.stringify(report, null, 2), 'application/json')}
          className="px-3 py-1.5 border border-border text-[11px] tracking-[0.12em] uppercase text-cream-dim hover:text-cream hover:border-olive-line-strong transition-colors"
        >
          JSON
        </button>
      </div>

      <div className="rule my-8" />

      <div className="grid md:grid-cols-[0.36fr_0.64fr] gap-8">
        <div className="flex flex-col items-center text-center md:pt-2">
          <Gauge value={report.index} />
          <p
            className="font-display italic text-2xl mt-4"
            style={{ color: report.index >= 55 ? '#a3b18a' : report.index >= 30 ? '#c9b26b' : '#c9b26b' }}
          >
            {report.verdictLabel}
          </p>
          <p className="mt-3 text-sm text-cream-dim leading-relaxed max-w-xs">{report.summary}</p>
        </div>
        <div className="space-y-5">
          {report.claims.map((c, i) => (
            <ClaimCard key={i} claim={c} isLive={report.mode === 'live'} />
          ))}
        </div>
      </div>
    </section>
  )
}
