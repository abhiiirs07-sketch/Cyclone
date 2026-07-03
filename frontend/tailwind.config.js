/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        storm: {
          50: '#f0f4ff',
          100: '#e1e9ff',
          200: '#c7daff',
          300: '#9ebfff',
          400: '#6b98ff',
          500: '#3866f2',
          600: '#2247d4',
          700: '#1b35a7',
          800: '#1c2e87',
          900: '#1c2b6c',
          950: '#070a1e',
        },
        cyber: {
          dark: '#030712',
          panel: 'rgba(17, 24, 39, 0.8)',
          glow: 'rgba(59, 130, 246, 0.15)'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue': '0 0 15px rgba(59, 130, 246, 0.5)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.5)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.5)',
      }
    },
  },
  plugins: [],
}
