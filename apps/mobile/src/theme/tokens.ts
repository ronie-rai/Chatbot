/**
 * Design tokens — WhatsApp-inspired color palette & spacing.
 * All UI components import from here for consistency.
 */

export const Colors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  primary: "#075E54",       // WhatsApp dark green (header, FAB)
  primaryLight: "#128C7E",  // WhatsApp medium green (active states)
  accent: "#25D366",        // WhatsApp bright green (online indicator, send btn)
  accentLight: "#DCF8C6",   // Sent bubble background (light mint)

  // ── Chat bubbles ───────────────────────────────────────────────────────────
  bubbleSent: "#DCF8C6",    // User's own messages
  bubbleReceived: "#FFFFFF",// Other participants' messages
  bubbleAI: "#E8F5E9",      // AI bot messages (slight green tint)

  // ── Backgrounds ───────────────────────────────────────────────────────────
  chatBackground: "#ECE5DD", // Classic WhatsApp chat wallpaper beige
  screenBackground: "#F0F0F0",
  listBackground: "#FFFFFF",

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary: "#111B21",   // Main body text
  textSecondary: "#667781", // Timestamps, subtitles
  textLight: "#FFFFFF",     // Text on dark backgrounds
  textAccent: "#25D366",    // Unread count, online

  // ── UI Elements ────────────────────────────────────────────────────────────
  border: "#E9EDEF",
  divider: "#E9EDEF",
  inputBackground: "#FFFFFF",
  headerBackground: "#075E54",
  iconGrey: "#8696A0",
  tickSent: "#8696A0",       // Single/double grey tick
  tickRead: "#53BDEB",       // Blue double tick
  unreadBadge: "#25D366",
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
