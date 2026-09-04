import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Linking,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { BASE_URL } from "../api/client";
import { MOCK_CURRENT_USER } from "../data/mockData";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;

export function AdminScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "ai" | "users">("overview");

  const handleOpenWebAdmin = () => {
    const webAdminUrl = `${BASE_URL}/admin`;
    Linking.canOpenURL(webAdminUrl).then((supported) => {
      if (supported) {
        Linking.openURL(webAdminUrl);
      } else {
        Alert.alert("Web Admin Portal", `Access the full desktop admin dashboard at:\n${webAdminUrl}`);
      }
    });
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => navigation.replace("Login"),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.headerBackground} barStyle="light-content" />

      {/* Header Profile Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>👑</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.badgeRow}>
              <Text style={styles.headerTitle}>OFA Sports</Text>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>SUPER ADMIN</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {MOCK_CURRENT_USER.email || "admin@ofa-sports.com"}
            </Text>
          </View>
        </View>

        {/* Tab Pills */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "overview" && styles.tabBtnActive]}
            onPress={() => setActiveTab("overview")}
          >
            <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextActive]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "ai" && styles.tabBtnActive]}
            onPress={() => setActiveTab("ai")}
          >
            <Text style={[styles.tabText, activeTab === "ai" && styles.tabTextActive]}>
              AI & Bot
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "users" && styles.tabBtnActive]}
            onPress={() => setActiveTab("users")}
          >
            <Text style={[styles.tabText, activeTab === "users" && styles.tabTextActive]}>
              Accounts
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {activeTab === "overview" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Metrics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>🏢</Text>
                <Text style={styles.statNumber}>1</Text>
                <Text style={styles.statLabel}>Tenant (OFA)</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>👥</Text>
                <Text style={styles.statNumber}>3</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>💬</Text>
                <Text style={styles.statNumber}>2</Text>
                <Text style={styles.statLabel}>Conversations</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>📊</Text>
                <Text style={[styles.statNumber, { color: "#25D366" }]}>Live</Text>
                <Text style={styles.statLabel}>Google Sheet</Text>
              </View>
            </View>

            {/* Integration Banner */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Google Sheets Sync</Text>
                <View style={styles.statusDotActive} />
              </View>
              <Text style={styles.cardBody}>
                Customer enquiries, phone numbers, and booking requests automatically sync to the{" "}
                <Text style={{ fontWeight: "700" }}>Bookings</Text> spreadsheet.
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.footerLabel}>Auth Mode:</Text>
                <Text style={styles.footerValue}>Service Account</Text>
              </View>
            </View>

            {/* Web Admin Portal Link */}
            <TouchableOpacity style={styles.actionCard} onPress={handleOpenWebAdmin}>
              <View style={styles.actionLeft}>
                <Text style={styles.actionIcon}>🖥️</Text>
                <View>
                  <Text style={styles.actionTitle}>Desktop Web Admin Portal</Text>
                  <Text style={styles.actionSubtitle}>Open browser dashboard at /admin</Text>
                </View>
              </View>
              <Text style={styles.arrowIcon}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "ai" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Bot Configuration</Text>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Active AI Model</Text>
              <Text style={styles.modelTag}>Groq • openai/gpt-oss-120b</Text>

              <Text style={[styles.cardLabel, { marginTop: Spacing.md }]}>Bot Personality / Role</Text>
              <Text style={styles.promptBox}>
                You are the official AI Assistant for OFA Sports. You help customers with sports
                facilities, court reservations, coaching programmes, and corporate events. Always be
                friendly, professional, and collect booking enquiries into Google Sheets.
              </Text>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Response Latency</Text>
                <Text style={styles.settingValue}>~450ms (Streaming)</Text>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Temperature</Text>
                <Text style={styles.settingValue}>0.7 (Balanced)</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === "users" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Authorized User Accounts</Text>

            {/* Super Admin */}
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>👑</Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userHeaderRow}>
                  <Text style={styles.userName}>Super Admin</Text>
                  <View style={styles.adminPill}>
                    <Text style={styles.adminPillText}>ADMIN</Text>
                  </View>
                </View>
                <Text style={styles.userEmail}>admin@ofa-sports.com</Text>
                <Text style={styles.userEnvNote}>Ruled by SUPER_ADMIN_EMAIL in .env</Text>
              </View>
            </View>

            {/* Demo User */}
            <View style={styles.userCard}>
              <View style={[styles.userAvatar, { backgroundColor: "#E3F2FD" }]}>
                <Text style={styles.userAvatarText}>👤</Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userHeaderRow}>
                  <Text style={styles.userName}>Demo User</Text>
                  <View style={styles.userPill}>
                    <Text style={styles.userPillText}>USER</Text>
                  </View>
                </View>
                <Text style={styles.userEmail}>demo@ofa-sports.com</Text>
                <Text style={styles.userEnvNote}>Standard chat user account</Text>
              </View>
            </View>

            {/* AI Assistant */}
            <View style={styles.userCard}>
              <View style={[styles.userAvatar, { backgroundColor: "#E8F5E9" }]}>
                <Text style={styles.userAvatarText}>🤖</Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userHeaderRow}>
                  <Text style={styles.userName}>OFA AI Assistant</Text>
                  <View style={[styles.userPill, { backgroundColor: "#C8E6C9" }]}>
                    <Text style={[styles.userPillText, { color: "#2E7D32" }]}>BOT</Text>
                  </View>
                </View>
                <Text style={styles.userEmail}>bot@ofa-sports.com</Text>
                <Text style={styles.userEnvNote}>Automated Groq conversational agent</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.chatNavBtn}
            onPress={() => navigation.navigate("ConversationList")}
          >
            <Text style={styles.chatNavText}>💬 Go to Conversations</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  headerCard: {
    backgroundColor: Colors.headerBackground,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  avatarEmoji: { fontSize: 24 },
  headerInfo: { flex: 1 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  headerTitle: { fontSize: Fonts.sizes.xl, fontWeight: "800", color: Colors.textLight },
  adminBadge: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  adminBadgeText: { fontSize: 10, fontWeight: "800", color: "#333" },
  headerSubtitle: { fontSize: Fonts.sizes.sm, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: Radius.full,
    padding: 3,
    marginTop: Spacing.xs,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: Radius.full },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: Fonts.sizes.sm, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  tabTextActive: { color: Colors.primary, fontWeight: "700" },
  content: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statNumber: { fontSize: Fonts.sizes.xxl, fontWeight: "800", color: Colors.textPrimary },
  statLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  cardTitle: { fontSize: Fonts.sizes.md, fontWeight: "700", color: Colors.textPrimary },
  statusDotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#25D366" },
  cardBody: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  footerValue: { fontSize: Fonts.sizes.xs, fontWeight: "600", color: Colors.textPrimary },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.md, flex: 1 },
  actionIcon: { fontSize: 24 },
  actionTitle: { fontSize: Fonts.sizes.sm, fontWeight: "700", color: Colors.textPrimary },
  actionSubtitle: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  arrowIcon: { fontSize: Fonts.sizes.lg, color: Colors.primary, fontWeight: "700" },
  cardLabel: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase" },
  modelTag: {
    fontSize: Fonts.sizes.sm,
    fontWeight: "700",
    color: Colors.primary,
    backgroundColor: "#E0F2F1",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  promptBox: {
    backgroundColor: Colors.screenBackground,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    fontSize: Fonts.sizes.xs,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  settingLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  settingValue: { fontSize: Fonts.sizes.xs, fontWeight: "600", color: Colors.textPrimary },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF9C4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  userAvatarText: { fontSize: 20 },
  userInfo: { flex: 1 },
  userHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: Fonts.sizes.sm, fontWeight: "700", color: Colors.textPrimary },
  adminPill: { backgroundColor: "#FFD700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
  adminPillText: { fontSize: 9, fontWeight: "800", color: "#333" },
  userPill: { backgroundColor: "#BBDEFB", paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
  userPillText: { fontSize: 9, fontWeight: "700", color: "#0D47A1" },
  userEmail: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  userEnvNote: { fontSize: 10, color: Colors.primary, marginTop: 2, fontStyle: "italic" },
  footerActions: { marginTop: Spacing.md, gap: Spacing.sm },
  chatNavBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  chatNavText: { color: Colors.textLight, fontSize: Fonts.sizes.md, fontWeight: "700" },
  signOutBtn: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#E53935",
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutText: { color: "#E53935", fontSize: Fonts.sizes.sm, fontWeight: "700" },
});
