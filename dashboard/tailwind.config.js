/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        base:     '#07101f',
        surface:  '#0b1525',
        card:     '#0f1c2e',
        elevated: '#132030',
        border:   '#182840',
        subtle:   '#1f3350',
        accent:   '#4f8ef7',
        'accent-hover': '#3a7af5',
        'accent-dim':   '#142d5e',
        success:  '#22c55e',
        danger:   '#f43f5e',
        warn:     '#f59e0b',
        muted:    '#4a5a70',
        dim:      '#253547',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 4px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05)',
        glow:  '0 0 28px rgba(79,142,247,.2)',
        modal: '0 32px 80px rgba(0,0,0,.7)',
      },
      animation: {
        'fade-in':  'fadeIn .18s ease-out',
        'slide-in': 'slideIn .22s ease-out',
        skeleton:   'skeleton 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:  { from: { opacity: 0, transform: 'translateX(16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        skeleton: { '0%,100%': { opacity: .3 }, '50%': { opacity: .65 } },
      },
    }
  },
  plugins: []
};
