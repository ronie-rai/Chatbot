import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import {
  createBooking,
  fetchBookings,
  fetchFacilities,
  fetchPlayers,
  type AcademyBooking,
  type AcademyFacility,
  type AcademyPlayer,
} from "../api";
import { ACADEMY_CONSUMABLES } from "../../screens/DashboardScreen";

export function BookingsScreen() {
  const [facilities, setFacilities] = useState<AcademyFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [bookings, setBookings] = useState<AcademyBooking[]>([]);
  const [players, setPlayers] = useState<AcademyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Booking modal state (Booking Title removed per Requirement 4)
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [bookedBy, setBookedBy] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [startHour, setStartHour] = useState("16");
  const [endHour, setEndHour] = useState("18");
  const [bookingConsumables, setBookingConsumables] = useState<Record<string, number>>({});
  const [phoneLookupNotice, setPhoneLookupNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [facs, plyData] = await Promise.all([
        fetchFacilities(),
        fetchPlayers().catch(() => ({ players: [] })),
      ]);
      const safeFacs = facs || [];
      setFacilities(safeFacs);
      if (plyData?.players) setPlayers(plyData.players);
      const activeFacId = selectedFacilityId || (safeFacs.length > 0 ? safeFacs[0].id : "");
      if (activeFacId) {
        setSelectedFacilityId(activeFacId);
        const bks = await fetchBookings(activeFacId);
        setBookings(bks || []);
      }
    } catch {
      setFacilities([]);
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleFacilityChange = async (facId: string) => {
    setSelectedFacilityId(facId);
    setLoading(true);
    try {
      const bks = await fetchBookings(facId);
      setBookings(bks || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Phone auto-lookup
  const handlePhoneChange = (val: string) => {
    setContactPhone(val);
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const match = players.find(
        (p) => (p.mobileNumber && p.mobileNumber.replace(/\D/g, "").includes(cleaned)) ||
               (p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(cleaned))
      );
      if (match) {
        setBookedBy(match.fullName);
        setPhoneLookupNotice(`✨ Auto-filled player: ${match.fullName}`);
        setTimeout(() => setPhoneLookupNotice(null), 3500);
      }
    }
  };

  const updateConsumableQty = (id: string, delta: number) => {
    setBookingConsumables((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const consumablesTotal = Object.entries(bookingConsumables).reduce((acc, [id, qty]) => {
    const item = ACADEMY_CONSUMABLES.find((c) => c.id === id);
    return acc + (item ? item.price * qty : 0);
  }, 0);

  const handleCreateBooking = async () => {
    if (!bookedBy.trim()) {
      Alert.alert("Missing Fields", "Customer / player name is required.");
      return;
    }

    const sH = parseInt(startHour, 10);
    const eH = parseInt(endHour, 10);
    if (isNaN(sH) || isNaN(eH) || sH >= eH || sH < 6 || eH > 23) {
      Alert.alert("Invalid Hours", "Start hour must be before end hour (between 06:00 and 23:00).");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const startTime = `${today}T${String(sH).padStart(2, "0")}:00:00Z`;
    const endTime = `${today}T${String(eH).padStart(2, "0")}:00:00Z`;

    const activeFac = facilities.find((f) => f.id === selectedFacilityId);
    const autoTitle = `${bookedBy.trim()} - ${activeFac?.name || "Court Session"}`;
    const courtCostCents = (eH - sH) * 80000; // ₹800/hr
    const consumablesCostCents = consumablesTotal * 100;

    setSubmitting(true);
    try {
      const res = await createBooking({
        facilityId: selectedFacilityId,
        title: autoTitle,
        bookedBy: bookedBy.trim(),
        contactPhone: contactPhone.trim() || undefined,
        startTime,
        endTime,
        totalAmountCents: courtCostCents + consumablesCostCents,
      });

      if (!res.ok || !res.booking) {
        Alert.alert(
          "Slot Conflict",
          res.error || "The selected time slot overlaps with another reservation. Please choose another slot."
        );
        return;
      }

      Alert.alert(
        "Booking Confirmed",
        `Reserved "${autoTitle}" from ${sH}:00 to ${eH}:00. Total: ₹${Math.round((courtCostCents + consumablesCostCents) / 100)}`
      );
      setIsModalVisible(false);
      setBookedBy("");
      setContactPhone("");
      setBookingConsumables({});
      void loadData();
    } catch {
      Alert.alert("Error", "Network error creating court booking");
    } finally {
      setSubmitting(false);
    }
  };

  const renderBookingCard = ({ item }: { item: AcademyBooking }) => {
    const sDate = new Date(item.startTime);
    const eDate = new Date(item.endTime);
    const timeFormatted = `${sDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${eDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              <Text style={styles.bookedByText}>👤 {item.bookedBy}</Text>
              {item.contactPhone ? (
                <TouchableOpacity
                  onPress={() => {
                    const cleaned = item.contactPhone!.replace(/[^\d+]/g, "");
                    if (cleaned) Linking.openURL(`tel:${cleaned}`).catch(() => {});
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(14, 165, 233, 0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(56, 189, 248, 0.4)",
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    gap: 3,
                  }}
                >
                  <Text style={{ fontSize: 10 }}>📞</Text>
                  <Text style={{ color: "#38BDF8", fontSize: 11, fontWeight: "700", textDecorationLine: "underline" }}>
                    {item.contactPhone}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <Text style={styles.timeText}>🕒 {timeFormatted}</Text>
          {item.totalAmountCents > 0 && (
            <Text style={styles.priceText}>₹{(item.totalAmountCents / 100).toLocaleString("en-IN")}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Facilities Tab Bar */}
      <View style={styles.facilityBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={facilities}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.facilityChip,
                selectedFacilityId === item.id && styles.facilityChipActive,
              ]}
              onPress={() => void handleFacilityChange(item.id)}
            >
              <Text
                style={[
                  styles.facilityChipText,
                  selectedFacilityId === item.id && styles.facilityChipTextActive,
                ]}
              >
                🏟️ {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.bookBtnText}>+ Book</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No bookings for this court</Text>
              <Text style={styles.emptySubtitle}>
                The facility is currently open. Tap "+ Book" to reserve a slot.
              </Text>
            </View>
          }
        />
      )}

      {/* New Booking Modal (Keyboard avoiding & with consumables) */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 10}
        >
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <Text style={styles.modalTitle}>Book Court / Facility</Text>
            <Text style={styles.modalSubtitle}>
              Strict overlap protection prevents double bookings in real time.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 460 }}
            >
              {phoneLookupNotice && (
                <View style={styles.phoneLookupBanner}>
                  <Text style={styles.phoneLookupBannerText}>{phoneLookupNotice}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Contact Mobile (Auto-Lookup)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210 (enter 10 digits to auto-fill name)"
                placeholderTextColor={Colors.textSecondary}
                value={contactPhone}
                keyboardType="phone-pad"
                onChangeText={handlePhoneChange}
              />

              <Text style={styles.fieldLabel}>Customer / Team Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Customer / Team Name *"
                placeholderTextColor={Colors.textSecondary}
                value={bookedBy}
                onChangeText={setBookedBy}
              />

              <Text style={styles.fieldLabel}>Time Slot (Hours in 24hr format)</Text>
              <View style={styles.hoursRow}>
                <View style={styles.hourCol}>
                  <Text style={styles.subLabel}>From (HH)</Text>
                  <TextInput
                    style={styles.hourInput}
                    value={startHour}
                    keyboardType="numeric"
                    onChangeText={setStartHour}
                    maxLength={2}
                  />
                </View>
                <Text style={styles.hourDash}>—</Text>
                <View style={styles.hourCol}>
                  <Text style={styles.subLabel}>To (HH)</Text>
                  <TextInput
                    style={styles.hourInput}
                    value={endHour}
                    keyboardType="numeric"
                    onChangeText={setEndHour}
                    maxLength={2}
                  />
                </View>
              </View>

              {/* Consumables Selection */}
              <View style={styles.consumablesSection}>
                <Text style={styles.consumablesSectionTitle}>
                  📦 Add Consumables & Equipment (Optional)
                </Text>
                <Text style={styles.consumablesSectionSub}>
                  Attach n consumables items against this reservation
                </Text>

                {ACADEMY_CONSUMABLES.map((item) => {
                  const qty = bookingConsumables[item.id] || 0;
                  return (
                    <View key={item.id} style={styles.consumableItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.consumableItemName}>{item.name}</Text>
                        <Text style={styles.consumableItemSub}>
                          ₹{item.price} / {item.unit} • {item.category}
                        </Text>
                      </View>
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateConsumableQty(item.id, -1)}
                          disabled={qty === 0}
                        >
                          <Text
                            style={[
                              styles.stepperBtnText,
                              qty === 0 && styles.stepperBtnDisabled,
                            ]}
                          >
                            -
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperQty}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateConsumableQty(item.id, 1)}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Price Breakdown */}
                <View style={styles.priceSummaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Court Rental (
                      {Math.max(
                        1,
                        (parseInt(endHour, 10) || 18) - (parseInt(startHour, 10) || 16)
                      )}
                      h):
                    </Text>
                    <Text style={styles.summaryValue}>
                      ₹
                      {Math.max(
                        1,
                        (parseInt(endHour, 10) || 18) - (parseInt(startHour, 10) || 16)
                      ) * 800}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Consumables (
                      {Object.values(bookingConsumables).reduce((a, b) => a + b, 0)}{" "}
                      items):
                    </Text>
                    <Text style={styles.summaryValue}>₹{consumablesTotal}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                    <Text style={styles.summaryTotalLabel}>Total Reservation:</Text>
                    <Text style={styles.summaryTotalValue}>
                      ₹
                      {Math.max(
                        1,
                        (parseInt(endHour, 10) || 18) - (parseInt(startHour, 10) || 16)
                      ) *
                        800 +
                        consumablesTotal}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateBooking}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.textLight} size="small" />
                ) : (
                  <Text style={styles.submitText}>Confirm Reservation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  facilityBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: Colors.listBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  facilityChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
    marginRight: Spacing.xs,
  },
  facilityChipActive: { backgroundColor: Colors.primary },
  facilityChipText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  facilityChipTextActive: { color: Colors.textLight },
  bookBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    marginLeft: Spacing.sm,
  },
  bookBtnText: { color: Colors.textLight, fontWeight: "700", fontSize: Fonts.sizes.sm },
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
  cardTitle: { fontSize: Fonts.sizes.md, fontWeight: "700", color: Colors.textPrimary },
  bookedByText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4 },
  statusBadge: { backgroundColor: "#E6F4EA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: "#137333" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timeText: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary, fontWeight: "600" },
  priceText: { fontSize: Fonts.sizes.sm, fontWeight: "700", color: Colors.primary },
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
  fieldLabel: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
  },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  hourCol: { flex: 1 },
  subLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginBottom: 2 },
  hourInput: {
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    padding: Spacing.md,
    textAlign: "center",
    fontSize: Fonts.sizes.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  hourDash: { fontSize: Fonts.sizes.xl, color: Colors.textSecondary, marginTop: 14 },
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl, padding: Spacing.xl },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySubtitle: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.xs },
  phoneLookupBanner: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  phoneLookupBannerText: { color: "#60A5FA", fontSize: 12, fontWeight: "700" },
  consumablesSection: {
    backgroundColor: Colors.screenBackground,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  consumablesSectionTitle: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary },
  consumablesSectionSub: { fontSize: 11, color: Colors.textSecondary, marginBottom: 8 },
  consumableItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  consumableItemName: { fontSize: 12, fontWeight: "700", color: Colors.textPrimary },
  consumableItemSub: { fontSize: 11, color: Colors.textSecondary },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.listBackground,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  stepperBtnDisabled: { color: Colors.textSecondary },
  stepperQty: { fontSize: 12, fontWeight: "800", color: Colors.textPrimary, minWidth: 18, textAlign: "center" },
  priceSummaryBox: {
    backgroundColor: Colors.listBackground,
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary },
  summaryValue: { fontSize: 11, fontWeight: "600", color: Colors.textPrimary },
  summaryTotalRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 0,
  },
  summaryTotalLabel: { fontSize: 12, fontWeight: "800", color: Colors.textPrimary },
  summaryTotalValue: { fontSize: 13, fontWeight: "900", color: Colors.primary },
});
