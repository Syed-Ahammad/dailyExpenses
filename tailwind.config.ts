import type { Config } from "tailwindcss";

// Design tokens from docs/design-system.md, mapped to Tailwind utilities.
// Colors point at CSS custom properties (defined in src/app/globals.css) so the
// planned dark theme is a token swap only — never hard-code hex in components.
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        card: "var(--card)",
        sand: "var(--sand)",
        green: { DEFAULT: "var(--green)", soft: "var(--green-soft)" },
        gold: "var(--gold)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        "amber-bg": "var(--amber-bg)",
        "amber-ink": "var(--amber-ink)",
        "red-bg": "var(--red-bg)",
        "red-ink": "var(--red-ink)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "9px",
        md: "12px",
        lg: "18px",
        pill: "999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(20,32,28,0.04)",
        md: "0 4px 16px rgba(20,32,28,0.06)",
        lg: "0 12px 32px rgba(20,32,28,0.10)",
      },
      letterSpacing: {
        label: "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
