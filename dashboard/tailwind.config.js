/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        base: '#0a0f1e',
        surface: '#111827',
        card: '#1a2236',
        border: '#1f2d45',
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
        success: '#10b981',
        danger: '#ef4444',
        warn: '#f59e0b',
        muted: '#6b7280',
        subtle: '#374151'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
