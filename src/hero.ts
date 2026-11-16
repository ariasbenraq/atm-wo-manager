// hero.ts
import { heroui } from "@heroui/react";

export default heroui({
  layout: {
    radius: { small: "8px", medium: "12px", large: "16px" },
  },
  themes: {
    light: {
      colors: {
        background: "#f3f5f9",
        default: { 400: "#6b6b76", 500: "#585863" },
        foreground: "#14181f",
        primary: { DEFAULT: "#1769e0", foreground: "#ffffff" },
        secondary: { DEFAULT: "#6929c4", foreground: "#ffffff" },
        success: { DEFAULT: "#198038", foreground: "#ffffff", 700: "#0b5a2a" },
        warning: { DEFAULT: "#f1a208", foreground: "#14181f", 700: "#744a0a" },
        danger: { DEFAULT: "#da1e28", foreground: "#ffffff" },
      },
    },
    dark: {
      colors: {
        background: "#0d1117",
        foreground: "#e6e9ef",
        default: { 400: "#9a9aa6" },
        primary: { DEFAULT: "#4589ff", foreground: "#0d1117" },
      },
    },
  },
});
