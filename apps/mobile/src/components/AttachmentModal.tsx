import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import type { FilePickerType } from "../utils/filePicker";

interface AttachmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: FilePickerType) => void;
}

export function AttachmentModal({ visible, onClose, onSelect }: AttachmentModalProps) {
  const options = [
    {
      type: "document" as FilePickerType,
      title: "Document",
      icon: "📄",
      bgColor: "#5157D0",
    },
    {
      type: "image" as FilePickerType,
      title: "Photos & Media",
      icon: "🖼️",
      bgColor: "#AC44CF",
    },
    {
      type: "audio" as FilePickerType,
      title: "Audio File",
      icon: "🎵",
      bgColor: "#E47A22",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Share Content</Text>
              <View style={styles.grid}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.type}
                    style={styles.item}
                    onPress={() => {
                      onClose();
                      onSelect(opt.type);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: opt.bgColor }]}>
                      <Text style={styles.iconText}>{opt.icon}</Text>
                    </View>
                    <Text style={styles.itemLabel}>{opt.title}</Text>
                  </TouchableOpacity>
                ))}
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.screenBackground,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  sheetTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  item: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  iconText: {
    fontSize: 26,
  },
  itemLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
});
