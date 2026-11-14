import React from 'react'

const fmtDay = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function indexColor(index) {
  if (index >= 55) return '#a3b18a'
  if (index >= 30) return '#c9b26b'
  return '#c47a5a'
}

export default function Archive({ items }) {
  return (
    <section id="archive" className="max-w-6xl mx-auto px-4 md:px-6 py-12 scroll-mt-20">
      <div className="panel p-6 md:p-10">
        <p className="eyebrow">The atelier archive</p>
        <h2 className="font-display text-4xl md:text-5xl text-cream mt-3">Recent batches</h2>

        <div className="rule my-7" />

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No batches yet — the ledger is waiting for its first audit.
          </p>
        ) : (
          <ul>
            {items.map((item, i) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-4 md:gap-6 py-5 border-b border-border last:border-b-0"
              >
                <span className="text-sm text-muted-foreground tabular-nums w-7">
                  {String(items.length - i).padStart(2, '0')}
                </span>
                <span className="flex-1 min-w-[200px] text-sm text-cream truncate pr-4">
                  {item.excerpt}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtDay.format(new Date(item.at))}, {fmtTime.format(new Date(item.at))}
                </span>
                <span className="px-2.5 py-1 border border-border text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                  {item.mode === 'live' ? 'Live' : 'Demo'}
                </span>
                <span
                  className="font-display text-2xl w-10 text-right"
                  style={{ color: indexColor(item.index) }}
                >
                  {item.index}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
