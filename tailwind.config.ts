import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "aa-orange":    "#DB9628",
        "aa-blackblue": "#1F2933",
        "aa-gray":      "#33363D",
        "aa-offwhite":  "#F8F6F2",
        primary:        "#DB9628",
        surface:        "#F8F6F2",
      },
      fontFamily: {
        sans:    ["var(--font-ibm-plex-sans)", "Arial", "sans-serif"],
        serif:   ["var(--font-fraunces)", "Georgia", "serif"],
        mono:    ["var(--font-ibm-plex-mono)", "monospace"],
        heading: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      fontSize: {
        display: ["2.5rem",  { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        h1:      ["2rem",    { lineHeight: "1.2",  letterSpacing: "-0.015em" }],
        h2:      ["1.5rem",  { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        h3:      ["1.25rem", { lineHeight: "1.3"  }],
      },
    },
  },
  plugins: [],
};
export default config;
