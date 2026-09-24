import { createContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import {
  darkColors,
  lightColors,
  spacing,
  radii,
  typography,
  elevation,
  motion,
  leafRadii,
  miniAppPalettes,
  type ColorTokens,
} from "./tokens";

export type Theme = {
  scheme: "light" | "dark";
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  leafRadii: typeof leafRadii;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
  miniAppPalettes: typeof miniAppPalettes;
};

export const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Android system setting only — no in-app override in v1.
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const value = useMemo<Theme>(
    () => ({
      scheme,
      colors: scheme === "dark" ? darkColors : lightColors,
      spacing,
      radii,
      leafRadii,
      typography,
      elevation,
      motion,
      miniAppPalettes,
    }),
    [scheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
