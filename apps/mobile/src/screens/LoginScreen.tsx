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
      if (json.data?.user) {
        setCurrentUser({
          id: json.data.user.id,
          name: json.data.user.name,
          email: json.data.user.email,
          role: json.data.user.role || (cleanEmail === ADMIN_EMAIL.toLowerCase() ? "admin" : "user"),
          tenantId: json.data.user.tenantId,
        });
      }

      navigation.replace("ConversationList");
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
        navigation.replace("ConversationList");
      } else if (isDemoMatch) {
        setCurrentUser(MOCK_DEMO_USER);
        navigation.replace("ConversationList");
      } else {
        Alert.alert(
          "Sign In Failed",
          "Invalid email or password.\n\nUse App User credentials or Admin credentials ruled by .env."
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
              👑 Admin (.env)
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

        {/* Quick hint badge */}
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            {roleMode === "admin"
              ? "🔑 Admin password ruled by SUPER_ADMIN_PASSWORD in .env"
              : "💡 App User: access sports chat, bookings & services"}
          </Text>
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
    backgroundColor: Colors.headerBackground,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoBadgeContainer: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: "#000000",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "hidden",
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  title: { fontSize: 26, fontWeight: "800", color: Colors.textLight, letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: Fonts.sizes.sm, color: "rgba(255,255,255,0.8)", marginTop: Spacing.xs, textAlign: "center" },
  form: {
    width: "100%",
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  roleSelector: {
    flexDirection: "row",
    backgroundColor: "#F0F2F5",
    borderRadius: Radius.md,
    padding: 3,
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
    color: Colors.textSecondary,
  },
  roleBtnTextActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  inputGroup: { gap: Spacing.xs },
  label: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.screenBackground,
  },
  hintContainer: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  hintText: {
    fontSize: Fonts.sizes.xs,
    color: "#2E7D32",
    lineHeight: 16,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: Colors.textLight, fontSize: Fonts.sizes.md, fontWeight: "700" },
  serverConfigBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  serverConfigText: {
    fontSize: Fonts.sizes.xs,
    color: "#54656F",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 380,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  serverInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Fonts.sizes.sm,
    color: Colors.textPrimary,
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
    backgroundColor: "#F0F2F5",
    alignItems: "center",
  },
  modalResetText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "600",
    color: "#54656F",
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  modalSaveText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
