/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        hairline: '#E2E8F0',
        accent: {
          DEFAULT: '#4F46E5',
          soft: '#EEF2FF',
          deep: '#4338CA',
        },
        assistant: { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
        client: { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
        none: { text: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
        review: { text: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        lift: '0 10px 30px -12px rgba(15, 23, 42, 0.18)',
        pop: '0 24px 60px -20px rgba(15, 23, 42, 0.28)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.8' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.24s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
