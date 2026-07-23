/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        primary: {
          DEFAULT: 'var(--primary)',
          alpha: 'var(--primary-alpha)',
        },
        secondary: 'var(--secondary)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        error: 'var(--error)',
        warning: 'var(--warning)',
        success: 'var(--success)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Syne"', '"Cabinet Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-out-left': 'slideOutLeft 0.3s ease-in forwards',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'scan-line': 'scanLine 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutLeft: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        scanLine: {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
      }
    },
  },
  plugins: [],
}
