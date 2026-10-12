import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import {
  fetchBatches,
  fetchSessionAttendance,
  fetchSessions,
  markAttendance,
  type AcademyBatch,
  type AcademySession,
} from "../api";

interface PlayerAttendanceState {
  playerId: string;
  playerName: string;
  playerCode: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  notes?: string;
}

export function AttendanceScreen() {
  const [batches, setBatches] = useState<AcademyBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [attendance, setAttendance] = useState<PlayerAttendanceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadBatches = useCallback(async () => {
    try {
      const bList = await fetchBatches();
      setBatches(bList);
      if (bList.length > 0 && !selectedBatchId) {
        setSelectedBatchId(bList[0].id);
      }
    } catch {
      // Fallback in api.ts
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (!selectedBatchId) return;
    let active = true;
    void fetchSessions(selectedBatchId).then((sess) => {
      if (!active) return;
      setSessions(sess);
      if (sess.length > 0) {
        setSelectedSessionId(sess[0].id);
      } else {
        setSelectedSessionId("");
        setAttendance([]);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedBatchId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    let active = true;
    void fetchSessionAttendance(selectedSessionId).then((records) => {
      if (!active) return;
      const mapped = records.map((r) => ({
        playerId: r.playerId,
        playerName: r.player?.fullName ?? "Academy Player",
        playerCode: r.player?.playerCode ?? "OFA-PLAYER",
        status: r.status,
        notes: r.notes || undefined,
      }));
      setAttendance(mapped);
    });
    return () => {
      active = false;
    };
  }, [selectedSessionId]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadBatches();
  };

  const setPlayerStatus = (playerId: string, status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => {
    setAttendance((prev) =>
      prev.map((p) => (p.playerId === playerId ? { ...p, status } : p))
    );
  };

  const markAll = (status: "PRESENT" | "ABSENT") => {
    setAttendance((prev) => prev.map((p) => ({ ...p, status })));
  };

  const handleSave = async () => {
    if (!selectedSessionId) {
      Alert.alert("No Session", "Please select a training session to mark attendance.");
      return;
    }

    setSaving(true);
    const opId = `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    try {
      const res = await markAttendance({
        sessionId: selectedSessionId,
        records: attendance.map((a) => ({
          playerId: a.playerId,
          status: a.status,
          notes: a.notes,
        })),
        opId,
      });

      if (!res.ok) {
        Alert.alert("Error", res.error || "Failed to submit attendance");
        return;
      }

      Alert.alert("Saved", `Attendance saved successfully (${res.count ?? attendance.length} marked)`);
    } catch {
      Alert.alert("Error", "Network error submitting attendance");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = attendance.filter((a) => a.status === "PRESENT").length;
  const absentCount = attendance.filter((a) => a.status === "ABSENT").length;
  const lateCount = attendance.filter((a) => a.status === "LATE").length;

  const renderAttendanceRow = ({ item }: { item: PlayerAttendanceState }) => (
    <View style={styles.playerRow}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.playerName}</Text>
        <Text style={styles.playerCode}>{item.playerCode}</Text>
      </View>

      <View style={styles.statusButtons}>
        {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((st) => {
          const isActive = item.status === st;
          return (
            <TouchableOpacity
              key={st}
              style={[
                styles.statusBtn,
                st === "PRESENT" && (isActive ? styles.btnPresentActive : styles.btnPresent),
                st === "ABSENT" && (isActive ? styles.btnAbsentActive : styles.btnAbsent),
                st === "LATE" && (isActive ? styles.btnLateActive : styles.btnLate),
                st === "EXCUSED" && (isActive ? styles.btnExcusedActive : styles.btnExcused),
              ]}
              onPress={() => setPlayerStatus(item.playerId, st)}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  isActive && styles.statusBtnTextActive,
                ]}
              >
                {st[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Batch selector */}
      <View style={styles.selectorBar}>
        <Text style={styles.barLabel}>Batch:</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={batches}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.batchChip,
                selectedBatchId === item.id && styles.batchChipActive,
              ]}
              onPress={() => setSelectedBatchId(item.id)}
            >
              <Text
                style={[
                  styles.batchChipText,
                  selectedBatchId === item.id && styles.batchChipTextActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Metrics Banner */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricNum}>{attendance.length}</Text>
          <Text style={styles.metricLabel}>Total</Text>
        </View>
        <View style={[styles.metricCard, { borderTopColor: "#34A853" }]}>
          <Text style={[styles.metricNum, { color: "#34A853" }]}>{presentCount}</Text>
          <Text style={styles.metricLabel}>Present</Text>
        </View>
        <View style={[styles.metricCard, { borderTopColor: "#EA4335" }]}>
          <Text style={[styles.metricNum, { color: "#EA4335" }]}>{absentCount}</Text>
          <Text style={styles.metricLabel}>Absent</Text>
        </View>
        <View style={[styles.metricCard, { borderTopColor: "#FBBC05" }]}>
          <Text style={[styles.metricNum, { color: "#FBBC05" }]}>{lateCount}</Text>
          <Text style={styles.metricLabel}>Late</Text>
        </View>
      </View>

      {/* Bulk action buttons */}
      <View style={styles.bulkBar}>
        <TouchableOpacity
          style={styles.bulkBtn}
          onPress={() => markAll("PRESENT")}
        >
          <Text style={styles.bulkBtnText}>✓ Mark All Present</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bulkBtn, { backgroundColor: "#FCE8E6" }]}
          onPress={() => markAll("ABSENT")}
        >
          <Text style={[styles.bulkBtnText, { color: "#D93025" }]}>✕ Clear All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={attendance}
          keyExtractor={(item) => item.playerId}
          renderItem={renderAttendanceRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No sessions scheduled</Text>
              <Text style={styles.emptySubtitle}>
                Select an active training batch to view registered players and take roll call.
              </Text>
            </View>
          }
        />
      )}

      {/* Save Button */}
      {attendance.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textLight} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Roll Call ({presentCount}/{attendance.length})</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  selectorBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: Colors.listBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  barLabel: { fontSize: Fonts.sizes.sm, fontWeight: "700", color: Colors.textSecondary, marginRight: Spacing.sm },
  batchChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
    marginRight: Spacing.xs,
  },
  batchChipActive: { backgroundColor: Colors.primary },
  batchChipText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  batchChipTextActive: { color: Colors.textLight },
  metricsRow: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.listBackground,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: "center",
    borderTopWidth: 3,
    borderTopColor: Colors.primary,
  },
  metricNum: { fontSize: Fonts.sizes.xl, fontWeight: "800", color: Colors.textPrimary },
  metricLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  bulkBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  bulkBtn: {
    flex: 1,
    backgroundColor: "#E6F4EA",
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  bulkBtnText: { color: "#137333", fontWeight: "700", fontSize: Fonts.sizes.sm },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: Fonts.sizes.md, fontWeight: "700", color: Colors.textPrimary },
  playerCode: { fontSize: Fonts.sizes.xs, color: Colors.primary, marginTop: 2, fontWeight: "600" },
  statusButtons: { flexDirection: "row", gap: 6 },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPresent: { backgroundColor: "#E6F4EA" },
  btnPresentActive: { backgroundColor: "#34A853" },
  btnAbsent: { backgroundColor: "#FCE8E6" },
  btnAbsentActive: { backgroundColor: "#EA4335" },
  btnLate: { backgroundColor: "#FEF7E0" },
  btnLateActive: { backgroundColor: "#FBBC05" },
  btnExcused: { backgroundColor: "#E8F0FE" },
  btnExcusedActive: { backgroundColor: "#4285F4" },
  statusBtnText: { fontWeight: "800", fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  statusBtnTextActive: { color: Colors.textLight },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.listBackground,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  saveBtnText: { color: Colors.textLight, fontSize: Fonts.sizes.md, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl, padding: Spacing.xl },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySubtitle: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.xs },
});
