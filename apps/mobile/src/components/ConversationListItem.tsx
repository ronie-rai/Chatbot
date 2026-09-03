import React from "react";
import { View, Text, StyleSheet, TouchableHighlight } from "react-native";
import type { Conversation } from "@chatbot/shared-types";
import { Colors, Fonts, Spacing } from "../theme/tokens";
import { Avatar } from "./Avatar";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface ConversationListItemProps {
  conversation: Conversation;
  currentUserId: string;
  unreadCount?: number;
  onPress: () => void;
}

export function ConversationListItem({
  conversation,
  currentUserId,
  unreadCount = 0,
  onPress,
}: ConversationListItemProps) {
  const { name, lastMessage, participants } = conversation;

  // Determine display name: for DMs, show the other person's name
  const displayName =
    name ?? participants?.find((p) => p.userId !== currentUserId)?.user?.name ?? "Chat";

  const isBot = participants?.some((p) => p.user?.role === "bot") ?? false;

  // Format time
  const timeStr = lastMessage?.createdAt
    ? dayjs(lastMessage.createdAt).format("h:mm A")
    : "";

  // Last message preview
  const preview = lastMessage?.body
    ? lastMessage.body.replace(/\n/g, " ").slice(0, 60) + (lastMessage.body.length > 60 ? "…" : "")
    : "No messages yet";

  const isOwnLastMsg = lastMessage?.senderId === currentUserId;

  return (
    <TouchableHighlight
      underlayColor={Colors.border}
      onPress={onPress}
      style={styles.touchable}
    >
      <View style={styles.row}>
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <Avatar name={displayName} size={50} isBot={isBot} />
          {isBot && <View style={styles.onlineIndicator} />}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.time, unreadCount > 0 && styles.timeUnread]}>{timeStr}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text
              style={[styles.preview, unreadCount > 0 && styles.previewUnread]}
              numberOfLines={1}
            >
              {isOwnLastMsg ? "You: " : ""}{preview}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableHighlight>
  );
}

const styles = StyleSheet.create({
  touchable: {
    backgroundColor: Colors.listBackground,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: Spacing.md,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.listBackground,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  name: {
    fontSize: Fonts.sizes.lg,
    fontWeight: "600",
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  time: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
  },
  timeUnread: {
    color: Colors.accent,
    fontWeight: "600",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preview: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  previewUnread: {
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  badge: {
    backgroundColor: Colors.unreadBadge,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: Colors.textLight,
    fontSize: Fonts.sizes.xs,
    fontWeight: "700",
  },
});
