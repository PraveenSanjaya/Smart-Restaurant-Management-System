/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          500: '#c9971f',
          600: '#b8860b',
        },
      },
    },
  },
  plugins: [],
}
