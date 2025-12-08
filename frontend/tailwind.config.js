/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'booking-blue': '#003580',
        'booking-yellow': '#febb02',
        'booking-dark-blue': '#00224f',
        'booking-light-blue': '#0071c2',
      },
      fontFamily: {
        'arabic': ['Cairo', 'Tajawal', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

