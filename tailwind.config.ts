import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'IBM Plex Sans', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      colors: {
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: 'var(--accent)',
        p0: { DEFAULT: 'var(--p0)', bg: 'var(--p0-bg)', border: 'var(--p0-border)' },
        p1: { DEFAULT: 'var(--p1)', bg: 'var(--p1-bg)', border: 'var(--p1-border)' },
        p2: { DEFAULT: 'var(--p2)', bg: 'var(--p2-bg)', border: 'var(--p2-border)' },
        p3: { DEFAULT: 'var(--p3)', bg: 'var(--p3-bg)', border: 'var(--p3-border)' },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}

export default config
