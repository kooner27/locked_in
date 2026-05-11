// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // ← add this line
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
