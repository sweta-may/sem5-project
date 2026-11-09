/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fsm: {
          normal: '#10b981',     // Emerald 500
          high: '#f59e0b',       // Amber 500
          suspicious: '#f97316', // Orange 500
          blocked: '#ef4444'     // Rose 500
        }
      }
    },
  },
  plugins: [],
};
