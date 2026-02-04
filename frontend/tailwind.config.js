/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#d6e0fd',
          300: '#b3c7fb',
          400: '#8aa5f8',
          500: '#667eea',
          600: '#5465d8',
          700: '#4350b8',
          800: '#364093',
          900: '#2d3574',
        },
        secondary: {
          500: '#764ba2',
          600: '#663d8f',
          700: '#56307c',
        }
      },
    },
  },
  plugins: [],
}
