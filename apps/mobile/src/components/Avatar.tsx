import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Fonts } from "../theme/tokens";

interface AvatarProps {
  name: string;
  size?: number;
  isBot?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "#1ABC9C", "#2ECC71", "#3498DB", "#9B59B6", "#E67E22",
    "#E74C3C", "#1ABC9C", "#16A085", "#2980B9", "#8E44AD",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, size = 42, isBot = false }: AvatarProps) {
  const bg = isBot ? Colors.primary : getAvatarColor(name);
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      {isBot ? (
        <Text style={[styles.botIcon, { fontSize: fontSize * 1.3 }]}>🤖</Text>
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: Colors.textLight,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  botIcon: {
    lineHeight: undefined,
  },
});
