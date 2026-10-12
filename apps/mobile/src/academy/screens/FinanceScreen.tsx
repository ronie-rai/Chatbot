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
  fetchInvoices,
  recordPayment,
  type AcademyInvoice,
} from "../api";

export function FinanceScreen() {
  const [invoices, setInvoices] = useState<AcademyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  // Payment modal state
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<AcademyInvoice | null>(null);
  const [amountRupees, setAmountRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const invs = await fetchInvoices();
      setInvoices(invs || []);
    } catch {
      setInvoices([]);
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

  const openPaymentModal = (invoice?: AcademyInvoice) => {
    if (invoice) {
      setSelectedInvoice(invoice);
      setAmountRupees(((invoice.balanceCents || 0) / 100).toString());
    } else {
      setSelectedInvoice(null);
      setAmountRupees("");
    }
    setReference("");
    setIsPaymentModalVisible(true);
  };

  const handleRecordPayment = async () => {
    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }

    const playerId = selectedInvoice?.playerId || (invoices && invoices[0]?.playerId);
    if (!playerId) {
      Alert.alert("Error", "No player selected for payment allocation.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await recordPayment({
        playerId,
        amountCents: Math.round(rupees * 100),
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: selectedInvoice ? `Allocated to ${selectedInvoice.invoiceNumber}` : "Direct counter payment",
      });

      if (!res.ok || !res.receiptNumber) {
        Alert.alert("Failed", res.error || "Payment recording failed");
        return;
      }

      Alert.alert(
        "Payment Recorded",
        `Receipt No: ${res.receiptNumber}\nAmount: ₹${rupees.toFixed(2)} (${paymentMethod})`
      );
      setIsPaymentModalVisible(false);
      void loadData();
    } catch {
      Alert.alert("Error", "Network error recording payment");
    } finally {
      setSubmitting(false);
    }
  };

  const totalOutstanding = (invoices || []).reduce((acc, inv) => acc + (inv.balanceCents || 0), 0) / 100;

  const filteredInvoices = (invoices || []).filter((inv) => {
    if (!inv) return false;
    if (filter === "ALL") return true;
    if (filter === "PENDING") return (inv.balanceCents || 0) > 0;
    if (filter === "PAID") return (inv.balanceCents || 0) === 0;
    return true;
  });

  const renderInvoice = ({ item }: { item: AcademyInvoice }) => {
    const isSettled = (item.balanceCents || 0) === 0;
    const playerName = item.player?.fullName || (item.player as any)?.name || "Player";
    const playerCode = item.player?.playerCode || "OFA-*";
    const totalAmount = ((item.totalAmountCents || 0) / 100).toLocaleString("en-IN");
    const paidAmount = ((item.paidAmountCents || 0) / 100).toLocaleString("en-IN");
    const balance = ((item.balanceCents || 0) / 100).toLocaleString("en-IN");
    const dueDateStr = item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "N/A";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.invoiceNum}>{item.invoiceNumber || "INV-*"}</Text>
            <Text style={styles.playerName}>
              {playerName} ({playerCode})
            </Text>
          </View>
          <View
            style={[
              styles.statusTag,
              isSettled ? styles.statusPaid : styles.statusUnpaid,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isSettled ? styles.statusPaidText : styles.statusUnpaidText,
              ]}
            >
              {isSettled ? "PAID" : `DUE ₹${balance}`}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardDetails}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Total Bill</Text>
            <Text style={styles.amountVal}>₹{totalAmount}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Paid So Far</Text>
            <Text style={styles.amountVal}>₹{paidAmount}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Due Date</Text>
            <Text style={styles.amountVal}>{dueDateStr}</Text>
          </View>
        </View>

        {!isSettled && (
          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={() => openPaymentModal(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.payNowText}>Collect ₹{balance}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Outstanding Summary Banner */}
      <View style={styles.banner}>
        <View>
          <Text style={styles.bannerTitle}>Total Outstanding</Text>
          <Text style={styles.bannerAmount}>₹{totalOutstanding.toLocaleString("en-IN")}</Text>
        </View>
        <TouchableOpacity
          style={styles.quickPayBtn}
          onPress={() => openPaymentModal()}
          activeOpacity={0.8}
        >
          <Text style={styles.quickPayText}>+ Collect Fee</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {["ALL", "PENDING", "PAID"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tabChip, filter === f && styles.tabChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.tabChipText,
                filter === f && styles.tabChipTextActive,
              ]}
            >
              {f}
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
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoice}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No invoices found</Text>
              <Text style={styles.emptySubtitle}>
                All fees are settled or no invoices have been generated yet.
              </Text>
            </View>
          }
        />
      )}

      {/* Payment Collection Modal */}
      <Modal visible={isPaymentModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Collect Fee Payment</Text>
            <Text style={styles.modalSubtitle}>
              {selectedInvoice
                ? `Paying towards Invoice #${selectedInvoice.invoiceNumber}`
                : "FIFO automatic invoice clearance applies."}
            </Text>

            <Text style={styles.fieldLabel}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5000"
              placeholderTextColor={Colors.textSecondary}
              value={amountRupees}
              keyboardType="numeric"
              onChangeText={setAmountRupees}
            />

            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <View style={styles.methodRow}>
              {["UPI", "CASH", "CARD", "BANK_TRANSFER"].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodBtn,
                    paymentMethod === m && styles.methodBtnActive,
                  ]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text
                    style={[
                      styles.methodText,
                      paymentMethod === m && styles.methodTextActive,
                    ]}
                  >
                    {m.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Reference / Transaction ID (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. UPI Ref / UTR / Cashier receipt"
              placeholderTextColor={Colors.textSecondary}
              value={reference}
              onChangeText={setReference}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsPaymentModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleRecordPayment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.textLight} size="small" />
                ) : (
                  <Text style={styles.submitText}>Confirm & Issue Receipt</Text>
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
  banner: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerTitle: { color: Colors.accentLight, fontSize: Fonts.sizes.sm, fontWeight: "600" },
  bannerAmount: { color: Colors.textLight, fontSize: Fonts.sizes.xxl, fontWeight: "800", marginTop: 2 },
  quickPayBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  quickPayText: { color: Colors.primary, fontWeight: "800", fontSize: Fonts.sizes.sm },
  tabsRow: {
    flexDirection: "row",
    padding: Spacing.md,
    backgroundColor: Colors.listBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  invoiceNum: { fontSize: Fonts.sizes.md, fontWeight: "700", color: Colors.textPrimary },
  playerName: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusPaid: { backgroundColor: "#E6F4EA" },
  statusUnpaid: { backgroundColor: "#FCE8E6" },
  statusText: { fontSize: Fonts.sizes.xs, fontWeight: "700" },
  statusPaidText: { color: "#137333" },
  statusUnpaidText: { color: "#C5221F" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  cardDetails: { flexDirection: "row", justifyContent: "space-between" },
  amountCol: { alignItems: "center" },
  amountLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  amountVal: { fontSize: Fonts.sizes.sm, fontWeight: "700", color: Colors.textPrimary, marginTop: 2 },
  payNowBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  payNowText: { color: Colors.textLight, fontWeight: "700", fontSize: Fonts.sizes.sm },
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
    marginBottom: Spacing.md,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  methodBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
  },
  methodBtnActive: { backgroundColor: Colors.primary },
  methodText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  methodTextActive: { color: Colors.textLight },
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
