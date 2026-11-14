/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // Atelier palette (raw tones from the layout)
        olive: {
          ink: '#12160d',
          surface: '#191f11',
          'surface-2': '#202816',
          line: '#a3b18a29',
          'line-strong': '#a3b18a52',
        },
        cream: '#efeddc',
        'cream-dim': '#b9b9a2',
        sage: '#a3b18a',
        gold: '#c9b26b',
        terra: '#c47a5a',
        rust: '#c4553f',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        seal: '0.32em',
      },
      animation: {
        'spin-slower': 'spin-slow 60s linear infinite',
        'quote-fade': 'quote-fade 0.8s ease both',
        'rise-in': 'rise-in 0.7s ease both',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
      keyframes: {
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'quote-fade': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
    },
  },
  plugins: [],
}
