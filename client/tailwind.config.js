/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg: {
          base: "#0e0e10",
          panel: "#141416",
          surface: "#1a1a1d",
          hover: "#222226",
          active: "#2a2a2f",
        },
        border: {
          subtle: "#2a2a2f",
          DEFAULT: "#333338",
        },
        text: {
          primary: "#f0f0f2",
          secondary: "#9898a6",
          muted: "#5a5a6a",
        },
        accent: {
          DEFAULT: "#7c6af7",
          hover: "#9080ff",
          dim: "#7c6af720",
        },
      },
    },
  },
  plugins: [],
};
