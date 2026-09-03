import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Linking,
  Platform,
} from "react-native";
import type { Message } from "@chatbot/shared-types";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { AudioPlayer } from "./AudioPlayer";
import { formatFileSize } from "../utils/filePicker";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean; // true = sent by current user (right side)
  showAvatar?: boolean; // show sender avatar on left
  senderName?: string;
}

function StatusTick({ status }: { status: Message["status"] }) {
  if (status === "sending") return <Text style={styles.tick}>🕐</Text>;
  if (status === "sent") return <Text style={[styles.tick, { color: Colors.tickSent }]}>✓</Text>;
  if (status === "delivered") return <Text style={[styles.tick, { color: Colors.tickSent }]}>✓✓</Text>;
  if (status === "read") return <Text style={[styles.tick, { color: Colors.tickRead }]}>✓✓</Text>;
  return null;
}

function getDocumentIcon(fileName?: string, mimeType?: string): string {
  const name = (fileName || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "📕";
  if (name.endsWith(".doc") || name.endsWith(".docx") || mime.includes("word")) return "📘";
  if (name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".csv") || mime.includes("sheet")) return "📗";
  if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".tar")) return "📦";
  return "📄";
}

export function ChatBubble({ message, isOwn, showAvatar, senderName }: ChatBubbleProps) {
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const isBot = message.sender?.role === "bot";
  const bubbleBg = isOwn
    ? Colors.bubbleSent
    : isBot
    ? Colors.bubbleAI
    : Colors.bubbleReceived;

  const time = dayjs(message.createdAt).format("h:mm A");

  const openDocument = () => {
    if (message.mediaUrl) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(message.mediaUrl, "_blank");
      } else {
        Linking.openURL(message.mediaUrl).catch(() => {});
      }
    }
  };

  const isMedia = message.kind === "image" || message.kind === "audio" || message.kind === "document";

  return (
    <View style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft]}>
      {/* Bubble */}
      <View
        style={[
          styles.bubble,
          { backgroundColor: bubbleBg },
          isOwn ? styles.bubbleRight : styles.bubbleLeft,
          message.kind === "tool_result" && styles.bubbleTool,
          message.kind === "image" && styles.bubbleImage,
        ]}
      >
        {/* Sender name (in group / AI convos) */}
        {!isOwn && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        {/* ── IMAGE MESSAGE ──────────────────────────────────────────────── */}
        {message.kind === "image" && message.mediaUrl && (
          <View style={styles.imageContainer}>
            <TouchableOpacity
              onPress={() => setLightboxVisible(true)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: message.mediaUrl }}
                style={styles.imageThumbnail}
                resizeMode="cover"
              />
            </TouchableOpacity>

            {/* Lightbox Modal */}
            <Modal
              visible={lightboxVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setLightboxVisible(false)}
            >
              <TouchableOpacity
                style={styles.lightboxBackdrop}
                activeOpacity={1}
                onPress={() => setLightboxVisible(false)}
              >
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setLightboxVisible(false)}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
                <Image
                  source={{ uri: message.mediaUrl }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </Modal>
          </View>
        )}

        {/* ── AUDIO MESSAGE ──────────────────────────────────────────────── */}
        {message.kind === "audio" && (
          <AudioPlayer
            url={message.mediaUrl}
            duration={message.duration}
            isOwn={isOwn}
          />
        )}

        {/* ── DOCUMENT MESSAGE ───────────────────────────────────────────── */}
        {message.kind === "document" && (
          <TouchableOpacity
            style={styles.docCard}
            onPress={openDocument}
            activeOpacity={0.8}
          >
            <View style={styles.docIconContainer}>
              <Text style={styles.docIcon}>
                {getDocumentIcon(message.fileName, message.mimeType)}
              </Text>
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docName} numberOfLines={1} ellipsizeMode="middle">
                {message.fileName || message.body || "Document"}
              </Text>
              <Text style={styles.docMeta}>
                {message.fileSize ? formatFileSize(message.fileSize) : "Document"}
                {" • Click to view"}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── TEXT / CAPTION BODY ───────────────────────────────────────── */}
        {Boolean(message.body) &&
          (message.kind !== "document" || (message.body !== message.fileName && !message.body.startsWith("Voice message"))) &&
          (message.kind !== "image" || message.body !== "Photo") && (
            <Text
              style={[
                styles.bodyText,
                message.kind === "system" && styles.systemText,
                isMedia && styles.mediaCaptionText,
              ]}
            >
              {message.body}
            </Text>
          )}

        {/* Footer: time + read receipt */}
        <View style={styles.footer}>
          <Text style={styles.timeText}>{time}</Text>
          {isOwn && <StatusTick status={message.status} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 2,
    paddingHorizontal: Spacing.sm,
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  bubbleLeft: {
    borderRadius: Radius.bubble,
    borderTopLeftRadius: 2, // WhatsApp-style pointed corner
  },
  bubbleRight: {
    borderRadius: Radius.bubble,
    borderTopRightRadius: 2,
  },
  bubbleTool: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  bubbleImage: {
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  senderName: {
    fontSize: Fonts.sizes.sm,
    fontWeight: "600",
    color: Colors.primaryLight,
    marginBottom: 2,
  },
  bodyText: {
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  mediaCaptionText: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  systemText: {
    color: Colors.textSecondary,
    fontStyle: "italic",
    fontSize: Fonts.sizes.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
  },
  tick: {
    fontSize: 11,
  },

  // Image styles
  imageContainer: {
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  imageThumbnail: {
    width: 240,
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: "#E0E0E0",
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImage: {
    width: "90%",
    height: "80%",
  },
  closeBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },

  // Document styles
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 200,
    maxWidth: 260,
    gap: Spacing.sm,
  },
  docIconContainer: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  docIcon: {
    fontSize: 22,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: Fonts.sizes.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  docMeta: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
