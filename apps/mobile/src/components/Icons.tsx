import React from "react";
import { View, Text, Platform, StyleSheet } from "react-native";

interface IconProps {
  size?: number;
  color?: string;
}

export function PaperclipIcon({ size = 22, color = "#54656F" }: IconProps) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block" }}
      >
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
    );
  }
  return <Text style={[styles.nativeEmoji, { fontSize: size - 2 }]}>📎</Text>;
}

export function SmileyIcon({ size = 22, color = "#54656F" }: IconProps) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block" }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
        <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
      </svg>
    );
  }
  return <Text style={[styles.nativeEmoji, { fontSize: size - 2 }]}>😊</Text>;
}

export function MicIcon({ size = 22, color = "#54656F" }: IconProps) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block" }}
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );
  }
  return <Text style={[styles.nativeEmoji, { fontSize: size - 2 }]}>🎙️</Text>;
}

export function SendIcon({ size = 18, color = "#FFFFFF" }: IconProps) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block", marginLeft: 2 }}
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" fill={color} />
      </svg>
    );
  }
  return (
    <View style={styles.sendIconContainer}>
      <Text style={[styles.nativeSendGlyph, { color, fontSize: size }]}>
        ➤
      </Text>
    </View>
  );
}

export function TrashIcon({ size = 20, color = "#E53935" }: IconProps) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block" }}
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    );
  }
  return <Text style={[styles.nativeEmoji, { fontSize: size - 2 }]}>🗑️</Text>;
}

const styles = StyleSheet.create({
  nativeEmoji: {
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  sendIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  nativeSendGlyph: {
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
