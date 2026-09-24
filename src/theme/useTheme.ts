import { useContext } from "react";

import { ThemeContext, type Theme } from "./ThemeProvider";
import type { MiniAppId } from "./tokens";

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return theme;
}

/** A mini-app's palette resolved to the current scheme. */
export type ResolvedMiniAppPalette = {
  surface: string;
  text: string;
  accent: string;
};

export function useMiniAppPalette(id: MiniAppId): ResolvedMiniAppPalette {
  const { miniAppPalettes, scheme } = useTheme();
  const p = miniAppPalettes[id];
  return {
    surface: p.surface[scheme],
    text: p.text[scheme],
    accent: p.accent[scheme],
  };
}

/** Convenience: a mini-app's accent (identity) colour for the current scheme. */
export function useMiniAppTint(id: MiniAppId): string {
  return useMiniAppPalette(id).accent;
}
