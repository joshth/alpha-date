import type { Config } from "tailwindcss"
import { fontFamily } from "tailwindcss/defaultTheme"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-plex-sans)", ...fontFamily.sans],
        mono: ["var(--font-plex-mono)", ...fontFamily.mono],
      },
      colors: {
        lab: {
          chrome: "hsl(var(--lab-chrome))",
          surface: "hsl(var(--lab-surface))",
          raised: "hsl(var(--lab-surface-raised))",
          input: "hsl(var(--lab-input))",
          border: "hsl(var(--lab-border))",
          "border-strong": "hsl(var(--lab-border-strong))",
          control: "hsl(var(--lab-control))",
          text: "hsl(var(--lab-text))",
          muted: "hsl(var(--lab-text-muted))",
        },
        stage: {
          emerging: "hsl(var(--lab-stage-emerging))",
          peaking: "hsl(var(--lab-stage-peaking))",
          declining: "hsl(var(--lab-stage-declining))",
          parent: "hsl(var(--lab-stage-parent-territory))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom named colors for direct use
        "brand-teal": {
          light: "#20C997", // Primary Teal
          DEFAULT: "#149A9B", // Slightly darker Teal
          dark: "#0D7A70", // Darker Teal for text or deep backgrounds
        },
        "brand-coral": {
          DEFAULT: "#FF6B6B", // Accent Coral
          dark: "#CC2525",
        },
        "brand-yellow": {
          DEFAULT: "#FFD166", // Accent Sunny Yellow
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
