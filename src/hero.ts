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
        foreground: "#14181f",
        primary: { DEFAULT: "#1769e0", foreground: "#ffffff" },
        secondary: { DEFAULT: "#6929c4", foreground: "#ffffff" },
        success: { DEFAULT: "#198038", foreground: "#ffffff" },
        warning: { DEFAULT: "#f1a208", foreground: "#14181f" },
        danger: { DEFAULT: "#da1e28", foreground: "#ffffff" },
      },
    },
    dark: {
      colors: {
        background: "#0d1117",
        foreground: "#e6e9ef",
        primary: { DEFAULT: "#4589ff", foreground: "#0d1117" },
      },
    },
  },
});
