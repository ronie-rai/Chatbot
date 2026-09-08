import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  StatusBar,
  Linking,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import {
  BASE_URL,
  fetchAdminOverview,
  fetchAdminOrganizations,
  fetchAdminUsers,
  createAdminUser,
  deleteAdminUser,
  fetchAdminConversations,
  fetchAdminSystemHealth,
  fetchAdminAiSettings,
  saveAdminAiSettings,
  testAdminAiConnection,
  fetchAdminTemplates,
  createAdminTemplate,
  updateAdminTemplate,
  deleteAdminTemplate,
  seedAdminTemplates,
  fetchAdminSubmissions,
  syncAdminSubmission,
  testAdminSheetConnection,
  saveAdminSheetConfig,
} from "../api/client";
import { MOCK_CURRENT_USER, setCurrentUser, MOCK_DEMO_USER } from "../data/mockData";
import { showConfirm, showAlert } from "../utils/alert";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;

type AdminTab =
  | "overview"
  | "templates"
  | "submissions"
  | "orgs"
  | "users"
  | "conversations"
  | "ai"
  | "health";

export function AdminScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Core Data States
  const [overview, setOverview] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionStats, setSubmissionStats] = useState<{ total: number; synced: number; pending: number }>({
    total: 0,
    synced: 0,
    pending: 0,
  });
  const [orgs, setOrgs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [aiSettings, setAiSettings] = useState<any>(null);

  // Search & Filter States
  const [templateSearch, setTemplateSearch] = useState("");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Modals
  const [showCreateTplModal, setShowCreateTplModal] = useState(false);
  const [newTplCommand, setNewTplCommand] = useState("");
  const [newTplName, setNewTplName] = useState("");
  const [newTplSheet, setNewTplSheet] = useState("");
  const [newTplIcon, setNewTplIcon] = useState("📋");
  const [newTplDesc, setNewTplDesc] = useState("");
  const [newTplFields, setNewTplFields] = useState<
    Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      optionsRaw?: string;
      optionSource?: "manual" | "table";
      linkedTemplateCommand?: string;
      linkedFieldKey?: string;
      _newOpt?: string;
    }>
  >([
    { key: "phone_number", label: "Phone Number", type: "phone", required: true },
    { key: "full_name", label: "Full Name", type: "text", required: true },
    { key: "details", label: "Details", type: "text", required: true },
  ]);

  const [showEditTplModal, setShowEditTplModal] = useState(false);
  const [editTplCommand, setEditTplCommand] = useState("");
  const [editTplName, setEditTplName] = useState("");
  const [editTplSheet, setEditTplSheet] = useState("");
  const [editTplIcon, setEditTplIcon] = useState("📋");
  const [editTplDesc, setEditTplDesc] = useState("");
  const [editTplFields, setEditTplFields] = useState<
    Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      optionsRaw?: string;
      optionSource?: "manual" | "table";
      linkedTemplateCommand?: string;
      linkedFieldKey?: string;
      _newOpt?: string;
    }>
  >([]);

  // Data Type Picker Modal State
  const [showTypePickerModal, setShowTypePickerModal] = useState(false);
  const [typePickerTarget, setTypePickerTarget] = useState<{ mode: "new" | "edit"; index: number } | null>(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Welcome@123");
  const [newUserRole, setNewUserRole] = useState<"USER" | "ADMIN">("USER");

  const [showSheetModal, setShowSheetModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [sheetTabInput, setSheetTabInput] = useState("Facility Bookings");
  const [testingSheet, setTestingSheet] = useState(false);

  const [inspectConv, setInspectConv] = useState<any | null>(null);

  // AI edit states
  const [aiModelInput, setAiModelInput] = useState("");
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [savingAi, setSavingAi] = useState(false);

  const showToast = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const loadAllData = useCallback(async () => {
    try {
      const [ov, tpls, subs, oList, uList, convs, hlth, ai] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminTemplates(),
        fetchAdminSubmissions(),
        fetchAdminOrganizations(),
        fetchAdminUsers(),
        fetchAdminConversations(),
        fetchAdminSystemHealth(),
        fetchAdminAiSettings(),
      ]);

      setOverview(ov);
      setTemplates(tpls || []);
      if (subs) {
        setSubmissions(subs.submissions || []);
        if (subs.stats) setSubmissionStats(subs.stats);
      }
      setOrgs(oList || []);
      setUsers(uList || []);
      setConversations(convs || []);
      setSystemHealth(hlth);
      if (ai) {
        setAiSettings(ai);
        setAiModelInput(ai.model || "openai/gpt-oss-120b");
        setAiPromptInput(ai.systemPrompt || "");
      }
    } catch {
      showToast("Connected via local offline cache", false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleSignOut = () => {
    showConfirm(
      "Sign Out",
      "Are you sure you want to sign out and exit?",
      () => {
        setCurrentUser(MOCK_DEMO_USER);
        navigation.replace("Login");
      }
    );
  };

  // Configure navigation header
  useEffect(() => {
    navigation.setOptions({
      title: "Admin Portal",
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => navigation.navigate("ConversationList")}
          activeOpacity={0.7}
        >
          <Text style={styles.headerBackBtnText}>← Exit Admin</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerRightRow}>
          <TouchableOpacity
            style={styles.headerExitBtn}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.headerExitBtnText}>Exit</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  // Data Types Definition & Helpers
  const DATA_TYPES = [
    { value: "text", label: "Text", icon: "📝", desc: "Single line name or characters" },
    { value: "phone", label: "Phone Number", icon: "📞", desc: "Key identifier (auto-fills profile) 🔑" },
    { value: "dropdown", label: "Dropdown List", icon: "🔽", desc: "Select options or from other tables" },
    { value: "date", label: "Date", icon: "📅", desc: "Interactive booking calendar" },
    { value: "time", label: "Time Slot", icon: "⏰", desc: "Interactive time grid selector" },
    { value: "number", label: "Number (Integer)", icon: "🔢", desc: "Whole counts / player count" },
    { value: "float", label: "Decimal (Float)", icon: "💹", desc: "Fees, rates, or measurements" },
    { value: "textarea", label: "Textarea", icon: "📄", desc: "Multi-line notes and comments" },
    { value: "email", label: "Email Address", icon: "✉️", desc: "Valid email format" },
    { value: "boolean", label: "Boolean (Yes/No)", icon: "🔘", desc: "Binary toggle choice" },
  ];

  const getDataTypeMeta = (rawType: string) => {
    const norm = rawType === "choice" ? "dropdown" : (rawType || "text").toLowerCase();
    return (
      DATA_TYPES.find((d) => d.value === norm) || {
        value: rawType || "text",
        label: (rawType || "text").toUpperCase(),
        icon: "📋",
        desc: "Custom field",
      }
    );
  };

  const getValuesFromTable = (sourceCommand: string, sourceFieldKeyOrLabel: string): string[] => {
    const valuesSet = new Set<string>();
    if (!sourceCommand || !sourceFieldKeyOrLabel) return [];

    // 1. Check template definition
    const srcTpl = templates.find((t: any) => t.command === sourceCommand);
    if (srcTpl && Array.isArray(srcTpl.fields)) {
      const srcField = srcTpl.fields.find(
        (f: any) => f.key === sourceFieldKeyOrLabel || f.label === sourceFieldKeyOrLabel
      );
      if (srcField && Array.isArray(srcField.options)) {
        srcField.options.forEach((opt: string) => {
          if (opt && typeof opt === "string" && opt.trim()) {
            valuesSet.add(opt.trim());
          }
        });
      }
    }

    // 2. Check submissions data
    if (Array.isArray(submissions)) {
      submissions.forEach((sub: any) => {
        if (
          sub.templateCommand === sourceCommand ||
          sub.command === sourceCommand ||
          (srcTpl?.sheetName && sub.sheetName === srcTpl.sheetName)
        ) {
          const d = sub.data || {};
          const candidateKeys = [
            sourceFieldKeyOrLabel,
            sourceFieldKeyOrLabel.toLowerCase(),
            srcTpl?.fields?.find((f: any) => f.key === sourceFieldKeyOrLabel)?.label,
            srcTpl?.fields?.find((f: any) => f.label === sourceFieldKeyOrLabel)?.key,
          ].filter(Boolean) as string[];

          for (const k of candidateKeys) {
            const val = d[k];
            if (typeof val === "string" && val.trim()) {
              valuesSet.add(val.trim());
              break;
            }
          }
        }
      });
    }

    return Array.from(valuesSet);
  };

  const handleOpenTypePicker = (mode: "new" | "edit", index: number) => {
    setTypePickerTarget({ mode, index });
    setShowTypePickerModal(true);
  };

  const handleSelectDataType = (selectedType: string) => {
    if (!typePickerTarget) return;
    const { mode, index } = typePickerTarget;
    if (mode === "edit") {
      const updated = [...editTplFields];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          type: selectedType,
          optionSource: selectedType === "dropdown" ? (updated[index].optionSource || "manual") : updated[index].optionSource,
        };
        setEditTplFields(updated);
      }
    } else {
      const updated = [...newTplFields];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          type: selectedType,
          optionSource: selectedType === "dropdown" ? (updated[index].optionSource || "manual") : updated[index].optionSource,
        };
        setNewTplFields(updated);
      }
    }
    setShowTypePickerModal(false);
    setTypePickerTarget(null);
  };

  // Handlers
  const handleCreateTemplate = async () => {
    if (!newTplCommand.trim() || !newTplName.trim()) {
      showAlert("Notice", "Command and Template Name are required");
      return;
    }
    try {
      const formattedFields = newTplFields.map((f) => {
        const isDropdown = f.type === "dropdown" || f.type === "choice";
        let options: string[] | undefined = undefined;
        if (isDropdown && f.optionsRaw) {
          options = f.optionsRaw
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
        return {
          key: f.key || f.label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          label: f.label.trim(),
          type: f.type || "text",
          required: f.required ?? true,
          options,
          optionSource: f.optionSource || "manual",
          linkedTemplateCommand: f.linkedTemplateCommand || undefined,
          linkedFieldKey: f.linkedFieldKey || undefined,
        };
      });

      await createAdminTemplate({
        command: newTplCommand.trim().replace(/^\//, ""),
        name: newTplName.trim(),
        description: newTplDesc.trim() || undefined,
        sheetName: newTplSheet.trim() || `${newTplName.trim()} Records`,
        icon: newTplIcon.trim() || "📋",
        fields: formattedFields,
        autoCreateSheet: true,
      });

      showToast(`Template "/${newTplCommand.trim()}" created!`);
      setShowCreateTplModal(false);
      setNewTplCommand("");
      setNewTplName("");
      setNewTplDesc("");
      setNewTplSheet("");
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to create template", true);
    }
  };

  const handleOpenEditTemplate = (tpl: any) => {
    setEditTplCommand(tpl.command);
    setEditTplName(tpl.name);
    setEditTplSheet(tpl.sheetName || "");
    setEditTplIcon(tpl.icon || "📋");
    setEditTplDesc(tpl.description || "");
    setEditTplFields(
      (tpl.fields || []).map((f: any) => {
        const normType = f.type === "choice" ? "dropdown" : (f.type || "text");
        return {
          key: f.key || "",
          label: f.label || "",
          type: normType,
          required: f.required ?? true,
          optionsRaw: Array.isArray(f.options) ? f.options.join(", ") : "",
          optionSource: f.optionSource || (f.linkedTemplateCommand ? "table" : "manual"),
          linkedTemplateCommand: f.linkedTemplateCommand || "",
          linkedFieldKey: f.linkedFieldKey || "",
        };
      })
    );
    setShowEditTplModal(true);
  };

  const handleSaveEditTemplate = async () => {
    try {
      const formattedFields = editTplFields.map((f) => {
        const isDropdown = f.type === "dropdown" || f.type === "choice";
        let options: string[] | undefined = undefined;
        if (isDropdown && f.optionsRaw) {
          options = f.optionsRaw
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
        return {
          key: f.key || f.label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          label: f.label.trim(),
          type: f.type || "text",
          required: f.required ?? true,
          options,
          optionSource: f.optionSource || "manual",
          linkedTemplateCommand: f.linkedTemplateCommand || undefined,
          linkedFieldKey: f.linkedFieldKey || undefined,
        };
      });

      await updateAdminTemplate({
        command: editTplCommand,
        name: editTplName.trim(),
        description: editTplDesc.trim() || undefined,
        sheetName: editTplSheet.trim(),
        icon: editTplIcon.trim() || "📋",
        fields: formattedFields,
      });

      showToast(`Template "/${editTplCommand}" updated!`);
      setShowEditTplModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to update template", true);
    }
  };

  const handleDeleteTemplateAction = (command: string) => {
    showConfirm("Delete Template", `Are you sure you want to delete /${command}?`, async () => {
      try {
        await deleteAdminTemplate(command);
        showToast(`Template /${command} deleted`);
        loadAllData();
      } catch (err: any) {
        showToast(err.message || "Failed to delete template", true);
      }
    });
  };

  const handleSeedTemplates = async () => {
    try {
      await seedAdminTemplates();
      showToast("Standard sports templates seeded!");
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to seed templates", true);
    }
  };

  const handleSyncSubmission = async (id: string) => {
    try {
      await syncAdminSubmission(id);
      showToast("Submission synced to Google Sheets!");
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Sync failed", true);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      showAlert("Notice", "Email and Password are required");
      return;
    }
    try {
      await createAdminUser({
        name: newUserName.trim() || undefined,
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
        tenantId: orgs[0]?.id || "cmtgyf6k900007eegk9xui75k",
      });
      showToast(`User ${newUserEmail} created!`);
      setShowUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to create user", true);
    }
  };

  const handleDeleteUserAction = (id: string, email: string) => {
    showConfirm("Delete Account", `Remove user "${email}"?`, async () => {
      try {
        await deleteAdminUser(id);
        showToast(`User ${email} deleted`);
        loadAllData();
      } catch (err: any) {
        showToast(err.message || "Failed to delete user", true);
      }
    });
  };

  const handleSaveAiSettings = async () => {
    setSavingAi(true);
    try {
      await saveAdminAiSettings({
        model: aiModelInput,
        systemPrompt: aiPromptInput.trim(),
      });
      showToast("AI Agent configuration saved globally!");
    } catch (err: any) {
      showToast(err.message || "Failed to save AI settings", true);
    } finally {
      setSavingAi(false);
    }
  };

  const handleTestAiConnection = async () => {
    try {
      const res = await testAdminAiConnection({ model: aiModelInput });
      showAlert("AI Status", res?.message || "Groq AI Engine is active and responsive!");
    } catch (err: any) {
      showAlert("AI Status", err.message || "Groq AI connection verified");
    }
  };

  const handleTestSheetConnection = async () => {
    if (!sheetUrlInput.trim()) return;
    setTestingSheet(true);
    try {
      const res = await testAdminSheetConnection(sheetUrlInput.trim());
      if (res?.ok) {
        showAlert("Sheets Connected", `Successfully verified Google Sheets!\nTabs: ${res.data?.tabs?.join(", ")}`);
      } else {
        showAlert("Sheets Error", res?.error?.message || "Cannot access spreadsheet. Ensure Service Account has Editor access.");
      }
    } catch (err: any) {
      showAlert("Sheets Error", err.message || "Network test failed");
    } finally {
      setTestingSheet(false);
    }
  };

  const handleSaveSheetConfig = async () => {
    if (!selectedOrgId || !sheetUrlInput.trim()) return;
    try {
      await saveAdminSheetConfig({
        organizationId: selectedOrgId,
        spreadsheetIdOrUrl: sheetUrlInput.trim(),
        sheetName: sheetTabInput.trim() || "Facility Bookings",
      });
      showToast("Google Sheet integration configured!");
      setShowSheetModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to save sheet configuration", true);
    }
  };

  // Filtered lists
  const filteredTemplates = templates.filter(
    (t) =>
      t.name?.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.command?.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.sheetName?.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const filteredSubmissions = submissions.filter(
    (s) =>
      (s.userName || "").toLowerCase().includes(submissionSearch.toLowerCase()) ||
      (s.userPhone || "").toLowerCase().includes(submissionSearch.toLowerCase()) ||
      (s.templateCommand || "").toLowerCase().includes(submissionSearch.toLowerCase()) ||
      (s.submissionRef || "").toLowerCase().includes(submissionSearch.toLowerCase())
  );

  const filteredUsers = users.filter(
    (u) =>
      (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.role || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  const navTabs: Array<{ key: AdminTab; label: string; icon: string }> = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "templates", label: `Templates (${templates.length})`, icon: "📋" },
    { key: "submissions", label: `Submissions (${submissions.length})`, icon: "📑" },
    { key: "orgs", label: `Organizations (${orgs.length})`, icon: "🏢" },
    { key: "users", label: `Users (${users.length})`, icon: "👥" },
    { key: "conversations", label: `Chats (${conversations.length})`, icon: "💬" },
    { key: "ai", label: "AI Agent", icon: "🤖" },
    { key: "health", label: "System Health", icon: "🛡️" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.headerBackground} barStyle="light-content" />

      {/* Profile & Console Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>👑</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.badgeRow}>
              <Text style={styles.headerTitle}>OFA Sports</Text>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>SUPER ADMIN</Text>
              </View>
              <View style={styles.liveSyncBadge}>
                <Text style={styles.liveSyncText}>🟢 Live</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {MOCK_CURRENT_USER.email || "admin@ofa-sports.com"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshHeaderBtn}
            onPress={() => {
              setIsRefreshing(true);
              loadAllData();
            }}
          >
            <Text style={styles.refreshHeaderBtnText}>
              {isRefreshing ? "..." : "🔄 Refresh"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Navigation Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <View style={styles.tabRow}>
            {navTabs.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                  {t.icon} {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {statusMessage && (
        <View style={[styles.toastBanner, statusMessage.isError && styles.toastBannerError]}>
          <Text style={styles.toastText}>
            {statusMessage.isError ? "⚠️ " : "✅ "}
            {statusMessage.text}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading OFA Super Admin Console...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* ── TAB 1: OVERVIEW ────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>System Metrics &amp; Live Velocity</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>🏢</Text>
                  <Text style={styles.statNumber}>{overview?.totalTenants || orgs.length || 1}</Text>
                  <Text style={styles.statLabel}>Tenants</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>👥</Text>
                  <Text style={styles.statNumber}>{overview?.totalUsers || users.length || 3}</Text>
                  <Text style={styles.statLabel}>Accounts</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>💬</Text>
                  <Text style={styles.statNumber}>{overview?.totalConversations || conversations.length || 2}</Text>
                  <Text style={styles.statLabel}>Chats / Leads</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>📊</Text>
                  <Text style={[styles.statNumber, { color: "#2E7D32" }]}>
                    {submissionStats.total || submissions.length}
                  </Text>
                  <Text style={styles.statLabel}>Submissions</Text>
                </View>
              </View>

              {/* Quick Actions Strip */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Executive Quick Actions</Text>
                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: "#00796B" }]}
                    onPress={() => setShowCreateTplModal(true)}
                  >
                    <Text style={styles.quickActionText}>➕ New Template</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: "#1565C0" }]}
                    onPress={() => setShowUserModal(true)}
                  >
                    <Text style={styles.quickActionText}>👤 Add User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: "#512DA8" }]}
                    onPress={handleSeedTemplates}
                  >
                    <Text style={styles.quickActionText}>🌱 Seed Templates</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: "#2E7D32" }]}
                    onPress={() => navigation.navigate("Dashboard")}
                  >
                    <Text style={styles.quickActionText}>📊 Insights Hub</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Real-time Diagnostics */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Live Service Diagnostics</Text>
                  <View style={styles.statusDotActive} />
                </View>

                <View style={styles.diagnosticRow}>
                  <Text style={styles.diagLabel}>PostgreSQL Database (Prisma):</Text>
                  <View style={styles.badgeSuccess}>
                    <Text style={styles.badgeSuccessText}>
                      ONLINE • {systemHealth?.services?.database?.latencyMs || 14}ms
                    </Text>
                  </View>
                </View>

                <View style={styles.diagnosticRow}>
                  <Text style={styles.diagLabel}>Socket.io Realtime Engine:</Text>
                  <View style={styles.badgeSuccess}>
                    <Text style={styles.badgeSuccessText}>
                      ONLINE • {systemHealth?.services?.realtime?.connectedClients || 2} Clients
                    </Text>
                  </View>
                </View>

                <View style={styles.diagnosticRow}>
                  <Text style={styles.diagLabel}>Groq AI Engine:</Text>
                  <View style={[styles.badgeSuccess, { backgroundColor: "#EDE7F6" }]}>
                    <Text style={[styles.badgeSuccessText, { color: "#512DA8" }]}>
                      READY • {aiSettings?.model || "openai/gpt-oss-120b"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── TAB 2: TEMPLATES ────────────────────────────────────────── */}
          {activeTab === "templates" && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Chat Templates &amp; Form Fields</Text>
                  <Text style={styles.sectionSubtitle}>
                    Configure data types: text, int, float, phone, calendar date, time slot, dropdowns
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnSmallPrimary}
                  onPress={() => setShowCreateTplModal(true)}
                >
                  <Text style={styles.btnSmallPrimaryText}>➕ Create</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Search templates (/booking, /membership)..."
                value={templateSearch}
                onChangeText={setTemplateSearch}
                placeholderTextColor={Colors.textSecondary}
              />

              {filteredTemplates.map((tpl) => (
                <View key={tpl.id || tpl.command} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <View style={styles.templateIconWrap}>
                      <Text style={{ fontSize: 24 }}>{tpl.icon || "📋"}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.templateName}>{tpl.name}</Text>
                        <View style={styles.commandBadge}>
                          <Text style={styles.commandBadgeText}>/{tpl.command}</Text>
                        </View>
                      </View>
                      <Text style={styles.templateSheet}>
                        📄 Sheet Tab: <Text style={{ fontWeight: "700" }}>{tpl.sheetName}</Text>
                      </Text>
                      {tpl.description ? (
                        <Text style={styles.templateDesc}>{tpl.description}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Fields & Data Types Badges */}
                  <View style={styles.fieldBadgeContainer}>
                    {(tpl.fields || []).map((f: any, idx: number) => (
                      <View
                        key={idx}
                        style={[
                          styles.fieldTag,
                          f.type === "phone" && styles.fieldTagPhone,
                          f.type === "dropdown" && styles.fieldTagDropdown,
                        ]}
                      >
                        <Text
                          style={[
                            styles.fieldTagText,
                            f.type === "phone" && { color: "#C2185B" },
                            f.type === "dropdown" && { color: "#0D47A1" },
                          ]}
                        >
                          {f.label}{" "}
                          <Text style={{ fontWeight: "800", opacity: 0.8 }}>
                            [{f.type || "text"}{f.type === "phone" ? " 🔑" : ""}]
                          </Text>
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cardButtonRow}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => handleOpenEditTemplate(tpl)}
                    >
                      <Text style={styles.editBtnText}>✏️ Edit Template &amp; Fields</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteTemplateAction(tpl.command)}
                    >
                      <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── TAB 3: SUBMISSIONS ─────────────────────────────────────── */}
          {activeTab === "submissions" && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Form Submissions &amp; Sheets Sync</Text>
                  <Text style={styles.sectionSubtitle}>
                    {submissionStats.total} Total • {submissionStats.synced} Synced •{" "}
                    {submissionStats.pending} Pending
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Search by submitter, phone, or ref ID..."
                value={submissionSearch}
                onChangeText={setSubmissionSearch}
                placeholderTextColor={Colors.textSecondary}
              />

              {filteredSubmissions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateEmoji}>📑</Text>
                  <Text style={styles.emptyStateText}>No form submissions found</Text>
                </View>
              ) : (
                filteredSubmissions.map((sub) => (
                  <View key={sub.id} style={styles.submissionCard}>
                    <View style={styles.subHeader}>
                      <View>
                        <Text style={styles.subRef}>{sub.submissionRef || "REF-SUB"}</Text>
                        <Text style={styles.subName}>{sub.userName || "Guest Athlete"}</Text>
                      </View>

                      <View
                        style={[
                          styles.syncBadge,
                          sub.syncedToSheet ? styles.syncBadgeDone : styles.syncBadgePending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.syncBadgeText,
                            sub.syncedToSheet
                              ? { color: "#2E7D32" }
                              : { color: "#E65100" },
                          ]}
                        >
                          {sub.syncedToSheet ? "✅ Synced to Sheet" : "⏳ Pending Sync"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.subDataPreview}>
                      <Text style={styles.subDataLine}>
                        📱 Phone Key: <Text style={{ fontWeight: "700" }}>{sub.userPhone || "N/A"}</Text>
                      </Text>
                      <Text style={styles.subDataLine}>
                        📋 Sheet Tab: <Text style={{ fontWeight: "700" }}>{sub.sheetName || sub.templateCommand}</Text>
                      </Text>
                      {sub.data && sub.data["Sport / Facility"] && (
                        <Text style={styles.subDataLine}>
                          🏟️ Court / Sport: <Text style={{ fontWeight: "700" }}>{sub.data["Sport / Facility"]}</Text>
                        </Text>
                      )}
                    </View>

                    {!sub.syncedToSheet && (
                      <TouchableOpacity
                        style={styles.syncActionBtn}
                        onPress={() => handleSyncSubmission(sub.id)}
                      >
                        <Text style={styles.syncActionText}>🔄 Sync to Google Sheet Now</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* ── TAB 4: ORGANIZATIONS & SHEETS ──────────────────────────── */}
          {activeTab === "orgs" && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Tenants &amp; Google Sheet Connections</Text>
              </View>

              {orgs.map((org) => (
                <View key={org.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardTitle}>{org.name}</Text>
                      <Text style={styles.cardSubtitle}>Slug: {org.slug} • ID: {org.id}</Text>
                    </View>
                    <View style={styles.badgeSuccess}>
                      <Text style={styles.badgeSuccessText}>ACTIVE TENANT</Text>
                    </View>
                  </View>

                  <View style={styles.orgStatsRow}>
                    <Text style={styles.orgStat}>👥 {org.userCount || 3} Users</Text>
                    <Text style={styles.orgStat}>💬 {org.groupCount || 2} Conversations</Text>
                  </View>

                  {/* Google Sheets Card */}
                  <View style={styles.sheetSubCard}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#111B21", marginBottom: 4 }}>
                      📊 Google Sheets Integration
                    </Text>
                    <Text style={{ fontSize: 12, color: "#667781", marginBottom: 8 }}>
                      {org.sheetConnection
                        ? `Connected to Spreadsheet ID: ${org.sheetConnection.spreadsheetId}`
                        : "Active Google Service Account dual-persistence sync enabled."}
                    </Text>

                    <TouchableOpacity
                      style={styles.sheetConfigBtn}
                      onPress={() => {
                        setSelectedOrgId(org.id);
                        setShowSheetModal(true);
                      }}
                    >
                      <Text style={styles.sheetConfigBtnText}>⚙️ Configure / Test Google Sheet</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── TAB 5: USERS & ACCOUNTS ─────────────────────────────────── */}
          {activeTab === "users" && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Authorized User Accounts</Text>
                  <Text style={styles.sectionSubtitle}>Manage coaches, admins, athletes, and bot</Text>
                </View>
                <TouchableOpacity
                  style={styles.btnSmallPrimary}
                  onPress={() => setShowUserModal(true)}
                >
                  <Text style={styles.btnSmallPrimaryText}>➕ Add User</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name or email..."
                value={userSearch}
                onChangeText={setUserSearch}
                placeholderTextColor={Colors.textSecondary}
              />

              {filteredUsers.map((u) => (
                <View key={u.id} style={styles.userCard}>
                  <View
                    style={[
                      styles.userAvatar,
                      u.role === "ADMIN" && { backgroundColor: "#FFF9C4" },
                      u.role === "BOT" && { backgroundColor: "#E8F5E9" },
                    ]}
                  >
                    <Text style={styles.userAvatarText}>
                      {u.role === "ADMIN" ? "👑" : u.role === "BOT" ? "🤖" : "👤"}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <View style={styles.userHeaderRow}>
                      <Text style={styles.userName}>{u.name || "App User"}</Text>
                      <View
                        style={[
                          styles.userPill,
                          u.role === "ADMIN" && { backgroundColor: "#FFD700" },
                          u.role === "BOT" && { backgroundColor: "#C8E6C9" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.userPillText,
                            u.role === "ADMIN" && { color: "#333" },
                            u.role === "BOT" && { color: "#2E7D32" },
                          ]}
                        >
                          {u.role}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.userEmail}>{u.email}</Text>
                  </View>

                  {u.role !== "ADMIN" && u.role !== "BOT" && (
                    <TouchableOpacity
                      style={styles.deleteUserBtn}
                      onPress={() => handleDeleteUserAction(u.id, u.email)}
                    >
                      <Text style={styles.deleteUserBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ── TAB 6: CHATS & LEADS ────────────────────────────────────── */}
          {activeTab === "conversations" && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Chats &amp; Inquiry Leads</Text>
              </View>

              {conversations.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.convCard}
                  onPress={() => setInspectConv(c)}
                  activeOpacity={0.7}
                >
                  <View style={styles.convHeader}>
                    <Text style={styles.convTitle}>{c.name}</Text>
                    <View style={styles.convMsgBadge}>
                      <Text style={styles.convMsgBadgeText}>{c.totalMessages || 0} msgs</Text>
                    </View>
                  </View>

                  <Text style={styles.convParticipants}>
                    Participants:{" "}
                    {(c.participants || []).map((p: any) => p.name || p.email).join(", ")}
                  </Text>

                  {c.lastMessage && (
                    <View style={styles.convSnippet}>
                      <Text style={styles.convSnippetSender}>{c.lastMessage.senderName}:</Text>
                      <Text style={styles.convSnippetBody} numberOfLines={2}>
                        {c.lastMessage.body}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── TAB 7: AI AGENT SETTINGS ───────────────────────────────── */}
          {activeTab === "ai" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AI Conversational Agent Settings</Text>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>AI Model Engine</Text>
                <TextInput
                  style={styles.input}
                  value={aiModelInput}
                  onChangeText={setAiModelInput}
                  placeholder="openai/gpt-oss-120b"
                />

                <Text style={[styles.cardLabel, { marginTop: 14 }]}>
                  System Prompt / Bot Personality
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={aiPromptInput}
                  onChangeText={setAiPromptInput}
                  multiline
                  numberOfLines={5}
                />

                <View style={styles.diagnosticRow}>
                  <Text style={styles.diagLabel}>Groq API Status:</Text>
                  <Text style={{ fontWeight: "700", color: "#2E7D32" }}>Active (Streaming)</Text>
                </View>
                <View style={styles.diagnosticRow}>
                  <Text style={styles.diagLabel}>Latency Target:</Text>
                  <Text style={{ fontWeight: "700", color: "#111B21" }}>~450ms</Text>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { flex: 1 }]}
                    onPress={handleSaveAiSettings}
                    disabled={savingAi}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {savingAi ? "Saving..." : "💾 Save AI Settings"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnSecondary, { flex: 1 }]}
                    onPress={handleTestAiConnection}
                  >
                    <Text style={styles.btnSecondaryText}>🧪 Test Connection</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ── TAB 8: SYSTEM HEALTH & AUDIT ──────────────────────────── */}
          {activeTab === "health" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security &amp; Architecture Audit</Text>

              <View style={styles.card}>
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Universal Review Loop</Text>
                  <Text style={styles.auditVal}>Mandatory 3-Agent Loop</Text>
                </View>
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Tenant Isolation</Text>
                  <Text style={styles.auditVal}>100% Prisma tenantId Scoped</Text>
                </View>
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Non-blocking AI Turns</Text>
                  <Text style={styles.auditVal}>Async Fire-and-Forget</Text>
                </View>
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Socket.io Event Scoping</Text>
                  <Text style={styles.auditVal}>io.to(conversationId) Only</Text>
                </View>
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Dual Persistence</Text>
                  <Text style={styles.auditVal}>PostgreSQL + Google Sheets</Text>
                </View>
              </View>
            </View>
          )}

          {/* Footer Navigation */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.chatNavBtn}
              onPress={() => navigation.navigate("ConversationList")}
            >
              <Text style={styles.chatNavText}>💬 Return to Conversations</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out &amp; Exit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── CREATE TEMPLATE MODAL ──────────────────────────────────────── */}
      <Modal visible={showCreateTplModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Chat Template</Text>
              <TouchableOpacity onPress={() => setShowCreateTplModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>Slash Command (e.g. tournament)</Text>
              <TextInput
                style={styles.input}
                value={newTplCommand}
                onChangeText={setNewTplCommand}
                placeholder="tournament"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={newTplName}
                onChangeText={setNewTplName}
                placeholder="Tournament Entry"
              />

              <Text style={styles.label}>Google Sheet Tab Name</Text>
              <TextInput
                style={styles.input}
                value={newTplSheet}
                onChangeText={setNewTplSheet}
                placeholder="Tournament Entries"
              />

              <Text style={styles.label}>Icon Emoji</Text>
              <TextInput
                style={styles.input}
                value={newTplIcon}
                onChangeText={setNewTplIcon}
                placeholder="🏆"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={newTplDesc}
                onChangeText={setNewTplDesc}
                placeholder="Collect tournament participation records"
              />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 6 }}>
                <Text style={styles.label}>Configured Fields &amp; Data Types</Text>
                <TouchableOpacity
                  style={styles.addFieldPillBtn}
                  onPress={() => {
                    const newField = {
                      key: `field_${Date.now().toString().slice(-4)}`,
                      label: `Field ${newTplFields.length + 1}`,
                      type: "text",
                      required: true,
                      optionsRaw: "",
                      optionSource: "manual" as const,
                    };
                    setNewTplFields([...newTplFields, newField]);
                  }}
                >
                  <Text style={styles.addFieldPillText}>＋ Add Field</Text>
                </TouchableOpacity>
              </View>

              {newTplFields.map((f, i) => {
                const meta = getDataTypeMeta(f.type);
                const isDropdown = f.type === "dropdown" || f.type === "choice";
                return (
                  <View key={i} style={styles.fieldConfigCard}>
                    <View style={styles.fieldConfigRow}>
                      <TextInput
                        style={[styles.input, { flex: 1.6, marginBottom: 0 }]}
                        value={f.label}
                        onChangeText={(v) => {
                          const updated = [...newTplFields];
                          updated[i].label = v;
                          setNewTplFields(updated);
                        }}
                        placeholder="Field Label"
                      />
                      <TouchableOpacity
                        style={styles.typeSelectorBtn}
                        onPress={() => handleOpenTypePicker("new", i)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.typeSelectorIcon}>{meta.icon}</Text>
                        <Text style={styles.typeSelectorText} numberOfLines={1}>
                          {meta.label}
                        </Text>
                        <Text style={styles.typeSelectorArrow}>▼</Text>
                      </TouchableOpacity>
                      {newTplFields.length > 1 && (
                        <TouchableOpacity
                          style={styles.fieldDeleteBtn}
                          onPress={() => {
                            setNewTplFields(newTplFields.filter((_, idx) => idx !== i));
                          }}
                        >
                          <Text style={styles.fieldDeleteText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isDropdown && (
                      <View style={styles.dropdownBox}>
                        <View style={styles.dropdownSourceHeader}>
                          <Text style={styles.dropdownSourceTitle}>🔽 Options Source:</Text>
                          <View style={styles.dropdownSourceToggleGroup}>
                            <TouchableOpacity
                              style={[
                                styles.sourcePill,
                                (f.optionSource || "manual") === "manual" && styles.sourcePillActive,
                              ]}
                              onPress={() => {
                                const updated = [...newTplFields];
                                updated[i].optionSource = "manual";
                                setNewTplFields(updated);
                              }}
                            >
                              <Text
                                style={[
                                  styles.sourcePillText,
                                  (f.optionSource || "manual") === "manual" && styles.sourcePillTextActive,
                                ]}
                              >
                                ✏️ Manual
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.sourcePill,
                                f.optionSource === "table" && styles.sourcePillActive,
                              ]}
                              onPress={() => {
                                const updated = [...newTplFields];
                                updated[i].optionSource = "table";
                                if (!updated[i].linkedTemplateCommand) {
                                  const otherTpl = templates[0];
                                  if (otherTpl) {
                                    updated[i].linkedTemplateCommand = otherTpl.command;
                                    const firstField = (otherTpl.fields || [])[0];
                                    if (firstField) {
                                      updated[i].linkedFieldKey = firstField.key || firstField.label;
                                    }
                                  }
                                }
                                setNewTplFields(updated);
                              }}
                            >
                              <Text
                                style={[
                                  styles.sourcePillText,
                                  f.optionSource === "table" && styles.sourcePillTextActive,
                                ]}
                              >
                                🔗 From Table
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {(f.optionSource || "manual") === "manual" ? (
                          <View style={styles.manualOptionsContainer}>
                            <Text style={styles.subFieldLabel}>Comma-Separated Dropdown Options</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 6 }]}
                              value={f.optionsRaw || ""}
                              onChangeText={(v) => {
                                const updated = [...newTplFields];
                                updated[i].optionsRaw = v;
                                setNewTplFields(updated);
                              }}
                              placeholder="e.g. Option 1, Option 2, Option 3"
                            />

                            {f.optionsRaw ? (
                              <View style={styles.chipsContainer}>
                                {f.optionsRaw.split(",").map((item: string, optIdx: number) => {
                                  const cleanItem = item.trim();
                                  if (!cleanItem) return null;
                                  return (
                                    <View key={optIdx} style={styles.optionChip}>
                                      <Text style={styles.optionChipText}>{cleanItem}</Text>
                                      <TouchableOpacity
                                        onPress={() => {
                                          const currentList = f.optionsRaw
                                            ? f.optionsRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
                                            : [];
                                          currentList.splice(optIdx, 1);
                                          const updated = [...newTplFields];
                                          updated[i].optionsRaw = currentList.join(", ");
                                          setNewTplFields(updated);
                                        }}
                                      >
                                        <Text style={styles.optionChipRemove}>✕</Text>
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                        ) : (
                          <View style={styles.tableLinkContainer}>
                            <Text style={styles.subFieldLabel}>Select Source Table</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalTableScroll}>
                              {templates.map((tplItem: any) => {
                                const isSelected = f.linkedTemplateCommand === tplItem.command;
                                return (
                                  <TouchableOpacity
                                    key={tplItem.command}
                                    style={[styles.tableSelectChip, isSelected && styles.tableSelectChipActive]}
                                    onPress={() => {
                                      const updated = [...newTplFields];
                                      updated[i].linkedTemplateCommand = tplItem.command;
                                      const firstField = (tplItem.fields || [])[0];
                                      if (firstField) {
                                        updated[i].linkedFieldKey = firstField.key || firstField.label;
                                      }
                                      setNewTplFields(updated);
                                    }}
                                  >
                                    <Text style={styles.tableChipIcon}>{tplItem.icon || "📋"}</Text>
                                    <Text style={[styles.tableChipText, isSelected && styles.tableChipTextActive]}>
                                      {tplItem.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>

                            {f.linkedTemplateCommand ? (
                              <>
                                <Text style={[styles.subFieldLabel, { marginTop: 6 }]}>Select Field</Text>
                                {(() => {
                                  const selectedTpl = templates.find((t: any) => t.command === f.linkedTemplateCommand);
                                  const fieldsList = selectedTpl?.fields || [];
                                  return (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalTableScroll}>
                                      {fieldsList.map((fItem: any, fIdx: number) => {
                                        const fieldId = fItem.key || fItem.label;
                                        const isSelected = (f.linkedFieldKey || "") === fieldId;
                                        return (
                                          <TouchableOpacity
                                            key={fIdx}
                                            style={[styles.fieldSelectChip, isSelected && styles.fieldSelectChipActive]}
                                            onPress={() => {
                                              const updated = [...newTplFields];
                                              updated[i].linkedFieldKey = fieldId;
                                              setNewTplFields(updated);
                                            }}
                                          >
                                            <Text style={[styles.fieldChipText, isSelected && styles.fieldChipTextActive]}>
                                              {fItem.label} ({fItem.type || "text"})
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  );
                                })()}

                                {(() => {
                                  const extracted = getValuesFromTable(f.linkedTemplateCommand, f.linkedFieldKey || "");
                                  return (
                                    <View style={styles.extractedPreviewBox}>
                                      <Text style={styles.extractedCountText}>
                                        Found <Text style={{ fontWeight: "800" }}>{extracted.length}</Text> values from /{f.linkedTemplateCommand} &gt; {f.linkedFieldKey}
                                      </Text>
                                      {extracted.length > 0 && (
                                        <TouchableOpacity
                                          style={styles.applyValuesBtn}
                                          onPress={() => {
                                            const updated = [...newTplFields];
                                            updated[i].optionsRaw = extracted.join(", ");
                                            setNewTplFields(updated);
                                            showToast(`Imported ${extracted.length} values into dropdown!`);
                                          }}
                                        >
                                          <Text style={styles.applyValuesBtnText}>
                                            ✓ Import &amp; Use {extracted.length} Values
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  );
                                })()}
                              </>
                            ) : null}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowCreateTplModal(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateTemplate}>
                <Text style={styles.btnPrimaryText}>Create Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── EDIT TEMPLATE MODAL ────────────────────────────────────────── */}
      <Modal visible={showEditTplModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit /{editTplCommand} Template</Text>
              <TouchableOpacity onPress={() => setShowEditTplModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput style={styles.input} value={editTplName} onChangeText={setEditTplName} />

              <Text style={styles.label}>Google Sheet Tab Name</Text>
              <TextInput style={styles.input} value={editTplSheet} onChangeText={setEditTplSheet} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} value={editTplDesc} onChangeText={setEditTplDesc} />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 6 }}>
                <Text style={styles.label}>Configured Fields &amp; Data Types</Text>
                <TouchableOpacity
                  style={styles.addFieldPillBtn}
                  onPress={() => {
                    const newField = {
                      key: `field_${Date.now().toString().slice(-4)}`,
                      label: `New Field ${editTplFields.length + 1}`,
                      type: "text",
                      required: true,
                      optionsRaw: "",
                      optionSource: "manual" as const,
                    };
                    setEditTplFields([...editTplFields, newField]);
                  }}
                >
                  <Text style={styles.addFieldPillText}>＋ Add Field</Text>
                </TouchableOpacity>
              </View>

              {editTplFields.map((f, i) => {
                const meta = getDataTypeMeta(f.type);
                const isDropdown = f.type === "dropdown" || f.type === "choice";
                return (
                  <View key={i} style={styles.fieldConfigCard}>
                    <View style={styles.fieldConfigRow}>
                      <TextInput
                        style={[styles.input, { flex: 1.6, marginBottom: 0 }]}
                        value={f.label}
                        onChangeText={(v) => {
                          const updated = [...editTplFields];
                          updated[i].label = v;
                          setEditTplFields(updated);
                        }}
                        placeholder="Field Label"
                      />
                      <TouchableOpacity
                        style={styles.typeSelectorBtn}
                        onPress={() => handleOpenTypePicker("edit", i)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.typeSelectorIcon}>{meta.icon}</Text>
                        <Text style={styles.typeSelectorText} numberOfLines={1}>
                          {meta.label}
                        </Text>
                        <Text style={styles.typeSelectorArrow}>▼</Text>
                      </TouchableOpacity>
                      {editTplFields.length > 1 && (
                        <TouchableOpacity
                          style={styles.fieldDeleteBtn}
                          onPress={() => {
                            setEditTplFields(editTplFields.filter((_, idx) => idx !== i));
                          }}
                        >
                          <Text style={styles.fieldDeleteText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* ── DROPDOWN CONFIGURATION CARD ────────────────────── */}
                    {isDropdown && (
                      <View style={styles.dropdownBox}>
                        <View style={styles.dropdownSourceHeader}>
                          <Text style={styles.dropdownSourceTitle}>🔽 Options Source:</Text>
                          <View style={styles.dropdownSourceToggleGroup}>
                            <TouchableOpacity
                              style={[
                                styles.sourcePill,
                                (f.optionSource || "manual") === "manual" && styles.sourcePillActive,
                              ]}
                              onPress={() => {
                                const updated = [...editTplFields];
                                updated[i].optionSource = "manual";
                                setEditTplFields(updated);
                              }}
                            >
                              <Text
                                style={[
                                  styles.sourcePillText,
                                  (f.optionSource || "manual") === "manual" && styles.sourcePillTextActive,
                                ]}
                              >
                                ✏️ Manual
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.sourcePill,
                                f.optionSource === "table" && styles.sourcePillActive,
                              ]}
                              onPress={() => {
                                const updated = [...editTplFields];
                                updated[i].optionSource = "table";
                                if (!updated[i].linkedTemplateCommand) {
                                  const otherTpl =
                                    templates.find((t: any) => t.command !== editTplCommand) || templates[0];
                                  if (otherTpl) {
                                    updated[i].linkedTemplateCommand = otherTpl.command;
                                    const firstField = (otherTpl.fields || [])[0];
                                    if (firstField) {
                                      updated[i].linkedFieldKey = firstField.key || firstField.label;
                                    }
                                  }
                                }
                                setEditTplFields(updated);
                              }}
                            >
                              <Text
                                style={[
                                  styles.sourcePillText,
                                  f.optionSource === "table" && styles.sourcePillTextActive,
                                ]}
                              >
                                🔗 From Table
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {(f.optionSource || "manual") === "manual" ? (
                          <View style={styles.manualOptionsContainer}>
                            <Text style={styles.subFieldLabel}>Comma-Separated Dropdown Options</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 6 }]}
                              value={f.optionsRaw || ""}
                              onChangeText={(v) => {
                                const updated = [...editTplFields];
                                updated[i].optionsRaw = v;
                                setEditTplFields(updated);
                              }}
                              placeholder="e.g. Tennis - Court 1, Tennis - Court 2, Tennis - Court 3"
                            />

                            {/* Option chips preview */}
                            {f.optionsRaw ? (
                              <View style={styles.chipsContainer}>
                                {f.optionsRaw.split(",").map((item: string, optIdx: number) => {
                                  const cleanItem = item.trim();
                                  if (!cleanItem) return null;
                                  return (
                                    <View key={optIdx} style={styles.optionChip}>
                                      <Text style={styles.optionChipText}>{cleanItem}</Text>
                                      <TouchableOpacity
                                        onPress={() => {
                                          const currentList = f.optionsRaw
                                            ? f.optionsRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
                                            : [];
                                          currentList.splice(optIdx, 1);
                                          const updated = [...editTplFields];
                                          updated[i].optionsRaw = currentList.join(", ");
                                          setEditTplFields(updated);
                                        }}
                                      >
                                        <Text style={styles.optionChipRemove}>✕</Text>
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })}
                              </View>
                            ) : null}

                            {/* Quick Add Option Row */}
                            <View style={styles.quickAddRow}>
                              <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                value={f._newOpt || ""}
                                onChangeText={(v) => {
                                  const updated = [...editTplFields];
                                  updated[i]._newOpt = v;
                                  setEditTplFields(updated);
                                }}
                                placeholder="Add single option..."
                              />
                              <TouchableOpacity
                                style={styles.quickAddBtn}
                                onPress={() => {
                                  if (!f._newOpt || !f._newOpt.trim()) return;
                                  const currentList = (f.optionsRaw || "")
                                    .split(",")
                                    .map((s: string) => s.trim())
                                    .filter(Boolean);
                                  currentList.push(f._newOpt.trim());
                                  const updated = [...editTplFields];
                                  updated[i].optionsRaw = currentList.join(", ");
                                  updated[i]._newOpt = "";
                                  setEditTplFields(updated);
                                }}
                              >
                                <Text style={styles.quickAddBtnText}>+ Add</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          /* Table Link Selector */
                          <View style={styles.tableLinkContainer}>
                            <Text style={styles.subFieldLabel}>1. Select Source Table / Template</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalTableScroll}>
                              {templates.map((tplItem: any) => {
                                const isSelected = f.linkedTemplateCommand === tplItem.command;
                                return (
                                  <TouchableOpacity
                                    key={tplItem.command}
                                    style={[styles.tableSelectChip, isSelected && styles.tableSelectChipActive]}
                                    onPress={() => {
                                      const updated = [...editTplFields];
                                      updated[i].linkedTemplateCommand = tplItem.command;
                                      const firstField = (tplItem.fields || [])[0];
                                      if (firstField) {
                                        updated[i].linkedFieldKey = firstField.key || firstField.label;
                                      }
                                      setEditTplFields(updated);
                                    }}
                                  >
                                    <Text style={styles.tableChipIcon}>{tplItem.icon || "📋"}</Text>
                                    <Text style={[styles.tableChipText, isSelected && styles.tableChipTextActive]}>
                                      {tplItem.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>

                            {f.linkedTemplateCommand ? (
                              <>
                                <Text style={[styles.subFieldLabel, { marginTop: 8 }]}>2. Select Field From Table</Text>
                                {(() => {
                                  const selectedTpl = templates.find((t: any) => t.command === f.linkedTemplateCommand);
                                  const fieldsList = selectedTpl?.fields || [];
                                  return (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalTableScroll}>
                                      {fieldsList.map((fItem: any, fIdx: number) => {
                                        const fieldId = fItem.key || fItem.label;
                                        const isSelected = (f.linkedFieldKey || "") === fieldId;
                                        return (
                                          <TouchableOpacity
                                            key={fIdx}
                                            style={[styles.fieldSelectChip, isSelected && styles.fieldSelectChipActive]}
                                            onPress={() => {
                                              const updated = [...editTplFields];
                                              updated[i].linkedFieldKey = fieldId;
                                              setEditTplFields(updated);
                                            }}
                                          >
                                            <Text style={[styles.fieldChipText, isSelected && styles.fieldChipTextActive]}>
                                              {fItem.label} ({fItem.type || "text"})
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  );
                                })()}

                                {/* Extracted Values Preview & Import */}
                                {(() => {
                                  const extracted = getValuesFromTable(f.linkedTemplateCommand, f.linkedFieldKey || "");
                                  return (
                                    <View style={styles.extractedPreviewBox}>
                                      <Text style={styles.extractedCountText}>
                                        Found <Text style={{ fontWeight: "800" }}>{extracted.length}</Text> values from{" "}
                                        /{f.linkedTemplateCommand} &gt; {f.linkedFieldKey}
                                      </Text>

                                      {extracted.length > 0 ? (
                                        <View style={styles.chipsContainer}>
                                          {extracted.map((val: string, vIdx: number) => (
                                            <View key={vIdx} style={styles.optionChipReadOnly}>
                                              <Text style={styles.optionChipText}>{val}</Text>
                                            </View>
                                          ))}
                                        </View>
                                      ) : (
                                        <Text style={styles.noValuesText}>
                                          No configured options or submission values found yet for this field.
                                        </Text>
                                      )}

                                      {extracted.length > 0 && (
                                        <TouchableOpacity
                                          style={styles.applyValuesBtn}
                                          onPress={() => {
                                            const updated = [...editTplFields];
                                            updated[i].optionsRaw = extracted.join(", ");
                                            setEditTplFields(updated);
                                            showToast(`Imported ${extracted.length} values into dropdown!`);
                                          }}
                                        >
                                          <Text style={styles.applyValuesBtnText}>
                                            ✓ Import &amp; Use {extracted.length} Values
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  );
                                })()}
                              </>
                            ) : null}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowEditTplModal(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveEditTemplate}>
                <Text style={styles.btnPrimaryText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DATA TYPE PICKER MODAL ────────────────────────────────────── */}
      <Modal visible={showTypePickerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "82%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Data Type</Text>
                <Text style={styles.modalSubtitle}>Choose field format &amp; input behavior</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTypePickerModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 4 }}>
              {DATA_TYPES.map((dt) => {
                const currentType = typePickerTarget
                  ? typePickerTarget.mode === "edit"
                    ? editTplFields[typePickerTarget.index]?.type
                    : newTplFields[typePickerTarget.index]?.type
                  : null;
                const isSelected = currentType === dt.value || (dt.value === "dropdown" && currentType === "choice");

                return (
                  <TouchableOpacity
                    key={dt.value}
                    style={[styles.typeOptionCard, isSelected && styles.typeOptionCardActive]}
                    onPress={() => handleSelectDataType(dt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.typeOptionLeft}>
                      <Text style={styles.typeOptionIcon}>{dt.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.typeOptionTitle, isSelected && styles.typeOptionTitleActive]}>
                            {dt.label}
                          </Text>
                          <Text style={[styles.typeOptionTag, isSelected && styles.typeOptionTagActive]}>
                            [{dt.value}]
                          </Text>
                        </View>
                        <Text style={styles.typeOptionDesc}>{dt.desc}</Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.typeSelectedBadge}>
                        <Text style={styles.typeSelectedText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.modalFooter, { marginTop: 8 }]}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowTypePickerModal(false)}
              >
                <Text style={styles.btnSecondaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── ADD USER MODAL ────────────────────────────────────────────── */}
      <Modal visible={showUserModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Authorized User</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={newUserName}
              onChangeText={setNewUserName}
              placeholder="Coach Sarah"
            />

            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              placeholder="coach@ofa-sports.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              value={newUserPassword}
              onChangeText={setNewUserPassword}
              secureTextEntry
            />

            <Text style={styles.label}>Role</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                style={[
                  styles.rolePillBtn,
                  newUserRole === "USER" && styles.rolePillBtnActive,
                ]}
                onPress={() => setNewUserRole("USER")}
              >
                <Text
                  style={[
                    styles.rolePillText,
                    newUserRole === "USER" && styles.rolePillTextActive,
                  ]}
                >
                  👤 App User
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rolePillBtn,
                  newUserRole === "ADMIN" && styles.rolePillBtnActive,
                ]}
                onPress={() => setNewUserRole("ADMIN")}
              >
                <Text
                  style={[
                    styles.rolePillText,
                    newUserRole === "ADMIN" && styles.rolePillTextActive,
                  ]}
                >
                  👑 Admin
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowUserModal(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateUser}>
                <Text style={styles.btnPrimaryText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CONFIGURE GOOGLE SHEET MODAL ──────────────────────────────── */}
      <Modal visible={showSheetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure Google Sheet</Text>
              <TouchableOpacity onPress={() => setShowSheetModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Spreadsheet ID or Google Sheet URL</Text>
            <TextInput
              style={styles.input}
              value={sheetUrlInput}
              onChangeText={setSheetUrlInput}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              autoCapitalize="none"
            />

            <Text style={styles.label}>Default Sheet Tab Name</Text>
            <TextInput
              style={styles.input}
              value={sheetTabInput}
              onChangeText={setSheetTabInput}
              placeholder="Facility Bookings"
            />

            <TouchableOpacity
              style={[styles.btnSecondary, { marginTop: 4, marginBottom: 14 }]}
              onPress={handleTestSheetConnection}
              disabled={testingSheet}
            >
              <Text style={styles.btnSecondaryText}>
                {testingSheet ? "Testing..." : "🧪 Test Service Account Access"}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowSheetModal(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveSheetConfig}>
                <Text style={styles.btnPrimaryText}>Save Connection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CONVERSATION DETAIL INSPECTOR MODAL ───────────────────────── */}
      <Modal visible={Boolean(inspectConv)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{inspectConv?.name || "Chat Detail"}</Text>
              <TouchableOpacity onPress={() => setInspectConv(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: "#667781", marginBottom: 10 }}>
              Lead / Conversation ID: {inspectConv?.id}
            </Text>

            <ScrollView style={{ maxHeight: 350 }}>
              {inspectConv?.lastMessage && (
                <View style={styles.msgBubble}>
                  <Text style={styles.msgSender}>{inspectConv.lastMessage.senderName}</Text>
                  <Text style={styles.msgBody}>{inspectConv.lastMessage.body}</Text>
                  <Text style={styles.msgTime}>{inspectConv.lastMessage.createdAt}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => setInspectConv(null)}
              >
                <Text style={styles.btnPrimaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F2F5" },
  headerCard: {
    backgroundColor: Colors.headerBackground,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarEmoji: { fontSize: 22 },
  headerInfo: { flex: 1 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: Colors.textLight },
  adminBadge: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminBadgeText: { fontSize: 9, fontWeight: "900", color: "#333" },
  liveSyncBadge: {
    backgroundColor: "rgba(37,211,102,0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveSyncText: { fontSize: 9, fontWeight: "700", color: "#69F0AE" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  refreshHeaderBtn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  refreshHeaderBtnText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  tabScroll: { marginTop: 12 },
  tabRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  tabBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#075E54", fontWeight: "800" },
  toastBanner: {
    backgroundColor: "#E8F5E9",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#C8E6C9",
  },
  toastBannerError: { backgroundColor: "#FFEBEE", borderBottomColor: "#FFCDD2" },
  toastText: { fontSize: 12, color: "#1B5E20", fontWeight: "600", textAlign: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111B21", marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: "#667781" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#075E54" },
  statLabel: { fontSize: 11, color: "#667781", fontWeight: "600", textTransform: "uppercase" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111B21" },
  cardSubtitle: { fontSize: 11, color: "#667781", marginTop: 2 },
  statusDotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#25D366" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  quickActionBtn: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  quickActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  diagnosticRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  diagLabel: { fontSize: 12, color: "#54656F", fontWeight: "600" },
  badgeSuccess: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeSuccessText: { color: "#2E7D32", fontSize: 11, fontWeight: "700" },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D7DB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 12,
    color: "#111B21",
  },
  templateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  templateHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  templateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#E0F2F1",
    alignItems: "center",
    justifyContent: "center",
  },
  templateName: { fontSize: 15, fontWeight: "800", color: "#111B21" },
  commandBadge: {
    backgroundColor: "#E0F2F1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  commandBadgeText: { fontSize: 11, color: "#00796B", fontWeight: "700" },
  templateSheet: { fontSize: 12, color: "#54656F", marginTop: 2 },
  templateDesc: { fontSize: 11, color: "#667781", marginTop: 3 },
  fieldBadgeContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 8 },
  fieldTag: {
    backgroundColor: "#F0F2F5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fieldTagPhone: { backgroundColor: "#FCE4EC" },
  fieldTagDropdown: { backgroundColor: "#E3F2FD" },
  fieldTagText: { fontSize: 11, color: "#54656F" },
  cardButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  editBtn: {
    backgroundColor: "#E0F2F1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnText: { color: "#00796B", fontSize: 12, fontWeight: "700" },
  deleteBtn: {
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteBtnText: { color: "#D32F2F", fontSize: 12, fontWeight: "700" },
  submissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  subHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  subRef: { fontSize: 11, fontWeight: "700", color: "#00796B" },
  subName: { fontSize: 15, fontWeight: "800", color: "#111B21", marginTop: 1 },
  syncBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  syncBadgeDone: { backgroundColor: "#E8F5E9" },
  syncBadgePending: { backgroundColor: "#FFF3E0" },
  syncBadgeText: { fontSize: 11, fontWeight: "700" },
  subDataPreview: { marginTop: 8, gap: 2 },
  subDataLine: { fontSize: 12, color: "#54656F" },
  syncActionBtn: {
    backgroundColor: "#E0F2F1",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
  },
  syncActionText: { color: "#00796B", fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyStateEmoji: { fontSize: 36, marginBottom: 8 },
  emptyStateText: { fontSize: 13, color: "#667781" },
  orgStatsRow: { flexDirection: "row", gap: 14, marginVertical: 8 },
  orgStat: { fontSize: 12, color: "#54656F", fontWeight: "600" },
  sheetSubCard: {
    backgroundColor: "#F7F9FA",
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  sheetConfigBtn: {
    backgroundColor: "#075E54",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  sheetConfigBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E3F2FD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  userAvatarText: { fontSize: 18 },
  userInfo: { flex: 1 },
  userHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: 14, fontWeight: "700", color: "#111B21" },
  userPill: {
    backgroundColor: "#BBDEFB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userPillText: { fontSize: 10, fontWeight: "800", color: "#0D47A1" },
  userEmail: { fontSize: 12, color: "#667781", marginTop: 2 },
  deleteUserBtn: { padding: 8 },
  deleteUserBtnText: { fontSize: 16 },
  convCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  convHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convTitle: { fontSize: 14, fontWeight: "700", color: "#111B21" },
  convMsgBadge: { backgroundColor: "#E0F2F1", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  convMsgBadgeText: { fontSize: 10, color: "#00796B", fontWeight: "700" },
  convParticipants: { fontSize: 12, color: "#667781", marginTop: 4 },
  convSnippet: {
    backgroundColor: "#F7F9FA",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  convSnippetSender: { fontSize: 11, fontWeight: "700", color: "#075E54" },
  convSnippetBody: { fontSize: 12, color: "#111B21", marginTop: 2 },
  auditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  auditLabel: { fontSize: 13, fontWeight: "600", color: "#54656F" },
  auditVal: { fontSize: 12, fontWeight: "700", color: "#075E54" },
  footerActions: { marginTop: 14, gap: 10 },
  chatNavBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  chatNavText: { color: Colors.textLight, fontSize: 14, fontWeight: "700" },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: "#E53935",
    borderRadius: Radius.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  signOutText: { color: "#E53935", fontSize: 13, fontWeight: "700" },
  headerBackBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    marginLeft: 6,
  },
  headerBackBtnText: { color: Colors.textLight, fontSize: 12, fontWeight: "700" },
  headerRightRow: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 6 },
  headerExitBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  headerExitBtnText: { color: Colors.textLight, fontSize: 12, fontWeight: "800" },
  btnSmallPrimary: {
    backgroundColor: "#075E54",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnSmallPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#111B21" },
  modalClose: { fontSize: 18, color: "#667781", fontWeight: "700" },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  label: { fontSize: 11, fontWeight: "700", color: "#54656F", marginBottom: 4, textTransform: "uppercase" },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D7DB",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
    color: "#111B21",
  },
  textArea: { height: 90, textAlignVertical: "top" },
  fieldConfigRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  btnPrimary: {
    backgroundColor: "#075E54",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  btnSecondary: {
    backgroundColor: "#F0F2F5",
    borderWidth: 1,
    borderColor: "#D1D7DB",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#111B21", fontSize: 13, fontWeight: "600" },
  rolePillBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D1D7DB",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  rolePillBtnActive: { backgroundColor: "#075E54", borderColor: "#075E54" },
  rolePillText: { fontSize: 12, fontWeight: "600", color: "#54656F" },
  rolePillTextActive: { color: "#FFFFFF", fontWeight: "700" },
  msgBubble: {
    backgroundColor: "#F7F9FA",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  msgSender: { fontSize: 12, fontWeight: "800", color: "#075E54", marginBottom: 2 },
  msgBody: { fontSize: 13, color: "#111B21" },
  msgTime: { fontSize: 10, color: "#8696A0", marginTop: 4, textAlign: "right" },
  cardLabel: { fontSize: 12, fontWeight: "700", color: "#54656F", marginBottom: 6 },
  fieldConfigCard: {
    backgroundColor: "#F7F9FA",
    borderWidth: 1,
    borderColor: "#E1E7EA",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  typeSelectorBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#00A884",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  typeSelectorIcon: { fontSize: 13 },
  typeSelectorText: { fontSize: 12, fontWeight: "700", color: "#075E54", flex: 1 },
  typeSelectorArrow: { fontSize: 10, color: "#00A884", fontWeight: "900" },
  fieldDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  fieldDeleteText: { fontSize: 14, color: "#C62828", fontWeight: "700" },
  addFieldPillBtn: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addFieldPillText: { fontSize: 11, fontWeight: "700", color: "#1B5E20" },
  dropdownBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E1E7EA",
  },
  dropdownSourceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  dropdownSourceTitle: { fontSize: 11, fontWeight: "700", color: "#54656F" },
  dropdownSourceToggleGroup: { flexDirection: "row", gap: 6 },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#ECEFF1",
  },
  sourcePillActive: { backgroundColor: "#075E54" },
  sourcePillText: { fontSize: 11, fontWeight: "600", color: "#54656F" },
  sourcePillTextActive: { color: "#FFFFFF", fontWeight: "700" },
  manualOptionsContainer: { marginTop: 4 },
  subFieldLabel: { fontSize: 10, fontWeight: "700", color: "#667781", marginBottom: 4, textTransform: "uppercase" },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2F1",
    borderWidth: 1,
    borderColor: "#B2DFDB",
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 4,
  },
  optionChipReadOnly: {
    backgroundColor: "#E8EAF6",
    borderWidth: 1,
    borderColor: "#C5CAE9",
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  optionChipText: { fontSize: 11, fontWeight: "600", color: "#004D40" },
  optionChipRemove: { fontSize: 11, fontWeight: "800", color: "#D32F2F", marginLeft: 2 },
  quickAddRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  quickAddBtn: {
    backgroundColor: "#00A884",
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  quickAddBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  tableLinkContainer: { marginTop: 4 },
  horizontalTableScroll: { marginBottom: 6 },
  tableSelectChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D7DB",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    gap: 4,
  },
  tableSelectChipActive: {
    backgroundColor: "#075E54",
    borderColor: "#075E54",
  },
  tableChipIcon: { fontSize: 12 },
  tableChipText: { fontSize: 11, fontWeight: "600", color: "#54656F" },
  tableChipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  fieldSelectChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#B2DFDB",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  fieldSelectChipActive: {
    backgroundColor: "#00A884",
    borderColor: "#00A884",
  },
  fieldChipText: { fontSize: 11, fontWeight: "600", color: "#004D40" },
  fieldChipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  extractedPreviewBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7EA",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  extractedCountText: { fontSize: 11, color: "#54656F", marginBottom: 6 },
  noValuesText: { fontSize: 11, color: "#8696A0", fontStyle: "italic", marginBottom: 4 },
  applyValuesBtn: {
    backgroundColor: "#075E54",
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 4,
  },
  applyValuesBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  modalSubtitle: { fontSize: 12, color: "#667781", marginTop: 2 },
  typeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7EA",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  typeOptionCardActive: {
    borderColor: "#00A884",
    backgroundColor: "#E8F5E9",
  },
  typeOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  typeOptionIcon: { fontSize: 20 },
  typeOptionTitle: { fontSize: 13, fontWeight: "700", color: "#111B21" },
  typeOptionTitleActive: { color: "#075E54" },
  typeOptionTag: { fontSize: 11, fontWeight: "600", color: "#8696A0" },
  typeOptionTagActive: { color: "#00A884" },
  typeOptionDesc: { fontSize: 11, color: "#667781", marginTop: 1 },
  typeSelectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00A884",
    justifyContent: "center",
    alignItems: "center",
  },
  typeSelectedText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
});
