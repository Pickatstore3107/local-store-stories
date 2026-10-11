/**
 * Colours and fonts of the redesign, copied exactly from the design handoff
 * (docs/design_handoff_pas_redesign/Local Stores Prototype.dc.html). The
 * prototype sets every style inline, so redesigned components do the same
 * with these values. Never round or swap a value for a nearby one.
 *
 * Each redesigned screen's outer element carries a `data-pas` attribute,
 * which keeps the old pages' global heading style off it and gives its
 * links the prototype's red (src/app/globals.css).
 */

// The prototype's own names for its three main colours.
export const RED = "#A3171B";
export const INK = "#2B1D1A";
export const SOFT = "#6E5A55";

export const PAS = {
  // Brand
  red: RED,
  deepRed: "#7D1114", // text on yellow
  yellow: "#FFC000",
  white: "#fff",

  // Butter fills
  butter: "#FFF0C4",
  butterLight: "#FFF3D1",
  butterRoad: "#FFE7A3",
  butterRoadLight: "#FFEFC2",

  // Text
  ink: INK,
  soft: SOFT,
  placeholder: "#8C7670",

  // Lines and fills
  hairline: "#F1E6E2",
  border: "#E7D9D4",
  inputFill: "#F7F2EF",
  barTrack: "#EFE6E2",
  dashedBorder: "#D8C8C2", // the empty "+" photo slot in Add Place
  pickedFill: "#FFF7F5", // a picked photo or video tile in Add Place

  // Map
  mapPaper: "#FBF5EA",
  mapDots: "#E9DFD0",
  water: "#D3E4EC",
  waterLabel: "#5B8AA3",
  park: "#E4EDD6",
  parkLabel: "#6F8A55",
  areaLabel: "#B3A29B",

  // The small map card on a post
  miniMapPaper: "#F6F1EA",
  miniMapGrid: "#ECE3D7",
  miniMapWater: "#CFE0EA",

  // Saved illustration card (matches the sprite's own background)
  savedCard: "#F2C8B9",

  // Around the phone in the prototype only
  backdrop: "#EFEAE6",
} as const;

/**
 * The four font families, written as the prototype writes them, for use in
 * a `font` shorthand: `font: \`600 21px ${PLAYFAIR}\`` is the prototype's
 * `font:600 21px 'Playfair Display'`. The root layout loads them through
 * next/font/google under these same names.
 */
export const PLAYFAIR = "'Playfair Display'";
export const JAKARTA = "'Plus Jakarta Sans'";
export const KALAM = "'Kalam'";
export const ANTON = "'Anton'";
