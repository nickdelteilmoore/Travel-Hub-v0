// DESIGN.md §3–§4 — single source of truth for colour, type, geometry, spacing.
// Components consume these via useTheme(); never hardcode hex values.

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  primary: string;
  onPrimary: string;
  /** Warm Clay CTA (#C87443) — primary action buttons, boost pill. */
  terracotta: string;
  sage: string;
  clay: string;
  text: string;
  textMuted: string;
  star: string;
  danger: string;
  warning: string;
  success: string;
  overlay: string;
};

// exact hexes. Light canvas = Cream Linen; primary = Botanical Olive.
export const lightColors: ColorTokens = {
  bg: "#F5F3ED",
  surface: "#FFFFFF",
  surfaceAlt: "#EFEAE0",
  border: "#E2DCCE",
  primary: "#55632E",
  onPrimary: "#F5F3ED",
  terracotta: "#C87443",
  sage: "#8FA98C",
  clay: "#C2A183",
  text: "#1C2217",
  textMuted: "#606859",
  star: "#D9A441",
  danger: "#B3502F",
  warning: "#C08A2E",
  success: "#4C7A5A",
  overlay: "rgba(28,34,23,0.45)",
};

// "Deep Moss & Spruce". Base #1C241B / background #161D15 / card #243023.
export const darkColors: ColorTokens = {
  bg: "#161D15",
  surface: "#243023",
  surfaceAlt: "#2E3B2C",
  border: "#34412F",
  primary: "#92B588",
  onPrimary: "#161D15",
  terracotta: "#D98A5A",
  sage: "#8FA98C",
  clay: "#A98D74",
  text: "#F5F3ED",
  textMuted: "#A2AA9A",
  star: "#E0B25C",
  danger: "#D97A57",
  warning: "#D6A54A",
  success: "#8CBF9A",
  overlay: "rgba(0,0,0,0.60)",
};

// 4pt spacing scale.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  /** Brand — modals and bottom sheets carry 24px top radii. */
  xl: 24,
  full: 9999,
} as const;

// Asymmetrical leaf corner system: sharp stem point at bottom-left.
// Spread directly onto a card's style.
export const leafRadii = {
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  borderBottomRightRadius: 20,
  borderBottomLeftRadius: 0,
} as const;

// Loaded font family names. Google-font keys come from @expo-google-fonts/*
// (family name === export token).
//
// Two families: Albert Sans for every display and UI role and Inter for body
// and numbers. Numbers are Inter with tabular figures (the `mono` and
// `sectionNumber` variants below) rather than a separate monospace face.
export const fonts = {
  hero: "AlbertSans_600SemiBold", // hero title / screen titles
  sectionNumber: "Inter_700Bold", // big stats 36–56 — Inter, tabular
  title: "AlbertSans_600SemiBold", // card & dialog titles 20–24
  cardTitle: "AlbertSans_700Bold", // card titles 18–20
  listHeading: "AlbertSans_600SemiBold", // list item headings 16
  heading: "AlbertSans_600SemiBold", // section / UI headings
  bodyBold: "Inter_700Bold", // active filters, emphasis
  bodyMedium: "Inter_500Medium",
  body: "Inter_400Regular",
  eyebrow: "AlbertSans_700Bold", // category tracking labels 10pt uppercase
  mono: "Inter_700Bold", // amounts / credentials — Inter, tabular figures
} as const;

export type TypographyToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: "uppercase" | "none";
  /** Numbers set in Inter opt into tabular figures so columns line up. */
  fontVariant?: ("tabular-nums" | "oldstyle-nums")[];
};

export type TypographyVariant =
  | "display"
  | "title"
  | "heading"
  | "cardTitle"
  | "listHeading"
  | "sectionNumber"
  | "body"
  | "bodyMedium"
  | "bodyBold"
  | "subhead"
  | "caption"
  | "eyebrow"
  | "mono";

// typography hierarchy.
export const typography: Record<TypographyVariant, TypographyToken> = {
  display: { fontFamily: fonts.hero, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.title, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  cardTitle: { fontFamily: fonts.cardTitle, fontSize: 18, lineHeight: 24 },
  listHeading: { fontFamily: fonts.listHeading, fontSize: 16, lineHeight: 22 },
  sectionNumber: { fontFamily: fonts.sectionNumber, fontSize: 40, lineHeight: 44, fontVariant: ["tabular-nums"] },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  subhead: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  eyebrow: {
    fontFamily: fonts.eyebrow,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  mono: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
};

export const elevation = {
  // Flat design; only FABs + modals get a soft tinted shadow.
  raised: {
    shadowColor: "#1C2217",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

export const motion = {
  // reanimated spring physics: damping 18–20, stiffness 150–180.
  spring: { damping: 19, stiffness: 165 },
  standardMs: 200,
  fillTickMs: 150,
  strikeMs: 200,
  archiveDelayMs: 600,
  undoMs: 4000,
  longPressMs: 300,
} as const;

export type MiniAppId = "travel";

// Mini-app colour palette. Each value carries a light/dark pair.
// `text` is the primary text on the app's surface; `accent` drives header
// eyebrows, active filter underlines, and identity marks.
export type SchemePair = { light: string; dark: string };
export type MiniAppPalette = {
  surface: SchemePair;
  text: SchemePair;
  accent: SchemePair;
};

export const miniAppPalettes: Record<MiniAppId, MiniAppPalette> = {
  travel: {
    surface: { light: "#C8DCE0", dark: "#203236" },
    text: { light: "#23464C", dark: "#F5F3ED" },
    accent: { light: "#23464C", dark: "#9BB9BF" },
  },
};
