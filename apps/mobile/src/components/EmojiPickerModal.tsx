import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";

interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉",
  "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
  "🔥", "✨", "🌟", "💫", "💥", "🎉", "🎊", "🚀", "💡", "⚡",
  "💯", "✅", "❌", "⚠️", "📞", "💬", "📦", "🛠️", "📋", "📅",
];

export function EmojiPickerModal({
  visible,
  onClose,
  onSelectEmoji,
}: EmojiPickerModalProps) {
  if (!visible) return null;

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
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>Emojis</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
              >
                {EMOJI_LIST.map((emoji, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.emojiBtn}
                    onPress={() => onSelectEmoji(emoji)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    maxHeight: 280,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Fonts.sizes.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  emojiBtn: {
    width: "10%",
    minWidth: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 22,
  },
});
