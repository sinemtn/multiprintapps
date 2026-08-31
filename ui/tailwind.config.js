/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#020617',
          900: '#070b18',
          850: '#0b1020',
          800: '#111827',
          700: '#1f2937',
        },
        line: '#253044',
        muted: '#9fb2cf',
      },
      boxShadow: {
        panel: '0 24px 80px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
