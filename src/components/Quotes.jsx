import React, { useEffect, useState } from 'react'

const QUOTES = [
  {
    author: 'F. M. Dostoevsky',
    source: 'letter to his brother Mikhail, 1839',
    text: 'Man is a mystery. It needs to be unraveled, and if you spend your whole life unraveling it, don\u2019t say that you\u2019ve wasted time.',
  },
  {
    author: 'Nikola Tesla',
    source: 'My Inventions, 1919',
    text: 'The present is theirs; the future, for which I really worked, is mine.',
  },
  {
    author: 'Jorge Luis Borges',
    source: 'Poema de los dones, 1960',
    text: 'I have always imagined that Paradise will be a kind of library.',
  },
  {
    author: 'Mark Twain',
    source: 'Notebooks, 1935',
    text: 'Truth is the most valuable thing we have. Let us economize it.',
  },
  {
    author: 'Socrates',
    source: 'attributed via Diogenes Laertius',
    text: 'I know one thing: that I know nothing.',
  },
  {
    author: 'Francis Bacon',
    source: 'Meditationes Sacrae, 1597',
    text: 'Knowledge itself is power.',
  },
]

/** "From the inspiration archive" quote carousel — auto-rotates every 7 seconds. */
export default function Quotes() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % QUOTES.length), 7000)
    return () => clearInterval(id)
  }, [])

  const q = QUOTES[active]

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-10 border-t border-border">
      <div className="grid md:grid-cols-[0.32fr_0.68fr] gap-8 pt-6">
        <div>
          <p className="eyebrow leading-relaxed">
            from the
            <br />
            inspiration archive
          </p>
        </div>
        <div>
          <blockquote key={active} className="animate-quote-fade">
            <p className="font-display italic text-2xl md:text-[1.7rem] leading-snug text-cream">
              &ldquo;{q.text}&rdquo;
            </p>
            <footer className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="w-8 h-px bg-olive-line-strong" aria-hidden="true" />
              <span className="text-cream-dim">{q.author}</span>
              <span>· {q.source}</span>
            </footer>
          </blockquote>
          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Inspiration quotes">
            {QUOTES.map((item, i) => (
              <button
                key={item.author}
                role="tab"
                aria-selected={i === active}
                aria-label={`Quote ${i + 1}: ${item.author}`}
                onClick={() => setActive(i)}
                className={`w-9 h-9 rounded-full border text-xs transition-colors ${
                  i === active
                    ? 'border-gold text-gold bg-secondary'
                    : 'border-border text-muted-foreground hover:text-cream hover:border-olive-line-strong'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
