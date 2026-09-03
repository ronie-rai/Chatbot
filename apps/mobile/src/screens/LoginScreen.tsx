import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { BASE_URL } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [tenantSlug, setTenantSlug] = useState("OFA_Sports");
  const [email, setEmail] = useState("admin@ofa-sports.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password || !tenantSlug) {
      Alert.alert("Notice", "All fields are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          tenantSlug: tenantSlug.trim(),
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        Alert.alert("Sign In Failed", json.error?.message || "Invalid credentials");
        return;
      }

      navigation.replace("ConversationList");
    } catch {
      // Graceful offline fallback
      navigation.replace("ConversationList");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>💬</Text>
        <Text style={styles.title}>OFA Chatbot</Text>
        <Text style={styles.subtitle}>OFA Sports AI Assistant</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Organisation</Text>
          <TextInput
            style={styles.input}
            value={tenantSlug}
            onChangeText={setTenantSlug}
            placeholder="OFA_Sports"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@ofa-sports.com"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textLight} />
          ) : (
            <Text style={styles.loginBtnText}>Sign In →</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.headerBackground,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xxl * 2,
  },
  logo: { fontSize: 64, marginBottom: Spacing.md },
  title: { fontSize: 32, fontWeight: "800", color: Colors.textLight, letterSpacing: -0.5 },
  subtitle: { fontSize: Fonts.sizes.md, color: "rgba(255,255,255,0.7)", marginTop: Spacing.sm },
  form: {
    width: "100%",
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  inputGroup: { gap: Spacing.xs },
  label: { fontSize: Fonts.sizes.sm, fontWeight: "600", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: Fonts.sizes.md, color: Colors.textPrimary,
    backgroundColor: Colors.screenBackground,
  },
  loginBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: "center", marginTop: Spacing.sm,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: Colors.textLight, fontSize: Fonts.sizes.lg, fontWeight: "700" },
});
