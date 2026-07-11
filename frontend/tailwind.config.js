/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: '#7c3aed',
          violetDark: '#5b21b6',
          violetLight: '#a78bfa',
          black: '#0a0a0f',
          surface: '#131320',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
      },
    },
  },
  plugins: [],
};
