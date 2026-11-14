import React from 'react'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3 group">
          <span className="font-display text-2xl tracking-[0.18em]">VERITAS</span>
          <span className="hidden sm:block w-px h-5 bg-primary/30" aria-hidden="true" />
          <span className="hidden sm:block eyebrow">the freshness atelier</span>
        </a>
        <nav aria-label="Main navigation" className="flex items-center gap-5 md:gap-8 text-xs md:text-sm">
          <a href="#lab" className="text-muted-foreground hover:text-foreground transition-colors">
            Laboratory
          </a>
          <a href="#how" className="hidden sm:block text-muted-foreground hover:text-foreground transition-colors">
            Process
          </a>
          <a href="#archive" className="text-muted-foreground hover:text-foreground transition-colors">
            Archive
          </a>
        </nav>
      </div>
    </header>
  )
}
