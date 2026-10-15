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
  Modal,
  Image,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { getEffectiveBaseUrl, setCustomBaseUrl, setAdminToken } from "../api/client";
import { MOCK_ADMIN_USER, MOCK_DEMO_USER, setCurrentUser } from "../data/mockData";
import { setAcademyToken } from "../academy/api";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || "admin@ofa-sports.com";
const ADMIN_PASSWORD = process.env.EXPO_PUBLIC_ADMIN_PASSWORD || "OFA@SuperAdmin2026";

const DEMO_EMAIL = process.env.EXPO_PUBLIC_DEMO_EMAIL || "demo@ofa-sports.com";
const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD || "demo@user123";

export function LoginScreen({ navigation }: Props) {
  const [tenantSlug, setTenantSlug] = useState("OFA_Sports");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [roleMode, setRoleMode] = useState<"demo" | "admin">("demo");
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getEffectiveBaseUrl());

  const selectRole = (mode: "demo" | "admin") => {
    setRoleMode(mode);
    if (mode === "demo") {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
      setTenantSlug("OFA_Sports");
    } else {
      setEmail(ADMIN_EMAIL);
      setPassword(ADMIN_PASSWORD);
      setTenantSlug("OFA_Sports");
    }
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanSlug = tenantSlug.trim();

    if (!cleanEmail || !password || !cleanSlug) {
      Alert.alert("Notice", "All fields (Organisation, Email, Password) are required");
      return;
    }

    setLoading(true);
    setAcademyToken(null);
    try {
      const res = await fetch(`${getEffectiveBaseUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          tenantSlug: cleanSlug,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        Alert.alert("Sign In Failed", json.error?.message || "Invalid credentials");
        return;
      }

      // Successful server-side authentication
      if (json.data?.adminToken) {
        setAdminToken(json.data.adminToken);
      }
      if (typeof json.data?.token === "string") {
        setAcademyToken(json.data.token);
      }
      if (json.data?.user) {
        setCurrentUser({
          id: json.data.user.id,
          name: json.data.user.name,
          email: json.data.user.email,
          role: json.data.user.role || (cleanEmail === ADMIN_EMAIL.toLowerCase() ? "admin" : "user"),
          tenantId: json.data.user.tenantId,
        });
      }

      navigation.replace("Dashboard");
    } catch {
      // ── Server unreachable (standalone mobile APK / offline mode) ──────────
      // Strictly validate against configured credentials — do not allow arbitrary passwords!
      const isAdminMatch =
        cleanEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
      const isDemoMatch =
        cleanEmail === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD;

      if (isAdminMatch) {
        setAdminToken("offline-sa-token");
        setCurrentUser(MOCK_ADMIN_USER);
        navigation.replace("Dashboard");
      } else if (isDemoMatch) {
        setCurrentUser(MOCK_DEMO_USER);
        navigation.replace("Dashboard");
      } else {
        Alert.alert(
          "Sign In Failed",
          "Invalid email or password.\n\nUse App User credentials or Admin credentials."
        );
      }
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
        <View style={styles.logoBadgeContainer}>
          <Image
            source={require("../../assets/ofa-logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>OFA Sports Foundation</Text>
        <Text style={styles.subtitle}>Sports AI Assistant &amp; Facility Hub</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Account Type Selector */}
        <View style={styles.roleSelector}>
          <TouchableOpacity
            style={[styles.roleBtn, roleMode === "demo" && styles.roleBtnActive]}
            onPress={() => selectRole("demo")}
            activeOpacity={0.8}
          >
            <Text style={[styles.roleBtnText, roleMode === "demo" && styles.roleBtnTextActive]}>
              👤 App User
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleBtn, roleMode === "admin" && styles.roleBtnActive]}
            onPress={() => selectRole("admin")}
            activeOpacity={0.8}
          >
            <Text style={[styles.roleBtnText, roleMode === "admin" && styles.roleBtnTextActive]}>
              👑 Admin
            </Text>
          </TouchableOpacity>
        </View>

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
            placeholder="user@ofa-sports.com"
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

        {/* Quick hint badge - only shown for admin if needed */}
        {roleMode === "admin" ? (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              🔑 Admin authentication mode
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textLight} />
          ) : (
            <Text style={styles.loginBtnText}>
              {roleMode === "admin" ? "Sign In as Admin →" : "Sign In →"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Dynamic Server URL Configuration Modal */}
      <Modal
        visible={showServerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend Server Connection</Text>
            <Text style={styles.modalSubtitle}>
              Connect this app to a cloud domain or local LAN server (e.g. http://192.168.1.50:3000).
            </Text>

            <TextInput
              style={styles.serverInput}
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              placeholder="http://192.168.1.50:3000"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={() => {
                  setServerUrlInput("http://localhost:3000");
                  setCustomBaseUrl(null);
                  setShowServerModal(false);
                }}
              >
                <Text style={styles.modalResetText}>Reset Default</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  setCustomBaseUrl(serverUrlInput.trim() || null);
                  setShowServerModal(false);
                  Alert.alert("Server Updated", `Backend target set to:\n${getEffectiveBaseUrl()}`);
                }}
              >
                <Text style={styles.modalSaveText}>Apply URL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoBadgeContainer: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#000000",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    overflow: "hidden",
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1.2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: Fonts.sizes.xs,
    color: "#A1A1AA",
    marginTop: Spacing.xs,
    textAlign: "center",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  form: {
    width: "100%",
    backgroundColor: "#0C0C0E",
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: "#27272A",
    padding: Spacing.xl,
    gap: Spacing.md,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  roleSelector: {
    flexDirection: "row",
    backgroundColor: "#18181B",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 4,
    marginBottom: Spacing.xs,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: Radius.md - 2,
  },
  roleBtnActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  roleBtnText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  roleBtnTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  inputGroup: { gap: Spacing.xs },
  label: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "800",
    color: "#A1A1AA",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#27272A",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Fonts.sizes.md,
    color: "#FFFFFF",
    backgroundColor: "#18181B",
  },
  hintContainer: {
    backgroundColor: "#18181B",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  hintText: {
    fontSize: Fonts.sizes.xs,
    color: "#E4E4E7",
    lineHeight: 16,
    fontWeight: "600",
  },
  loginBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: {
    color: "#000000",
    fontSize: Fonts.sizes.md,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  serverConfigBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  serverConfigText: {
    fontSize: Fonts.sizes.xs,
    color: "#A1A1AA",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: "#0C0C0E",
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: "#27272A",
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 380,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: Fonts.sizes.xs,
    color: "#A1A1AA",
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  serverInput: {
    borderWidth: 1.5,
    borderColor: "#27272A",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: Fonts.sizes.sm,
    color: "#FFFFFF",
    backgroundColor: "#18181B",
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
  },
  modalResetText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  modalSaveText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "800",
    color: "#000000",
  },
});
