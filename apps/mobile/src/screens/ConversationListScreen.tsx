import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ConversationListItem } from "../components/ConversationListItem";
import { NewConversationModal } from "../components/NewConversationModal";
import { Colors, Fonts, Spacing } from "../theme/tokens";
import { MOCK_CONVERSATIONS, MOCK_CURRENT_USER } from "../data/mockData";
import { getConversations, createConversation } from "../api/client";
import type { Conversation } from "@chatbot/shared-types";

type Props = NativeStackScreenProps<RootStackParamList, "ConversationList">;

export function ConversationListScreen({ navigation }: Props) {
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewChatModalVisible, setIsNewChatModalVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getConversations(MOCK_CURRENT_USER.id);
        if (mounted && data.length > 0) setConversations(data);
      } catch {
        // Fall back to mock data if server isn't running yet
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleCreateNewConversation = async (name: string, kind: "ai" | "direct" | "group") => {
    try {
      const newConv = await createConversation({
        name,
        creatorId: MOCK_CURRENT_USER.id,
        kind,
        tenantId: MOCK_CURRENT_USER.tenantId,
      });

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === newConv.id);
        if (exists) return prev;
        return [newConv, ...prev];
      });

      navigation.navigate("Chat", {
        conversationId: newConv.id,
        conversationName: newConv.name ?? name,
      });
    } catch (err) {
      console.error("[handleCreateNewConversation] Error:", err);
    }
  };

  const filtered = conversations.filter((c) =>
    (c.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: Conversation }) => (
    <ConversationListItem
      conversation={item}
      currentUserId={MOCK_CURRENT_USER.id}
      unreadCount={item.id === "seed-conv-001" ? 0 : 2}
      onPress={() =>
        navigation.navigate("Chat", {
          conversationId: item.id,
          conversationName: item.name ?? "Chat",
        })
      }
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No conversations found</Text>
          </View>
        }
      />

      {/* FAB — New Conversation */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setIsNewChatModalVisible(true)}
      >
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>

      {/* New Conversation Modal */}
      <NewConversationModal
        visible={isNewChatModalVisible}
        onClose={() => setIsNewChatModalVisible(false)}
        onCreate={handleCreateNewConversation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.listBackground,
  },
  searchContainer: {
    backgroundColor: Colors.headerBackground,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.textLight,
    padding: 0,
  },
  list: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 22,
  },
});
