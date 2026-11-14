import React from 'react'

/**
 * The atelier's wax seal: the circular text rotates slowly,
 * with a serif "V" and EST. 2026 in the center.
 */
export default function Seal() {
  return (
    <div className="relative w-[280px] h-[280px] mx-auto" aria-hidden="true">
      <svg viewBox="0 0 280 280" className="w-full h-full animate-spin-slower">
        <defs>
          <path id="seal-circle" d="M 140,140 m -112,0 a 112,112 0 1,1 224,0 a 112,112 0 1,1 -224,0" />
        </defs>
        <circle cx="140" cy="140" r="134" fill="none" stroke="var(--olive-line-strong)" strokeWidth="1" />
        <circle cx="140" cy="140" r="90" fill="none" stroke="var(--olive-line)" strokeWidth="1" />
        <text
          fill="var(--sage)"
          fontSize="13.5"
          letterSpacing="7"
          fontFamily="Manrope, sans-serif"
          fontWeight="500"
        >
          <textPath href="#seal-circle">VERITAS · VERIFIED FRESH · AI INATOR PILOT · EST. 2026 ·</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-7xl text-cream leading-none">V</span>
        <span className="eyebrow mt-3">est. 2026</span>
      </div>
    </div>
  )
}
