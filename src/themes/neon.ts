/**
 * Area42 Neon Theme
 *
 * The signature dark theme with glowing accents.
 */

export interface Theme {
  name: string;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accent2: string;
  danger: string;
  warning: string;
  success: string;
  glow: (color: string, intensity?: number) => string;
  glass: (opacity?: number) => string;
}

export const NeonTheme: Theme = {
  name: "neon",
  bg: "#0a0e17",
  surface: "rgba(19, 26, 43, 0.85)",
  surface2: "rgba(25, 34, 54, 0.75)",
  border: "rgba(30, 45, 74, 0.6)",
  text: "#c8d6e5",
  textDim: "#6b7b8d",
  accent: "#00d4aa",
  accent2: "#4dabf7",
  danger: "#ff6b6b",
  warning: "#ffd43b",
  success: "#51cf66",
  glow: (color: string, intensity = 0.3) => {
    return `0 0 ${20 * intensity}px ${color}${Math.round(intensity * 255).toString(16).padStart(2, "0")}`;
  },
  glass: (opacity = 0.75) => `rgba(10, 14, 23, ${opacity})`,
};

export const GlassTheme: Theme = {
  ...NeonTheme,
  name: "glass",
  surface: "rgba(255, 255, 255, 0.05)",
  surface2: "rgba(255, 255, 255, 0.03)",
  border: "rgba(255, 255, 255, 0.1)",
};
