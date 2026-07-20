import type { Config } from 'tailwindcss';

// Arya design direction: trustworthy medical infrastructure.
// Deep teal + warm off-white, one accent, depth via layered shadows not borders.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#f0fbfa',
          100: '#d5f2ef',
          200: '#aee5e0',
          300: '#78d0ca',
          400: '#43b3ac',
          500: '#279791',
          600: '#1c7a76',
          700: '#1a615f',
          800: '#194e4d',
          900: '#0f2f2e',
        },
        cream: {
          50: '#fdfcf9',
          100: '#faf7f0',
          200: '#f2ece0',
        },
        signal: {
          amber: '#d97706',
          red: '#dc2626',
          green: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,47,46,0.04), 0 8px 24px rgba(15,47,46,0.06)',
        lift: '0 2px 4px rgba(15,47,46,0.06), 0 16px 40px rgba(15,47,46,0.10)',
      },
      transitionTimingFunction: {
        arya: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
