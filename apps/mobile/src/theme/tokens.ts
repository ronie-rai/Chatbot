/**
 * Design tokens — WhatsApp-inspired color palette & spacing.
 * All UI components import from here for consistency.
 */

export const Colors = {
  // ── Brand (OFA Sports Foundation Monochrome Palette) ───────────────────────
  primary: "#000000",       // Pure black matching OFA logo
  primaryLight: "#18181B",  // Dark zinc / charcoal surface
  accent: "#FFFFFF",        // Crisp athletic white
  accentLight: "#27272A",   // Subtle dark border / surface

  // ── Chat bubbles ───────────────────────────────────────────────────────────
  bubbleSent: "#18181B",    // Sleek dark sport bubble with white text
  bubbleReceived: "#0F0F12",// Charcoal received bubble
  bubbleAI: "#141417",      // AI bot response bubble

  // ── Backgrounds ───────────────────────────────────────────────────────────
  chatBackground: "#000000", // Deep black background matching logo
  screenBackground: "#09090B",
  listBackground: "#0C0C0E",

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary: "#FFFFFF",   // High-contrast crisp white text
  textSecondary: "#A1A1AA", // Modern athletic silver text
  textLight: "#FFFFFF",     // Pure white
  textAccent: "#FFFFFF",    // Pure white accent

  // ── UI Elements ────────────────────────────────────────────────────────────
  border: "#27272A",
  divider: "#27272A",
  inputBackground: "#18181B",
  headerBackground: "#000000",
  iconGrey: "#71717A",
  tickSent: "#71717A",
  tickRead: "#FFFFFF",
  unreadBadge: "#FFFFFF",
} as const;

export const Fonts = {
  regular: "System",
  medium: "System",
  bold: "System",
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 16,
  bubble: 12,    // chat bubble corner radius
  full: 9999,
} as const;
