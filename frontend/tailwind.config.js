/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        iron: {
          950: '#09090b',
          900: '#18181b',
          850: '#202023',
          800: '#27272a',
          700: '#3f3f46',
          accent: '#f59e0b',
          crimson: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};
