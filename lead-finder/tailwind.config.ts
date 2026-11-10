import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#f1f4f9", 100: "#dfe6f1", 200: "#b9c7de", 400: "#5b78a8", 600: "#1f3a68", 700: "#172c52", 800: "#10213f", 900: "#0a1730" },
      },
    },
  },
  plugins: [],
};
export default config;
