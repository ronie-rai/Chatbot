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
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import {
  createBooking,
  fetchBookings,
  fetchFacilities,
  type AcademyBooking,
  type AcademyFacility,
} from "../api";

export function BookingsScreen() {
  const [facilities, setFacilities] = useState<AcademyFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [bookings, setBookings] = useState<AcademyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Booking modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [bookedBy, setBookedBy] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [startHour, setStartHour] = useState("16");
  const [endHour, setEndHour] = useState("18");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const facs = await fetchFacilities();
      setFacilities(facs);
      const activeFacId = selectedFacilityId || (facs.length > 0 ? facs[0].id : "");
      if (activeFacId) {
        setSelectedFacilityId(activeFacId);
        const bks = await fetchBookings(activeFacId);
        setBookings(bks);
      }
    } catch {
      // Handled in api.ts
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
      setBookings(bks);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!title.trim() || !bookedBy.trim()) {
      Alert.alert("Missing Fields", "Booking title and customer name are required.");
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

    setSubmitting(true);
    try {
      const res = await createBooking({
        facilityId: selectedFacilityId,
        title: title.trim(),
        bookedBy: bookedBy.trim(),
        contactPhone: contactPhone.trim() || undefined,
        startTime,
        endTime,
        totalAmountCents: (eH - sH) * 80000, // ₹800/hr
      });

      if (!res.ok || !res.booking) {
        Alert.alert(
          "Slot Conflict",
          res.error || "The selected time slot overlaps with another reservation. Please choose another slot."
        );
        return;
      }

      Alert.alert("Booking Confirmed", `Reserved "${title}" from ${sH}:00 to ${eH}:00.`);
      setIsModalVisible(false);
      setTitle("");
      setBookedBy("");
      setContactPhone("");
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
            <Text style={styles.bookedByText}>
              👤 {item.bookedBy} {item.contactPhone ? `(${item.contactPhone})` : ""}
            </Text>
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

      {/* New Booking Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Book Court / Facility</Text>
            <Text style={styles.modalSubtitle}>
              Strict overlap protection prevents double bookings in real time.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Session Title (e.g. Friendly Match, Coaching) *"
              placeholderTextColor={Colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.input}
              placeholder="Customer / Team Name *"
              placeholderTextColor={Colors.textSecondary}
              value={bookedBy}
              onChangeText={setBookedBy}
            />

            <TextInput
              style={styles.input}
              placeholder="Contact Phone (Optional)"
              placeholderTextColor={Colors.textSecondary}
              value={contactPhone}
              keyboardType="phone-pad"
              onChangeText={setContactPhone}
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
        </View>
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
});
