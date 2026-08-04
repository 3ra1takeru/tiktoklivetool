/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ナチュラル＆ヒーリングパレット
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
        // ナチュラルテーマ固有の定義
        beige: {
          50: "#FAF8F5",
          100: "#F5F0E8",
          200: "#EADFC9",
          300: "#DECDB0",
          700: "#8A7453",
          800: "#604E35",
        },
        sage: {
          50: "#F4F6F4",
          100: "#E9ECE9",
          200: "#D3DBD3",
          500: "#7F9F7F",
          700: "#506B50",
        },
        gold: {
          100: "#F6F1E5",
          200: "#E8DDBF",
          500: "#C5A880",
          600: "#B0926A",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        serif: ["Shippori Mincho", "Zen Old Mincho", "Georgia", "serif"],
        sans: ["Outfit", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
