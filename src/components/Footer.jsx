import React from 'react'

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="flex items-center gap-3">
          <span className="font-display text-xl tracking-[0.18em] text-cream">VERITAS</span>
          <span className="w-px h-4 bg-primary/30" aria-hidden="true" />
          <span className="eyebrow">est. 2026</span>
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Built overnight at the AI Inator hackathon · Tavily track: Stale-Answer Detector
        </p>
        <p className="text-xs text-muted-foreground">© 2026 Veritas Atelier</p>
      </div>
    </footer>
  )
}
