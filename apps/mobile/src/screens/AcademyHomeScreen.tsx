import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Colors, Fonts, Radius, Spacing } from "../theme/tokens";
import {
  fetchAcademyProfile,
  MOCK_ACTIVE_PROFILE,
  type AcademyNavModule,
  type AcademyProfile,
  type AcademyEnabledProfile,
} from "../academy/api";

type Props = NativeStackScreenProps<RootStackParamList, "Academy">;

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  COACH: "Coach",
  ACCOUNTS: "Accounts",
  RECEPTION: "Reception",
  GUARDIAN: "Parent / Guardian",
};

export function AcademyHomeScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<AcademyProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setProfile(await fetchAcademyProfile());
  }, []);

  useEffect(() => {
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  };

  const handleModulePress = (m: AcademyNavModule) => {
    switch (m.id) {
      case "players":
        navigation.navigate("AcademyPlayers", { initialTab: "players" });
        break;
      case "sports":
        navigation.navigate("AcademyPlayers", { initialTab: "sports" });
        break;
      case "batches":
      case "attendance":
        navigation.navigate("AcademyAttendance");
        break;
      case "growth":
        navigation.navigate("AcademyGrowth");
        break;
      case "fees":
      case "invoices":
      case "payments":
        navigation.navigate("AcademyFinance");
        break;
      case "facilities":
      case "bookings":
        navigation.navigate("AcademyBookings");
        break;
      case "announcements":
        navigation.navigate("AcademyAnnouncements");
        break;
      case "reports":
      case "audit":
        navigation.navigate("AcademyReports");
        break;
      case "portal":
      case "users":
      case "forms":
      case "jerseys":
      default:
        navigation.navigate("AcademyPlayers", { initialTab: "players" });
        break;
    }
  };

  const activeProfile: AcademyEnabledProfile = (
    profile?.enabled ? profile : MOCK_ACTIVE_PROFILE
  ) as AcademyEnabledProfile;

  const groups = activeProfile.navigation.reduce<Record<string, AcademyNavModule[]>>((acc, m) => {
    (acc[m.group] ??= []).push(m);
    return acc;
  }, {});

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerName}>{activeProfile.user?.name ?? "Academy Hub"}</Text>
        <Text style={styles.bannerRole}>{ROLE_LABEL[activeProfile.role] ?? activeProfile.role}</Text>
      </View>

      {Object.entries(groups).map(([group, modules]) => (
        <View key={group} style={styles.section}>
          <Text style={styles.sectionTitle}>{group}</Text>
          {modules.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.card}
              onPress={() => handleModulePress(m)}
              activeOpacity={0.7}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardRequires}>Active • {m.requires}</Text>
              </View>
              <Text style={styles.cardArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
    backgroundColor: Colors.screenBackground,
  },
  emptyTitle: { fontSize: Fonts.sizes.xl, fontWeight: "700", color: Colors.textPrimary },
  emptyBody: {
    marginTop: Spacing.sm,
    textAlign: "center",
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
  },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  retryText: { color: Colors.textLight, fontWeight: "700", fontSize: Fonts.sizes.md },
  banner: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  bannerName: { color: Colors.textLight, fontSize: Fonts.sizes.xxl, fontWeight: "800" },
  bannerRole: { color: Colors.accentLight, fontSize: Fonts.sizes.md, marginTop: Spacing.xs },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: Fonts.sizes.lg, fontWeight: "600", color: Colors.textPrimary },
  cardRequires: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  cardArrow: { fontSize: Fonts.sizes.lg, color: Colors.primary, fontWeight: "700", marginLeft: Spacing.md },
});
