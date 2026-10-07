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
    },
  },
  plugins: [],
};
