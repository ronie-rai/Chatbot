import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import {
  fetchAnnouncements,
  markAnnouncementRead,
  type AcademyAnnouncement,
} from "../api";

export function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<AcademyAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const items = await fetchAnnouncements();
      setAnnouncements(items);
    } catch {
      // Handled in api.ts
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

  const handleMarkRead = async (id: string) => {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
    await markAnnouncementRead(id);
  };

  const renderItem = ({ item }: { item: AcademyAnnouncement }) => {
    const isUnread = !item.isRead;
    const isUrgent = item.priority === "URGENT";
    const isHigh = item.priority === "HIGH";

    return (
      <View style={[styles.card, isUnread && styles.unreadCard]}>
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.priorityBadge,
                isUrgent && styles.priorityUrgent,
                isHigh && styles.priorityHigh,
              ]}
            >
              <Text
                style={[
                  styles.priorityText,
                  (isUrgent || isHigh) && styles.priorityWhiteText,
                ]}
              >
                {item.priority}
              </Text>
            </View>
            <View style={styles.audienceBadge}>
              <Text style={styles.audienceText}>📢 {item.targetAudience}</Text>
            </View>
          </View>
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
          </Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>

        <View style={styles.footer}>
          <Text style={styles.author}>
            By: {item.authorName ?? "Academy Administration"}
          </Text>
          {isUnread ? (
            <TouchableOpacity
              style={styles.markBtn}
              onPress={() => void handleMarkRead(item.id)}
            >
              <Text style={styles.markText}>Mark Read</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.readIndicator}>✓ Read</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No announcements</Text>
              <Text style={styles.emptySubtitle}>
                You are all caught up on all academy circulars and updates.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  badgeRow: { flexDirection: "row", gap: Spacing.xs },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: "#E8F0FE",
  },
  priorityUrgent: { backgroundColor: "#EA4335" },
  priorityHigh: { backgroundColor: "#FBBC05" },
  priorityText: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: "#1967D2" },
  priorityWhiteText: { color: "#FFFFFF" },
  audienceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
  },
  audienceText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  dateText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  title: { fontSize: Fonts.sizes.md, fontWeight: "700", color: Colors.textPrimary, marginTop: Spacing.xs },
  body: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  author: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontStyle: "italic" },
  markBtn: {
    backgroundColor: Colors.screenBackground,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  markText: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: Colors.primary },
  readIndicator: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl, padding: Spacing.xl },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySubtitle: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.xs },
});
