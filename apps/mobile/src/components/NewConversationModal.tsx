import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";

interface NewConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, kind: "ai" | "direct" | "group") => Promise<void>;
}

export function NewConversationModal({
  visible,
  onClose,
  onCreate,
}: NewConversationModalProps) {
  const [chatName, setChatName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presets = [
    { title: "AI Assistant", kind: "ai" as const, icon: "🤖", desc: "Instant AI assistance" },
    { title: "Sales & Product Enquiry", kind: "ai" as const, icon: "💼", desc: "Quotes & sales queries" },
    { title: "Customer Support", kind: "ai" as const, icon: "🛠️", desc: "Technical support & bookings" },
  ];

  const handleStartPreset = async (presetName: string, kind: "ai" | "direct" | "group") => {
    setIsSubmitting(true);
    try {
      await onCreate(presetName, kind);
      setChatName("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCustom = async () => {
    const trimmed = chatName.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await onCreate(trimmed, "ai");
      setChatName("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>New Conversation</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Presets */}
              <Text style={styles.sectionLabel}>Quick Start</Text>
              <View style={styles.presetsList}>
                {presets.map((p, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.presetItem}
                    onPress={() => handleStartPreset(p.title, p.kind)}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetIconContainer}>
                      <Text style={styles.presetIcon}>{p.icon}</Text>
                    </View>
                    <View style={styles.presetTextContainer}>
                      <Text style={styles.presetTitle}>{p.title}</Text>
                      <Text style={styles.presetDesc}>{p.desc}</Text>
                    </View>
                    <Text style={styles.presetArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Topic Input */}
              <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>Or Custom Topic</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Order #1042 or General Question"
                  placeholderTextColor={Colors.textSecondary}
                  value={chatName}
                  onChangeText={setChatName}
                  onSubmitEditing={handleCreateCustom}
                  returnKeyType="go"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  style={[styles.startBtn, !chatName.trim() && styles.startBtnDisabled]}
                  onPress={handleCreateCustom}
                  disabled={!chatName.trim() || isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.textLight} />
                  ) : (
                    <Text style={styles.startBtnText}>Start</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.screenBackground,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: {
    fontSize: Fonts.sizes.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  presetsList: {
    gap: Spacing.xs,
  },
  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.listBackground,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.md,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  presetIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(7, 94, 84, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  presetIcon: {
    fontSize: 20,
  },
  presetTextContainer: {
    flex: 1,
  },
  presetTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  presetDesc: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  presetArrow: {
    fontSize: 22,
    color: Colors.iconGrey,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  startBtn: {
    height: 46,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnDisabled: {
    backgroundColor: Colors.iconGrey,
    opacity: 0.6,
  },
  startBtnText: {
    color: Colors.textLight,
    fontWeight: "600",
    fontSize: Fonts.sizes.md,
  },
});
