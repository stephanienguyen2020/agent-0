import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        az: {
          green: "#b6f24a",
          "green-soft": "#cdf56a",
          "green-dim": "rgba(182,242,74,0.12)",
          bg: "#05100b",
          panel: "rgba(18,28,24,0.55)",
          "panel-solid": "#0e1a14",
          stroke: "rgba(255,255,255,0.06)",
          "stroke-2": "rgba(255,255,255,0.09)",
          text: "#e8f1ea",
          muted: "#6b7d72",
          "muted-2": "#8a9a90",
          red: "#ef4a7a",
          blue: "#5b9cf5",
          orange: "#f5a623",
          purple: "#a78bfa",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        az: "20px",
      },
      backgroundImage: {
        "az-page":
          "radial-gradient(ellipse 1100px 800px at 15% 25%, rgba(100,190,80,0.14), transparent 60%), radial-gradient(ellipse 900px 600px at 80% 80%, rgba(70,160,90,0.12), transparent 60%), #05100b",
        "az-card":
          "linear-gradient(180deg, rgba(20,32,26,0.7), rgba(12,20,16,0.55))",
        "az-glass":
          "linear-gradient(180deg, rgba(28,42,34,0.5), rgba(14,22,18,0.45))",
        "az-btn-green": "linear-gradient(180deg, #c9f56a, #a6e23f)",
      },
      boxShadow: {
        "az-card-inset": "inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 50px -20px rgba(0,0,0,0.5)",
        "az-btn-green": "0 8px 24px -8px rgba(180,240,90,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
