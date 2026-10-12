import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import {
  fetchAssessments,
  type AcademyAssessment,
} from "../api";

export function GrowthScreen() {
  const [assessments, setAssessments] = useState<AcademyAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterScore, setFilterScore] = useState<string>("ALL");

  const loadData = useCallback(async () => {
    try {
      const items = await fetchAssessments();
      setAssessments(items || []);
    } catch {
      setAssessments([]);
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

  const filtered = (assessments || []).filter((a) => {
    if (filterScore === "HIGH") return a.scorePct >= 85;
    if (filterScore === "DEVELOPING") return a.scorePct < 85;
    return true;
  });

  const renderAssessment = ({ item }: { item: AcademyAssessment }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.playerName}>{item.playerName}</Text>
          <Text style={styles.subMeta}>
            {item.playerCode} • {item.batchName}
          </Text>
        </View>
        <View
          style={[
            styles.scoreBadge,
            item.scorePct >= 85 ? styles.scoreHigh : styles.scoreMid,
          ]}
        >
          <Text style={styles.scoreText}>{item.scorePct}%</Text>
        </View>
      </View>

      <Text style={styles.templateTitle}>📋 {item.templateName}</Text>

      {/* Metric Breakdown Progress Bars */}
      <View style={styles.metricsContainer}>
        {(item.metrics || []).map((m, idx) => {
          const pct = Math.min(Math.max((m.score / m.maxScore) * 100, 0), 100);
          return (
            <View key={idx} style={styles.metricRow}>
              <View style={styles.metricLabelRow}>
                <Text style={styles.metricName}>{m.name}</Text>
                <Text style={styles.metricScore}>
                  {m.score}/{m.maxScore}
                </Text>
              </View>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
            </View>
          );
        })}
      </View>

      {item.notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesText}>💬 {item.notes}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.assessedBy}>Assessed by: {item.conductedBy}</Text>
        <Text style={styles.assessedDate}>{item.assessedDate}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Growth & Skill Tracking</Text>
        <Text style={styles.bannerSubtitle}>
          Athletic capability matrices, technical development and fitness scoring.
        </Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {[
          { key: "ALL", label: "All Evaluations" },
          { key: "HIGH", label: "High Mastery (≥85%)" },
          { key: "DEVELOPING", label: "Developing (<85%)" },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filterScore === f.key && styles.filterChipActive]}
            onPress={() => setFilterScore(f.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterScore === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderAssessment}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No evaluations recorded</Text>
              <Text style={styles.emptySubtitle}>
                Conduct a periodic assessment to track player athleticism and skill progression.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  banner: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
  },
  bannerTitle: { color: Colors.textLight, fontSize: Fonts.sizes.xl, fontWeight: "800" },
  bannerSubtitle: { color: Colors.accentLight, fontSize: Fonts.sizes.xs, marginTop: 4 },
  filterRow: {
    flexDirection: "row",
    padding: Spacing.md,
    backgroundColor: Colors.listBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
  },
  filterChipActive: { backgroundColor: Colors.primaryLight },
  filterChipText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  filterChipTextActive: { color: Colors.textLight },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flex: 1 },
  playerName: { fontSize: Fonts.sizes.md, fontWeight: "700", color: Colors.textPrimary },
  subMeta: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  scoreBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  scoreHigh: { backgroundColor: "#E6F4EA" },
  scoreMid: { backgroundColor: "#FEF7E0" },
  scoreText: { fontSize: Fonts.sizes.sm, fontWeight: "800", color: Colors.primary },
  templateTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metricsContainer: { gap: Spacing.sm, marginVertical: Spacing.xs },
  metricRow: { gap: 2 },
  metricLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  metricName: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  metricScore: { fontSize: Fonts.sizes.xs, color: Colors.textPrimary, fontWeight: "700" },
  barBackground: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  notesBox: {
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  notesText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontStyle: "italic" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  assessedBy: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  assessedDate: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl, padding: Spacing.xl },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySubtitle: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.xs },
});
