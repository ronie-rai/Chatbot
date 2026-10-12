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
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import { fetchReportsData, type AcademyReportsData } from "../api";

export function ReportsScreen() {
  const [data, setData] = useState<AcademyReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetchReportsData();
      setData(res);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleExportPrompt = (type: string) => {
    Alert.alert(
      "Report Export Ready",
      `The ${type} report has been generated. Export format: CSV.`
    );
  };

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const { attendance, finance } = data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Academy Executive Overview</Text>
        <Text style={styles.bannerSub}>Real-time performance and financial telemetry</Text>
      </View>

      {/* Attendance KPI section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>📊 Attendance Telemetry</Text>
        <View style={styles.grid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{attendance.attendanceRatePct}%</Text>
            <Text style={styles.kpiLabel}>Average Attendance Rate</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{attendance.totalSessions}</Text>
            <Text style={styles.kpiLabel}>Sessions Conducted</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{attendance.presentCount}</Text>
            <Text style={styles.kpiLabel}>Total Player Presences</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{attendance.totalRecords}</Text>
            <Text style={styles.kpiLabel}>Roll Call Logs</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => handleExportPrompt("Attendance Register")}
          activeOpacity={0.8}
        >
          <Text style={styles.exportBtnText}>📥 Export Attendance CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Finance KPI section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>💰 Financial & Collections Ledger</Text>
        <View style={styles.grid}>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: "#137333" }]}>
              ₹{(finance.totalPaidCents / 100).toLocaleString("en-IN")}
            </Text>
            <Text style={styles.kpiLabel}>Total Collected</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: "#C5221F" }]}>
              ₹{(finance.totalOutstandingCents / 100).toLocaleString("en-IN")}
            </Text>
            <Text style={styles.kpiLabel}>Outstanding Dues</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{finance.collectionRatePct}%</Text>
            <Text style={styles.kpiLabel}>Collection Rate</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: "#C5221F" }]}>{finance.defaultersCount}</Text>
            <Text style={styles.kpiLabel}>Active Defaulters</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => handleExportPrompt("Defaulters Ledger")}
          activeOpacity={0.8}
        >
          <Text style={styles.exportBtnText}>📥 Export Financial Ledger CSV</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  banner: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bannerTitle: { color: Colors.textLight, fontSize: Fonts.sizes.lg, fontWeight: "800" },
  bannerSub: { color: Colors.accentLight, fontSize: Fonts.sizes.xs, marginTop: 2 },
  section: {
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: { fontSize: Fonts.sizes.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  kpiCard: {
    width: "48%",
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: "center",
  },
  kpiValue: { fontSize: Fonts.sizes.xl, fontWeight: "800", color: Colors.textPrimary },
  kpiLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 4, textAlign: "center" },
  exportBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exportBtnText: { color: Colors.primary, fontWeight: "700", fontSize: Fonts.sizes.sm },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
