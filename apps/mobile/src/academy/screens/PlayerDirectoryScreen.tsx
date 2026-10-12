import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import {
  admitPlayer,
  fetchPlayers,
  fetchSports,
  type AcademyPlayer,
  type AcademySport,
} from "../api";

type Props = NativeStackScreenProps<RootStackParamList, "AcademyPlayers">;

export function PlayerDirectoryScreen({ route }: Props) {
  const [activeTab, setActiveTab] = useState<"players" | "sports">(
    route.params?.initialTab === "sports" ? "sports" : "players"
  );
  const [players, setPlayers] = useState<AcademyPlayer[]>([]);
  const [sports, setSports] = useState<AcademySport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal State for Admission
  const [isAdmitModalVisible, setIsAdmitModalVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("2012-06-15");
  const [gender, setGender] = useState("MALE");
  const [selectedSportId, setSelectedSportId] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetchPlayers({ search: search.trim() || undefined }),
        fetchSports(),
      ]);
      setPlayers(pRes?.players || []);
      setSports(sRes || []);
      if ((sRes || []).length > 0 && !selectedSportId) {
        setSelectedSportId(sRes[0].id);
      }
    } catch {
      setPlayers([]);
      setSports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedSportId]);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleAdmit = async () => {
    if (!fullName.trim() || !guardianName.trim() || !guardianPhone.trim()) {
      Alert.alert("Missing Fields", "Full name, Guardian name, and Guardian phone are required.");
      return;
    }
    if (!selectedSportId) {
      Alert.alert("Missing Sport", "Please select a primary sport.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await admitPlayer({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth.trim(),
        gender,
        primarySportId: selectedSportId,
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        medicalNotes: medicalNotes.trim() || undefined,
      });

      if (!res.ok || !res.player) {
        Alert.alert("Admission Failed", res.error || "Could not register player");
        return;
      }

      Alert.alert(
        "Admission Successful",
        `Assigned ID: ${res.player.playerCode}\nPlayer: ${res.player.fullName}`
      );
      setIsAdmitModalVisible(false);
      setFullName("");
      setGuardianName("");
      setGuardianPhone("");
      setMedicalNotes("");
      void loadData();
    } catch {
      Alert.alert("Error", "Unexpected network error during admission");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = (players || []).filter((p) => {
    if (!p) return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    return true;
  });

  const renderPlayer = ({ item }: { item: AcademyPlayer }) => {
    const displayName = item.fullName || (item as any).name || "Academy Player";
    const initials = displayName.length >= 2 ? displayName.slice(0, 2).toUpperCase() : "AP";
    const sportName = item.primarySport?.name || "General Athletics";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.playerMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{displayName}</Text>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.playerCode || "OFA-*"}</Text>
              </View>
            </View>
            <Text style={styles.sportText}>
              ⚽ {sportName} • {item.gender || "MALE"}
            </Text>
          </View>
          <View
            style={[
              styles.statusTag,
              item.status === "ACTIVE" ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text style={styles.statusText}>{item.status || "ACTIVE"}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <Text style={styles.guardianLabel}>
            Guardian: <Text style={styles.guardianValue}>{item.guardianName || "N/A"} ({item.guardianPhone || "N/A"})</Text>
          </Text>
          {item.medicalNotes ? (
            <Text style={styles.medNotes}>⚠️ {item.medicalNotes}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderSport = ({ item }: { item: AcademySport }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🏅</Text>
        </View>
        <View style={styles.playerMeta}>
          <Text style={styles.playerName}>{item.name}</Text>
          <Text style={styles.sportText}>
            Billing: {(item.billingMethod || "MONTHLY_RECURRING").replace(/_/g, " ")} • {item.category || "SPORTS"}
          </Text>
        </View>
        <View
          style={[
            styles.statusTag,
            item.isActive ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <Text style={styles.statusText}>{item.isActive ? "ACTIVE" : "INACTIVE"}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Main Mode Toggle */}
      <View style={styles.mainToggleBar}>
        <TouchableOpacity
          style={[styles.mainToggleBtn, activeTab === "players" && styles.mainToggleBtnActive]}
          onPress={() => setActiveTab("players")}
        >
          <Text style={[styles.mainToggleText, activeTab === "players" && styles.mainToggleTextActive]}>
            👥 Players Directory ({(players || []).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainToggleBtn, activeTab === "sports" && styles.mainToggleBtnActive]}
          onPress={() => setActiveTab("sports")}
        >
          <Text style={[styles.mainToggleText, activeTab === "sports" && styles.mainToggleTextActive]}>
            🏅 Sports Master ({(sports || []).length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "players" ? (
        <>
          {/* Search & Actions */}
          <View style={styles.topBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, ID (OFA-*), or phone..."
              placeholderTextColor={Colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => void loadData()}
            />
            <TouchableOpacity
              style={styles.admitBtn}
              onPress={() => setIsAdmitModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.admitBtnText}>+ Admit</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsRow}>
            {["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"].map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.tabChip, statusFilter === st && styles.tabChipActive]}
                onPress={() => setStatusFilter(st)}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    statusFilter === st && styles.tabChipTextActive,
                  ]}
                >
                  {st}
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
              renderItem={renderPlayer}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No players found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try adjusting your search criteria or register a new admission.
                  </Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        /* Sports Master Tab */
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={sports || []}
            keyExtractor={(item) => item.id}
            renderItem={renderSport}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No sports configured</Text>
                <Text style={styles.emptySubtitle}>
                  Configure academy disciplines in system settings.
                </Text>
              </View>
            }
          />
        )
      )}

      {/* Admission Modal */}
      <Modal visible={isAdmitModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Admit New Player</Text>
            <Text style={styles.modalSubtitle}>
              Generates an atomic OFA-* identifier sequence upon registration.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Player Full Name *"
              placeholderTextColor={Colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />

            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="DOB (YYYY-MM-DD)"
                placeholderTextColor={Colors.textSecondary}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
              />
              <View style={[styles.genderRow, styles.halfInput]}>
                {["MALE", "FEMALE"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        gender === g && styles.genderTextActive,
                      ]}
                    >
                      {g[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.fieldLabel}>Primary Sport *</Text>
            <View style={styles.sportPills}>
              {(sports || []).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.sportPill,
                    selectedSportId === s.id && styles.sportPillActive,
                  ]}
                  onPress={() => setSelectedSportId(s.id)}
                >
                  <Text
                    style={[
                      styles.sportPillText,
                      selectedSportId === s.id && styles.sportPillTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Guardian Full Name *"
              placeholderTextColor={Colors.textSecondary}
              value={guardianName}
              onChangeText={setGuardianName}
            />

            <TextInput
              style={styles.input}
              placeholder="Guardian Contact Phone *"
              placeholderTextColor={Colors.textSecondary}
              value={guardianPhone}
              keyboardType="phone-pad"
              onChangeText={setGuardianPhone}
            />

            <TextInput
              style={styles.input}
              placeholder="Medical Notes / Allergies (Optional)"
              placeholderTextColor={Colors.textSecondary}
              value={medicalNotes}
              onChangeText={setMedicalNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAdmitModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAdmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.textLight} size="small" />
                ) : (
                  <Text style={styles.submitText}>Submit Admission</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  mainToggleBar: {
    flexDirection: "row",
    backgroundColor: Colors.listBackground,
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mainToggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.screenBackground,
  },
  mainToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  mainToggleText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  mainToggleTextActive: {
    color: Colors.textLight,
  },
  topBar: {
    flexDirection: "row",
    padding: Spacing.md,
    backgroundColor: Colors.listBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
  },
  admitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  admitBtnText: { color: Colors.textLight, fontWeight: "700", fontSize: Fonts.sizes.md },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.listBackground,
    gap: Spacing.sm,
  },
  tabChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
  },
  tabChipActive: { backgroundColor: Colors.primaryLight },
  tabChipText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  tabChipTextActive: { color: Colors.textLight },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: Colors.primary, fontWeight: "800", fontSize: Fonts.sizes.md },
  playerMeta: { flex: 1, marginLeft: Spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  playerName: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  codeBadge: {
    backgroundColor: Colors.screenBackground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  codeText: { fontSize: Fonts.sizes.xs, color: Colors.primary, fontWeight: "700" },
  sportText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusActive: { backgroundColor: "#E6F4EA" },
  statusInactive: { backgroundColor: "#FCE8E6" },
  statusText: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: Colors.textPrimary },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  cardFooter: { gap: 4 },
  guardianLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  guardianValue: { color: Colors.textPrimary, fontWeight: "600" },
  medNotes: { fontSize: Fonts.sizes.xs, color: "#D93025", fontStyle: "italic" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl, padding: Spacing.xl },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySubtitle: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  modalTitle: { fontSize: Fonts.sizes.xl, fontWeight: "800", color: Colors.textPrimary },
  modalSubtitle: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
  },
  rowInputs: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  halfInput: { flex: 1, marginBottom: 0 },
  genderRow: { flexDirection: "row", gap: Spacing.xs },
  genderBtn: {
    flex: 1,
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  genderBtnActive: { backgroundColor: Colors.primary },
  genderText: { fontWeight: "700", color: Colors.textSecondary },
  genderTextActive: { color: Colors.textLight },
  fieldLabel: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  sportPills: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  sportPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
  },
  sportPillActive: { backgroundColor: Colors.primaryLight },
  sportPillText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, fontWeight: "600" },
  sportPillTextActive: { color: Colors.textLight },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.md, marginTop: Spacing.md },
  cancelBtn: { padding: Spacing.md },
  cancelText: { color: Colors.textSecondary, fontWeight: "600" },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  submitText: { color: Colors.textLight, fontWeight: "700" },
});
