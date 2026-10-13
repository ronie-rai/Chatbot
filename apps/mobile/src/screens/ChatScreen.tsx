import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Text,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ChatBubble } from "../components/ChatBubble";
import { TypingDots } from "../components/TypingDots";
import { AttachmentModal } from "../components/AttachmentModal";
import { EmojiPickerModal } from "../components/EmojiPickerModal";
import { PaperclipIcon, SmileyIcon, MicIcon, SendIcon, TrashIcon } from "../components/Icons";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { MOCK_CURRENT_USER, MOCK_BOT_USER, MOCK_MESSAGES } from "../data/mockData";
import { showNewMessageNotification } from "../services/notifications";
import {
  getMessages,
  sendMessage,
  markMessageRead,
  uploadMediaFile,
  type SendMessageOptions,
} from "../api/client";
import {
  fetchPlayers,
  fetchBookings,
  fetchInvoices,
  fetchBatches,
  fetchSports,
  fetchFacilities,
  MOCK_PLAYERS,
  MOCK_BOOKINGS,
  MOCK_INVOICES,
} from "../academy/api";
import { ACADEMY_CONSUMABLES } from "./DashboardScreen";
import { useSocket } from "../hooks/useSocket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { pickFile, formatDuration, type FilePickerType } from "../utils/filePicker";
import type { Message, MessageStatus } from "@chatbot/shared-types";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const listRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isRecording,
    duration: recordingDuration,
    error: recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  // Show recording errors if any
  useEffect(() => {
    if (recordingError) {
      Alert.alert("Microphone Notice", recordingError);
    }
  }, [recordingError]);

  // Set up header with prominent dashboard link and single assistant title
  useEffect(() => {
    navigation.setOptions({
      headerTitle: "OFA Assistant",
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerDashboardBtn}
          onPress={() => navigation.navigate("Dashboard")}
          activeOpacity={0.8}
        >
          <Text style={styles.headerDashboardBtnText}>📊 Dashboard</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // ── Last message timestamp for offline catch-up ──────────────────────────
  const lastMessageAt = messages.length > 0
    ? messages[messages.length - 1].createdAt
    : undefined;

  // ── Load initial messages ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getMessages(conversationId);
        if (mounted) { setMessages(data); scrollToBottom(); }
      } catch {
        if (mounted) setMessages(MOCK_MESSAGES);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [conversationId]);

  // ── Auto-mark last bot message as read ───────────────────────────────────
  useEffect(() => {
    const lastBotMsg = [...messages].reverse()
      .find((m) => m.senderId !== MOCK_CURRENT_USER.id && m.status === "sent");
    if (lastBotMsg) {
      markMessageRead(conversationId, lastBotMsg.id);
    }
  }, [messages]);

  // ── OFA Assistant Read-Only Table Query & Mutation Protection ───────────
  const queryOFATables = useCallback(async (userQuery: string): Promise<{ isHandled: boolean; reply: string }> => {
    const lower = userQuery.toLowerCase().trim();

    // 1. Mutation attempt detection - OFA Assistant is strictly read-only
    const isMutation = /\b(add|create|insert|new|book|booking|admit|admission|delete|remove|cancel|drop|modify|update|edit|change)\b/i.test(lower)
      && !/\b(show|list|view|display|fetch|get|check|how many|status|details|info|tell me|who)\b/i.test(lower);

    const isExplicitMutation = /\b(delete booking|cancel booking|drop player|remove player|update fee|edit player|add player|admit player|book slot|book court|create booking)\b/i.test(lower);

    if (isExplicitMutation || (isMutation && /\b(player|court|slot|booking|admission|fee|invoice|consumable)\b/i.test(lower))) {
      return {
        isHandled: true,
        reply: "🔒 **Read-Only Access:** As OFA Assistant, I have read-only access to all academy tables and cannot create, modify, or delete any records.\n\n👉 To add or modify records, please use the direct action buttons on the left navigation tabs: **'+ New Booking'**, **'+ Admit Player'**, or **'+ Pay Fee'**.",
      };
    }

    // 2. Phone number lookup (10 digits anywhere in query)
    const phoneMatch = userQuery.match(/\b\d{10}\b/);
    if (phoneMatch) {
      const phone = phoneMatch[0];
      let players: any[] = MOCK_PLAYERS;
      let bookings: any[] = MOCK_BOOKINGS;
      try {
        const pRes = await fetchPlayers();
        if (pRes && pRes.players && pRes.players.length > 0) players = pRes.players;
        const b = await fetchBookings();
        if (b && b.length > 0) bookings = b;
      } catch {
        // use fallbacks
      }

      const matchedPlayer = players.find(
        (p: any) =>
          (p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(phone)) ||
          (p.mobile && p.mobile.replace(/\D/g, "").includes(phone)) ||
          (p.contactPhone && p.contactPhone.replace(/\D/g, "").includes(phone))
      );
      const matchedBookings = bookings.filter(
        (b: any) =>
          (b.contactPhone && b.contactPhone.replace(/\D/g, "").includes(phone)) ||
          (b.phone && b.phone.replace(/\D/g, "").includes(phone)) ||
          (b.bookedBy && b.bookedBy.toLowerCase().includes(phone))
      );

      if (matchedPlayer || matchedBookings.length > 0) {
        let text = `🔍 **Search Results for Phone: ${phone}**\n\n`;
        if (matchedPlayer) {
          const playerName = matchedPlayer.fullName || `${matchedPlayer.firstName || ""} ${matchedPlayer.lastName || ""}`.trim() || "Player";
          const sportName = matchedPlayer.primarySport?.name || (matchedPlayer.sports ? matchedPlayer.sports.map((s: any) => s.name).join(", ") : "General");
          text += `👤 **Player Profile:**\n`;
          text += `• **Name:** ${playerName}\n`;
          text += `• **Player Code:** ${matchedPlayer.playerCode || "N/A"}\n`;
          text += `• **Status:** ${matchedPlayer.status || "ACTIVE"}\n`;
          text += `• **Sport:** ${sportName}\n`;
          text += `• **Venue:** ${matchedPlayer.venue || "OFA-1"}\n`;
          text += `• **Phone / Guardian:** ${matchedPlayer.guardianPhone || matchedPlayer.mobile || "N/A"}\n`;
          if (matchedPlayer.guardianName) text += `• **Guardian Name:** ${matchedPlayer.guardianName}\n`;
          text += `\n`;
        }
        if (matchedBookings.length > 0) {
          text += `📅 **Associated Bookings (${matchedBookings.length}):**\n`;
          matchedBookings.forEach((b: any, i: number) => {
            const fac = b.facility?.name || b.facilityName || b.title || "Court Slot";
            const amount = b.totalAmount || (b.totalAmountCents ? b.totalAmountCents / 100 : 0);
            text += `${i + 1}. **${fac}** on ${b.bookingDate || b.startTime?.slice(0, 10)} — ₹${amount} [${b.status || b.paymentStatus || "CONFIRMED"}]\n`;
          });
        }
        return { isHandled: true, reply: text };
      } else {
        return {
          isHandled: true,
          reply: `🔍 No records found in Players or Bookings matching phone number **${phone}**.`,
        };
      }
    }

    // 3. Consumables table
    if (lower.includes("consumable") || lower.includes("inventory") || lower.includes("item price") || lower.includes("equipment price") || lower.includes("shuttle") || lower.includes("grip")) {
      let text = `🏸 **OFA Consumables & Inventory Table** (${ACADEMY_CONSUMABLES.length} items):\n\n`;
      text += `| # | Item Name | Category | Rate | Unit |\n`;
      text += `|---|---|---|---|---|\n`;
      ACADEMY_CONSUMABLES.forEach((item, i) => {
        text += `| ${i + 1} | **${item.name}** | ${item.category} | **₹${item.price}** | per ${item.unit} |\n`;
      });
      text += `\n💡 _Consumables can be added to any slot booking with live price calculation via '+ New Booking' on the left navigation tabs._`;
      return { isHandled: true, reply: text };
    }

    // 4. Players / Admissions table
    if (lower.includes("player") || lower.includes("admission") || lower.includes("student") || lower.includes("trainee") || lower.includes("enrolled")) {
      let playerList: any[] = MOCK_PLAYERS;
      try {
        const pRes = await fetchPlayers();
        if (pRes && pRes.players && pRes.players.length > 0) playerList = pRes.players;
      } catch {
        // fallback
      }

      let text = `👥 **OFA Players Table** (Total: ${playerList.length} players enrolled):\n\n`;
      playerList.slice(0, 10).forEach((p: any, i: number) => {
        const sportName = p.primarySport?.name || (p.sports ? p.sports.map((s: any) => s.name).join(", ") : "General");
        const name = p.fullName || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Player";
        const phone = p.guardianPhone || p.mobile || "N/A";
        text += `${i + 1}. **${name}** [${p.status || "ACTIVE"}]\n`;
        text += `   • Sport: ${sportName} | Code: ${p.playerCode || "N/A"}\n`;
        text += `   • Phone: ${phone}\n`;
      });
      if (playerList.length > 10) {
        text += `\n_...and ${playerList.length - 10} more players in the directory._\n`;
      }
      return { isHandled: true, reply: text };
    }

    // 5. Bookings / Slots table
    if (lower.includes("booking") || lower.includes("slot") || lower.includes("court") || lower.includes("reservation")) {
      let bookings = MOCK_BOOKINGS;
      try {
        const b = await fetchBookings();
        if (b.length > 0) bookings = b;
      } catch {
        // fallback
      }

      let text = `📅 **OFA Slot Bookings Table** (Total: ${bookings.length} bookings):\n\n`;
      bookings.slice(0, 8).forEach((b: any, i: number) => {
        text += `${i + 1}. **${b.facilityName || b.title}**\n`;
        text += `   • Date: ${b.bookingDate} | Time: ${b.startTime} - ${b.endTime}\n`;
        text += `   • Booked By: ${b.bookedBy} (${b.phone || "N/A"})\n`;
        text += `   • Amount: ₹${b.totalAmount} | Status: ${b.paymentStatus}\n`;
      });
      if (bookings.length > 8) {
        text += `\n_...and ${bookings.length - 8} more bookings recorded._\n`;
      }
      return { isHandled: true, reply: text };
    }

    // 6. Invoices / Payments / Fees table
    if (lower.includes("invoice") || lower.includes("payment") || lower.includes("fee") || lower.includes("revenue") || lower.includes("paid")) {
      let invoices = MOCK_INVOICES;
      try {
        const inv = await fetchInvoices();
        if (inv.length > 0) invoices = inv;
      } catch {
        // fallback
      }

      let text = `💳 **OFA Invoices & Payments Table** (Total: ${invoices.length} invoices):\n\n`;
      invoices.slice(0, 8).forEach((inv: any, i: number) => {
        text += `${i + 1}. **${inv.invoiceNumber}** — ${inv.playerName}\n`;
        text += `   • Amount: ₹${inv.totalAmount} | Paid: ₹${inv.paidAmount} [${inv.status}]\n`;
        text += `   • Due Date: ${inv.dueDate}\n`;
      });
      return { isHandled: true, reply: text };
    }

    // 7. Facilities / Venues
    if (lower.includes("facility") || lower.includes("venue") || lower.includes("ofa-1") || lower.includes("ofa-2") || lower.includes("ofa-3")) {
      let facilities: any[] = [];
      try {
        facilities = await fetchFacilities();
      } catch {}

      let text = `🏟️ **OFA Venues & Facilities Table**:\n\n`;
      text += `• **Admission Venues:** OFA-1, OFA-2, OFA-3\n`;
      if (facilities.length > 0) {
        text += `• **Active Courts & Facilities:**\n`;
        facilities.forEach((f: any, i: number) => {
          text += `  ${i + 1}. **${f.name}** (${f.sportName || "Court"}) — ₹${f.hourlyRate || 500}/hr\n`;
        });
      } else {
        text += `• **Courts:** Badminton Courts 1-4, Tennis Court, Football Turf, Cricket Nets, Pickleball Arena\n`;
      }
      return { isHandled: true, reply: text };
    }

    // 8. Sports
    if (lower.includes("sport") || lower.includes("game")) {
      return {
        isHandled: true,
        reply: `⚡ **OFA Approved Sports Disciplines:**\n\n1. ⚽ **Football**\n2. 🏏 **Cricket**\n3. 🏸 **Badminton**\n4. 🎾 **Tennis**\n5. 🏓 **Pickleball**\n6. 🏓 **Table Tennis**\n\nAll sports are available across venues **OFA-1, OFA-2, and OFA-3**!`,
      };
    }

    // 9. Tables Overview
    if (lower.includes("table") || lower.includes("database") || lower.includes("what can you access") || lower.includes("tables")) {
      return {
        isHandled: true,
        reply: `📊 **OFA Assistant Database Tables Access (Read-Only):**\n\nI have instant, real-time read access to all OFA academy tables:\n1. 👥 **Players & Admissions** — Profiles, sports, venues (OFA-1/2/3), emergency contacts\n2. 📅 **Slot Bookings** — Court rentals, time slots, customer phone numbers, status\n3. 🏸 **Consumables & Inventory** — Items list with unit prices and availability\n4. 💳 **Invoices & Payments** — Fee assignments, receipts, pending amounts\n5. 🏟️ **Venues & Facilities** — OFA-1, OFA-2, OFA-3 courts and turfs\n6. ⚡ **Sports & Batches** — Football, Cricket, Badminton, Tennis, Pickleball, Table Tennis\n\n🔒 _Note: I cannot modify or delete records. To add or update records, please use the left navigation buttons._`,
      };
    }

    return { isHandled: false, reply: "" };
  }, []);

  const { emitTypingStart, emitTypingStop } = useSocket({
    conversationId,
    userId: MOCK_CURRENT_USER.id,
    lastMessageAt,

    onNewMessage: (msg) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        if (exists) return prev.map((m) => (m.id === msg.id ? msg : m));
        return [...prev, msg];
      });
      scrollToBottom();
      if (msg.sender?.role === "bot") {
        setIsBotTyping(false);
        // Fire push notification for bot reply via socket
        showNewMessageNotification({
          senderName: msg.sender?.name || "OFA Assistant",
          messageText: msg.body || "",
          conversationId,
        }).catch(console.error);
      }
    },

    // Read receipts — update tick color in-place
    onStatusUpdate: (messageId: string, status: MessageStatus) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status } : m))
      );
    },

    onTypingStart: (uid) => {
      if (uid !== MOCK_CURRENT_USER.id) setIsBotTyping(true);
    },

    onTypingStop: (uid) => {
      if (uid !== MOCK_CURRENT_USER.id) setIsBotTyping(false);
    },

    // Offline catch-up: merge missed messages without duplicates
    onCatchUpMessages: (missed) => {
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = missed.filter((m) => !existingIds.has(m.id));
        if (newOnes.length === 0) return prev;
        return [...prev, ...newOnes].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      scrollToBottom();
    },
  });

  // ── Auto-recovery: if typing indicator is active, sync with server after 2.5s ──
  useEffect(() => {
    if (!isBotTyping) return;
    const timer = setTimeout(async () => {
      try {
        const latest = await getMessages(conversationId);
        if (latest.length > 0) {
          setMessages(latest);
          scrollToBottom();
          const lastMsg = latest[latest.length - 1];
          if (lastMsg.sender?.role === "bot" || lastMsg.senderId !== MOCK_CURRENT_USER.id) {
            setIsBotTyping(false);
          }
        }
      } catch {
        // non-fatal
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isBotTyping, conversationId, scrollToBottom]);

  // ── Typing debounce ───────────────────────────────────────────────────────
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    emitTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(emitTypingStop, 2000);
  }, [emitTypingStart, emitTypingStop]);

  // ── Send with retry ───────────────────────────────────────────────────────
  const doSend = useCallback(
    async (text: string, tempId: string, options?: SendMessageOptions, retrying = false) => {
      try {
        const saved = await sendMessage(conversationId, MOCK_CURRENT_USER.id, text, options);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...saved, status: "sent" as const } : m))
        );
        setIsBotTyping(true); // Bot reply incoming

        // Check OFA table queries or mutation restrictions
        const tableCheck = await queryOFATables(text);
        if (tableCheck.isHandled) {
          setTimeout(() => {
            setIsBotTyping(false);
            const botMsg: Message = {
              id: `bot-ofa-${Date.now()}`,
              conversationId,
              senderId: MOCK_BOT_USER.id,
              sender: { id: MOCK_BOT_USER.id, name: "OFA Assistant", role: "bot" },
              body: tableCheck.reply,
              kind: "text",
              status: "read",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, botMsg]);
            scrollToBottom();
            showNewMessageNotification({
              senderName: "OFA Assistant",
              messageText: tableCheck.reply,
              conversationId,
            }).catch(console.error);
          }, 500);
          return;
        }

        // If message was sent via local fallback (server unreachable), provide OFA Assistant response
        if (saved.id.startsWith("msg-local-")) {
          setTimeout(() => {
            setIsBotTyping(false);
            const replyText =
              "Hi! I'm OFA Assistant. I have read-only access to all academy tables (Players, Bookings, Invoices, Consumables, Facilities, Sports).\n\n" +
              "Ask me anytime to show player details, check bookings, look up phone numbers, or view the consumables list!\n\n" +
              "To make new bookings or admit players, please use the direct action buttons on the left navigation tabs: '+ New Booking', '+ Admit Player', or '+ Pay Fee'.";

            const botMsg: Message = {
              id: `bot-local-${Date.now()}`,
              conversationId,
              senderId: MOCK_BOT_USER.id,
              sender: { id: MOCK_BOT_USER.id, name: "OFA Assistant", role: "bot" },
              body: replyText,
              kind: "text",
              status: "read",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, botMsg]);
            scrollToBottom();
            showNewMessageNotification({
              senderName: "OFA Assistant",
              messageText: replyText,
              conversationId,
            }).catch(console.error);
          }, 800);
        }
      } catch {
        if (!retrying) {
          // Mark failed, offer retry
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "failed" as const } : m))
          );
          setIsBotTyping(false);
          Alert.alert(
            "Send Failed",
            "Message could not be delivered.",
            [
              { text: "Dismiss", style: "cancel" },
              {
                text: "Retry",
                onPress: () => {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === tempId ? { ...m, status: "sending" as const } : m))
                  );
                  doSend(text, tempId, options, true);
                },
              },
            ]
          );
        }
      }
    },
    [conversationId, queryOFATables, scrollToBottom]
  );

  // ── Handle text send ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId,
      senderId: MOCK_CURRENT_USER.id,
      sender: { id: MOCK_CURRENT_USER.id, name: MOCK_CURRENT_USER.name, role: "user" },
      body: text,
      kind: "text",
      status: "sending",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    emitTypingStop();
    scrollToBottom();

    await doSend(text, tempId);
  }, [inputText, conversationId, emitTypingStop, scrollToBottom, doSend]);

  // ── Handle Voice Recording ────────────────────────────────────────────────
  const handleRecordButtonPress = useCallback(async () => {
    if (inputText.trim()) {
      handleSend();
      return;
    }

    if (!isRecording) {
      await startRecording();
    }
  }, [inputText, isRecording, handleSend, startRecording]);

  const handleStopAndSendVoiceNote = useCallback(async () => {
    const result = await stopRecording();
    if (!result || !result.blob) return;

    const tempId = `temp-audio-${Date.now()}`;
    const localUrl = URL.createObjectURL(result.blob);
    const bodyText = `Voice message (${formatDuration(result.duration)})`;

    const optimisticMsg: Message = {
      id: tempId,
      conversationId,
      senderId: MOCK_CURRENT_USER.id,
      sender: { id: MOCK_CURRENT_USER.id, name: MOCK_CURRENT_USER.name, role: "user" },
      body: bodyText,
      kind: "audio",
      status: "sending",
      mediaUrl: localUrl,
      duration: result.duration,
      mimeType: result.mimeType,
      fileName: "voice_note.webm",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      const uploaded = await uploadMediaFile(result.blob, "voice_note.webm", result.mimeType);
      await doSend(bodyText, tempId, {
        kind: "audio",
        mediaUrl: uploaded.url,
        duration: result.duration,
        mimeType: uploaded.mimeType,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
      });
    } catch (err) {
      console.warn("[VoiceNote] Upload failed, sending with local data URL fallback:", err);
      await doSend(bodyText, tempId, {
        kind: "audio",
        mediaUrl: localUrl,
        duration: result.duration,
        mimeType: result.mimeType,
        fileName: "voice_note.webm",
      });
    }
  }, [stopRecording, conversationId, scrollToBottom, doSend]);

  // ── Handle Attachment Selection ───────────────────────────────────────────
  const handleSelectAttachment = useCallback(
    async (type: FilePickerType) => {
      try {
        const picked = await pickFile(type);
        if (!picked) return;

        setIsUploading(true);
        const tempId = `temp-media-${Date.now()}`;
        const localUrl = picked.uri;
        const kind = type as "image" | "document" | "audio";
        const bodyText = kind === "image" ? "Photo" : picked.name;

        const optimisticMsg: Message = {
          id: tempId,
          conversationId,
          senderId: MOCK_CURRENT_USER.id,
          sender: { id: MOCK_CURRENT_USER.id, name: MOCK_CURRENT_USER.name, role: "user" },
          body: bodyText,
          kind,
          status: "sending",
          mediaUrl: localUrl,
          fileName: picked.name,
          fileSize: picked.size,
          mimeType: picked.type,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        scrollToBottom();

        const uploaded = await uploadMediaFile(picked, picked.name, picked.type);
        setIsUploading(false);

        await doSend(bodyText, tempId, {
          kind,
          mediaUrl: uploaded.url || localUrl,
          fileName: uploaded.fileName || picked.name,
          fileSize: uploaded.fileSize || picked.size,
          mimeType: uploaded.mimeType || picked.type,
        });
      } catch (err) {
        setIsUploading(false);
        console.error("[Attachment] Error uploading file:", err);
        Alert.alert("Attachment Error", "Failed to attach the selected file.");
      }
    },
    [conversationId, scrollToBottom, doSend]
  );

  // ── Keyboard shortcuts (Enter sends, Shift+Enter creates newline) ─────────
  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault?: () => void; shiftKey?: boolean }) => {
      if (Platform.OS === "web") {
        const isShift = e.shiftKey || e.nativeEvent?.shiftKey;
        if (e.nativeEvent?.key === "Enter" && !isShift) {
          e.preventDefault?.();
          handleSend();
        }
      }
    },
    [handleSend]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Message }) => (
    <ChatBubble
      message={item}
      isOwn={item.senderId === MOCK_CURRENT_USER.id}
      showAvatar={item.senderId !== MOCK_CURRENT_USER.id}
      senderName={item.senderId !== MOCK_CURRENT_USER.id ? item.sender?.name : undefined}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <View style={styles.chatBg}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />

        {/* Animated WhatsApp-style typing dots */}
        {isBotTyping && (
          <View style={styles.typingRow}>
            <View style={styles.typingBubble}>
              <TypingDots />
            </View>
          </View>
        )}
      </View>

      {/* WhatsApp Web Light-Theme Composer Bar */}
      <View style={styles.composer}>
        {isRecording ? (
          <View style={styles.recordingBar}>
            <View style={styles.recordingInfo}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>
            </View>

            <TouchableOpacity
              style={styles.cancelRecBtn}
              onPress={cancelRecording}
              activeOpacity={0.7}
              accessibilityLabel="Cancel recording"
            >
              <TrashIcon size={18} color="#E53935" />
              <Text style={styles.cancelRecText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sendRecBtn}
              onPress={handleStopAndSendVoiceNote}
              activeOpacity={0.7}
              accessibilityLabel="Send voice message"
            >
              <SendIcon size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputCapsule}>
            {/* Attachment Button */}
            <TouchableOpacity
              style={styles.inlineIconBtn}
              onPress={() => setAttachmentModalVisible(true)}
              activeOpacity={0.6}
              disabled={isUploading}
              accessibilityLabel="Attach document, photo, or audio"
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#54656F" />
              ) : (
                <PaperclipIcon size={20} color="#54656F" />
              )}
            </TouchableOpacity>

            {/* Emoji / Smiley Button */}
            <TouchableOpacity
              style={styles.inlineIconBtn}
              onPress={() => setEmojiPickerVisible(true)}
              activeOpacity={0.6}
              accessibilityLabel="Insert emoji"
            >
              <SmileyIcon size={20} color="#54656F" />
            </TouchableOpacity>

            {/* Text Input */}
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={handleTextChange}
              onKeyPress={handleKeyPress}
              {...(Platform.OS === "web" ? ({ onKeyDown: handleKeyPress } as any) : {})}
              placeholder="Type a message"
              placeholderTextColor="#667781"
              multiline
              maxLength={2000}
              blurOnSubmit={false}
            />

            {/* Action Button: Mic or Send */}
            {inputText.trim() ? (
              <TouchableOpacity
                style={styles.inlineSendBtn}
                onPress={handleSend}
                activeOpacity={0.7}
                accessibilityLabel="Send message"
              >
                <SendIcon size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.inlineMicBtn}
                onPress={handleRecordButtonPress}
                activeOpacity={0.6}
                accessibilityLabel="Record voice message"
              >
                <MicIcon size={22} color="#54656F" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Attachment Selection Sheet */}
      <AttachmentModal
        visible={attachmentModalVisible}
        onClose={() => setAttachmentModalVisible(false)}
        onSelect={handleSelectAttachment}
      />

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onSelectEmoji={(emoji) => {
          setInputText((prev) => prev + emoji);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.chatBackground },
  loadingContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.chatBackground,
  },
  chatBg: { flex: 1 },
  messageList: { paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  typingRow: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs,
    flexDirection: "row",
  },
  typingBubble: {
    backgroundColor: Colors.bubbleReceived,
    borderRadius: Radius.bubble,
    borderTopLeftRadius: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F0F2F5",
    borderTopWidth: 1,
    borderTopColor: "#E9EDEF",
  },
  inputCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 0,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#E9EDEF",
    gap: 4,
  },
  inlineIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderRadius: 18,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: "#111B21",
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === "web" ? 11 : 6,
    maxHeight: 110,
    textAlignVertical: "center",
    alignSelf: "center",
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          borderWidth: 0,
          boxSizing: "border-box",
          margin: 0,
        } as any)
      : {}),
  },
  inlineMicBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderRadius: 18,
    marginRight: 2,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  inlineSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#00A884",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginRight: 2,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  recordingBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    gap: Spacing.sm,
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E53935",
  },
  recordingTimer: {
    fontSize: Fonts.sizes.md,
    fontWeight: "600",
    color: "#D32F2F",
  },
  cancelRecBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  cancelRecText: {
    fontSize: Fonts.sizes.sm,
    color: "#E53935",
    fontWeight: "500",
  },
  sendRecBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#00A884",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  headerDashboardBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  headerDashboardBtnText: {
    color: "#075E54",
    fontSize: Fonts.sizes.xs,
    fontWeight: "800",
  },
});

