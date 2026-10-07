/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#142235",
        "navy-light": "#1a2d45",
        workspace: "#F6F7F9",
        surface: "#FFFFFF",
        "surface-raised": "#FFFFFF",
        border: "#E5E7EB",
        "border-strong": "#D1D5DB",
        teal: "#087F8C",
        "teal-dark": "#066B76",
        "teal-light": "#E6F4F5",
        amber: "#D97706",
        "amber-dark": "#B45309",
        "amber-light": "#FEF3C7",
        "text-primary": "#111827",
        "text-secondary": "#4B5563",
        "text-muted": "#6B7280",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)",
        "card-hover": "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)",
      },
      keyframes: {
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-out-left": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(-100%)", opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "collapsible-down": {
          "0%": { height: "0", opacity: "0" },
          "100%": { height: "var(--radix-collapsible-content-height)", opacity: "1" },
        },
        "collapsible-up": {
          "0%": { height: "var(--radix-collapsible-content-height)", opacity: "1" },
          "100%": { height: "0", opacity: "0" },
        },
      },
      animation: {
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-out-left": "slide-out-left 0.2s ease-in",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-in",
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-in",
      },
    },
  },
  plugins: [],
};
