/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f7fb',
          100: '#e8edf6',
          200: '#cdd8ea',
          300: '#aabbd8',
          400: '#809bc0',
          500: '#5878a4',
          600: '#425d82',
          700: '#334968',
          800: '#24354b',
          900: '#122033',
        },
        accent: {
          50: '#f0fdf9',
          100: '#ccfbec',
          200: '#99f5d6',
          300: '#5eeab8',
          400: '#22c995',
          500: '#0ea47a',
          600: '#0a805f',
          700: '#095146',
          800: '#083f39',
          900: '#062c2b',
        },
      },
      boxShadow: {
        soft: '0 18px 60px rgba(16, 34, 51, 0.08)',
      },
      backgroundImage: {
        'hero-grid': 'radial-gradient(circle at top, rgba(91,120,164,0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3f8 100%)',
      },
    },
  },
  plugins: [],
};
