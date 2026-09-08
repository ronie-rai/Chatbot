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
import { TemplateFormModal } from "../components/TemplateFormModal";
import { PaperclipIcon, SmileyIcon, MicIcon, SendIcon, TrashIcon } from "../components/Icons";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { MOCK_CURRENT_USER, MOCK_BOT_USER, MOCK_MESSAGES } from "../data/mockData";
import {
  getMessages,
  sendMessage,
  markMessageRead,
  uploadMediaFile,
  getChatTemplates,
  submitTemplateForm,
  DEFAULT_FALLBACK_TEMPLATES,
  type SendMessageOptions,
} from "../api/client";
import { useSocket } from "../hooks/useSocket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { pickFile, formatDuration, type FilePickerType } from "../utils/filePicker";
import type { Message, MessageStatus, ChatTemplateItem } from "@chatbot/shared-types";

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
  const [templates, setTemplates] = useState<ChatTemplateItem[]>(DEFAULT_FALLBACK_TEMPLATES);
  const [activeTemplateForModal, setActiveTemplateForModal] = useState<ChatTemplateItem | null>(null);

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

  // Set up header with prominent dashboard link
  useEffect(() => {
    navigation.setOptions({
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

  // ── Load Chat Templates for Interactive Forms ───────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const fetched = await getChatTemplates(MOCK_CURRENT_USER.tenantId);
        if (mounted && fetched && fetched.length > 0) {
          setTemplates(fetched);
        }
      } catch {
        // Fall back to pre-configured templates
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Handle Slide-Up Interactive Template Form Submission ────────────────
  const handleFormSubmit = async (formData: Record<string, string>) => {
    if (!activeTemplateForModal) return;
    try {
      const res = await submitTemplateForm({
        conversationId,
        tenantId: MOCK_CURRENT_USER.tenantId,
        command: activeTemplateForModal.command,
        senderId: MOCK_CURRENT_USER.id,
        senderName: MOCK_CURRENT_USER.name,
        formData,
      });

      if (res.message) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === res.message!.id);
          if (exists) return prev;
          return [...prev, res.message!];
        });
        scrollToBottom();
      }
      setActiveTemplateForModal(null);
    } catch (err: any) {
      Alert.alert("Submission Failed", err.message || "Failed to submit form");
    }
  };

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
      if (msg.sender?.role === "bot") setIsBotTyping(false);
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

        // If message was sent via local fallback, simulate bot response so chat doesn't stall
        if (saved.id.startsWith("msg-local-")) {
          setTimeout(() => {
            setIsBotTyping(false);
            const lower = text.toLowerCase();
            let replyText = "Hello! Thanks for reaching out to OFA Sports. How can I help you today with court bookings, coaching, or tournaments?";
            if (lower.includes("booking") || lower.includes("court") || lower.includes("reserve")) {
              replyText = "Thank you! I have recorded your court reservation enquiry. Our sports coordinator will confirm slot availability with you shortly.";
            } else if (lower.includes("price") || lower.includes("fee") || lower.includes("cost") || lower.includes("rate")) {
              replyText = "Court rentals start from $25/hr for badminton and $40/hr for tennis courts. Coaching packages start from $120/month. Would you like me to book a slot for you?";
            } else if (lower.includes("transformer") || lower.includes("motor") || lower.includes("equipment")) {
              replyText = "Got it! I have received your equipment specification and inquiry. Our technical team is reviewing it.";
            } else if (text.trim().length > 0) {
              replyText = `Thank you for your message: "${text}". I have logged your enquiry with OFA Sports. An executive will get back to you shortly!`;
            }

            const botMsg: Message = {
              id: `bot-local-${Date.now()}`,
              conversationId,
              senderId: MOCK_BOT_USER.id,
              sender: { id: MOCK_BOT_USER.id, name: "OFA AI", role: "bot" },
              body: replyText,
              kind: "text",
              status: "read",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, botMsg]);
            scrollToBottom();
          }, 1200);
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
    [conversationId]
  );

  // ── Handle text send ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    // Check if user entered a slash command for a template -> open interactive form!
    if (text.startsWith("/")) {
      const cmd = text.split(/\s+/)[0].toLowerCase().replace(/^\//, "");
      const matchedTpl = templates.find((t) => t.command.toLowerCase() === cmd);
      if (matchedTpl) {
        setInputText("");
        emitTypingStop();
        setActiveTemplateForModal(matchedTpl);
        return;
      }
    }

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

      {/* Quick Sports Template Chips */}
      <View style={styles.quickChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChipsScroll}
        >
          {templates.map((item) => (
            <TouchableOpacity
              key={item.command}
              style={styles.quickChip}
              onPress={() => setActiveTemplateForModal(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>
                {item.icon || "📋"} /{item.command}
              </Text>
            </TouchableOpacity>
          ))}

          {MOCK_CURRENT_USER.role === "admin" && (
            <>
              <TouchableOpacity
                style={[styles.quickChip, styles.quickChipAdmin]}
                onPress={() => setInputText("/create ")}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, styles.quickChipAdminText]}>
                  🛠️ /create
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickChip, styles.quickChipAdmin]}
                onPress={() => setInputText("/modify ")}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, styles.quickChipAdminText]}>
                  ✏️ /modify
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickChip, styles.quickChipAdmin]}
                onPress={() => setInputText("/delete ")}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, styles.quickChipAdminText]}>
                  🗑️ /delete
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
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

      {/* Slide-Up In-Chat Interactive Template Form Modal */}
      <TemplateFormModal
        visible={!!activeTemplateForModal}
        template={activeTemplateForModal}
        onClose={() => setActiveTemplateForModal(null)}
        onSubmit={handleFormSubmit}
        defaultUserName={MOCK_CURRENT_USER.name}
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
  quickChipsContainer: {
    backgroundColor: "#F7F8FA",
    borderTopWidth: 1,
    borderTopColor: "#E9EDEF",
    paddingVertical: 6,
  },
  quickChipsScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  quickChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D7DB",
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  quickChipAdmin: {
    backgroundColor: "#FFF8E1",
    borderColor: "#FFE082",
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111B21",
  },
  quickChipAdminText: {
    color: "#E65100",
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

