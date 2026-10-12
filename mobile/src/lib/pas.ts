import type { TextStyle } from "react-native";

/**
 * Colours of the redesign, copied exactly from the design handoff
 * (docs/design_handoff_pas_redesign/Local Stores Prototype.dc.html) and the
 * same as the website's src/lib/pas.ts. Never round or swap a value for a
 * nearby one.
 */
export const RED = "#A3171B";
export const INK = "#2B1D1A";
export const SOFT = "#6E5A55";

export const PAS = {
  red: RED,
  deepRed: "#7D1114",
  yellow: "#FFC000",
  white: "#fff",
  butter: "#FFF0C4",
  butterLight: "#FFF3D1",
  butterRoad: "#FFE7A3",
  butterRoadLight: "#FFEFC2",
  ink: INK,
  soft: SOFT,
  placeholder: "#8C7670",
  hairline: "#F1E6E2",
  border: "#E7D9D4",
  inputFill: "#F7F2EF",
  barTrack: "#EFE6E2",
  dashedBorder: "#D8C8C2",
  pickedFill: "#FFF7F5",
  mapPaper: "#FBF5EA",
  mapDots: "#E9DFD0",
  water: "#D3E4EC",
  waterLabel: "#5B8AA3",
  park: "#E4EDD6",
  parkLabel: "#6F8A55",
  areaLabel: "#B3A29B",
  miniMapPaper: "#F6F1EA",
  miniMapGrid: "#ECE3D7",
  miniMapWater: "#CFE0EA",
  savedCard: "#F2C8B9",
  backdrop: "#EFEAE6",
} as const;

type Family = "Playfair Display" | "Plus Jakarta Sans" | "Kalam" | "Anton";

// Each weight of a font is its own family on a phone, named as loaded in
// src/app/_layout.tsx.
const FACES: Record<Family, Record<number, string>> = {
  "Playfair Display": { 400: "PlayfairDisplay_400Regular", 500: "PlayfairDisplay_500Medium", 600: "PlayfairDisplay_600SemiBold", 700: "PlayfairDisplay_700Bold" },
  "Plus Jakarta Sans": { 400: "PlusJakartaSans_400Regular", 500: "PlusJakartaSans_500Medium", 600: "PlusJakartaSans_600SemiBold", 700: "PlusJakartaSans_700Bold", 800: "PlusJakartaSans_800ExtraBold" },
  Kalam: { 400: "Kalam_400Regular", 700: "Kalam_700Bold" },
  Anton: { 400: "Anton_400Regular" },
};

/**
 * The prototype's `font` shorthand as a phone text style:
 * `font("600 21px", "Playfair Display")` is `font:600 21px 'Playfair Display'`,
 * `font("italic 500 15px", ...)` its italic, and `font("600 18px/1.1", ...)`
 * sets the line height too, 1.1 times the size.
 */
export function font(spec: string, family: Family): TextStyle {
  const italic = spec.includes("italic");
  const [weight, sizes] = spec.replace("italic", "").trim().split(/\s+/);
  const [size, line] = sizes.split("/");
  const face = FACES[family][Number(weight)] ?? FACES[family][400];
  const fontSize = parseFloat(size);
  return {
    fontFamily: italic && family === "Playfair Display" ? `${face}_Italic` : face,
    fontSize,
    ...(line && { lineHeight: Math.round(fontSize * parseFloat(line)) }),
  };
}
