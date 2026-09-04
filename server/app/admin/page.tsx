"use client";

import React, { useState, useEffect, useCallback } from "react";

// --- Types ---

interface OverviewStats {
  totalTenants: number;
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalSheets: number;
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    userCount: number;
    groupCount: number;
    hasSheet: boolean;
    createdAt: string;
  }>;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  userCount: number;
  groupCount: number;
  sheetConnection: {
    id: string;
    spreadsheetId: string;
    sheetName: string;
    authMode: string;
  } | null;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  createdAt: string;
}

interface GroupItem {
  id: string;
  name: string;
  kind: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  messageCount: number;
  createdAt: string;
  participants: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
}

interface ConversationItem {
  id: string;
  name: string;
  kind: string;
  tenantId: string;
  tenantName: string;
  totalMessages: number;
  createdAt: string;
  updatedAt: string;
  participants: Array<{ name: string; email: string; role: string }>;
  lastMessage: { senderName: string; body: string; createdAt: string } | null;
}

interface ConversationDetail {
  id: string;
  name: string;
  kind: string;
  tenantName: string;
  createdAt: string;
  participants: Array<{ id: string; name: string; email: string; role: string }>;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    body: string;
    kind: string;
    createdAt: string;
  }>;
}

interface SystemHealth {
  uptimeSeconds: number;
  timestamp: string;
  services: {
    database: { name: string; status: string; latencyMs: number };
    realtime: { name: string; status: string; latencyMs: number; connectedClients: number };
    ai: { name: string; status: string; model: string };
  };
}

interface AISettings {
  hasApiKey: boolean;
  maskedApiKey: string;
  model: string;
  systemPrompt: string;
  availableModels: string[];
}

interface TemplateItem {
  id: string;
  tenantId: string;
  command: string;
  name: string;
  description: string | null;
  sheetName: string;
  icon: string | null;
  fields: Array<{ key: string; label: string; required: boolean; type?: string; placeholder?: string }>;
  promptMessage: string;
  createdAt: string;
  updatedAt: string;
}

interface SubmissionItem {
  id: string;
  submissionRef: string | null;
  tenantId: string;
  conversationId: string | null;
  templateId: string | null;
  templateCommand: string;
  sheetName: string;
  userName: string | null;
  userPhone: string | null;
  data: Record<string, any>;
  rawMessage: string | null;
  status: string;
  syncedToSheet: boolean;
  createdAt: string;
  updatedAt: string;
  template?: { name: string; command: string; icon: string | null } | null;
}

// --- Super Admin Login Gate ---

function SuperAdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem("sa_token", data.token);
        onLogin();
      } else {
        setError("Invalid credentials. Check SUPER_ADMIN_EMAIL & SUPER_ADMIN_PASSWORD in .env");
      }
    } catch {
      setError("Cannot connect to server. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={ls.page}>
      <div style={ls.card}>
        <div style={ls.iconWrap}>OFA</div>
        <h1 style={ls.title}>OFA Sports</h1>
        <p style={ls.subtitle}>Super Admin Control Panel</p>

        {error && <div style={ls.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={ls.fieldGroup}>
            <label style={ls.label}>Admin Email</label>
            <input
              type="email"
              style={ls.input}
              placeholder="admin@ofa-sports.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div style={ls.fieldGroup}>
            <label style={ls.label}>Password</label>
            <input
              type="password"
              style={ls.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" style={ls.btn} disabled={loading}>
            {loading ? "Authenticating..." : "Access Admin Panel"}
          </button>
        </form>

        <p style={ls.hint}>
          Credentials governed by <code>SUPER_ADMIN_EMAIL</code> &amp;{" "}
          <code>SUPER_ADMIN_PASSWORD</code> in <code>server/.env</code>
        </p>
      </div>
    </div>
  );
}

const ls: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #075E54 0%, #128C7E 60%, #25D366 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    textAlign: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #075E54, #25D366)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: 1,
  },
  title: { fontSize: 24, fontWeight: 800, color: "#111B21", margin: "0 0 4px" },
  subtitle: { fontSize: 14, color: "#667781", margin: "0 0 24px" },
  errorBanner: {
    background: "#FFEBEE",
    color: "#C62828",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "left",
    borderLeft: "4px solid #C62828",
  },
  fieldGroup: { marginBottom: 16, textAlign: "left" },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#54656F",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #D1D7DB",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    color: "#111B21",
  },
  btn: {
    width: "100%",
    padding: "12px",
    background: "linear-gradient(135deg, #00A884, #128C7E)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  hint: { fontSize: 12, color: "#8696A0", marginTop: 20, lineHeight: 1.5 },
};

// --- Main Page Component ---

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("sa_token");
    setIsAuthenticated(Boolean(token));
  }, []);

  if (isAuthenticated === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F0F2F5" }}>
        <div style={s.spinner} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SuperAdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <AdminPanel
      onLogout={() => {
        sessionStorage.removeItem("sa_token");
        setIsAuthenticated(false);
      }}
    />
  );
}

// --- Admin Panel ---

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "templates" | "orgs" | "groups" | "users" | "conversations" | "ai" | "audit" | "settings">("overview");

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTplCommand, setNewTplCommand] = useState("");
  const [newTplName, setNewTplName] = useState("");
  const [newTplDesc, setNewTplDesc] = useState("");
  const [newTplSheetName, setNewTplSheetName] = useState("");
  const [newTplIcon, setNewTplIcon] = useState("📋");
  const [newTplFields, setNewTplFields] = useState<Array<{ key: string; label: string; required: boolean; type: string }>>([
    { key: "full_name", label: "Full Name", required: true, type: "text" },
    { key: "phone_number", label: "Phone Number", required: true, type: "phone" },
    { key: "details", label: "Details / Notes", required: true, type: "text" },
  ]);
  const [seedingTemplates, setSeedingTemplates] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [submissionStats, setSubmissionStats] = useState<{ total: number; synced: number; pending: number }>({
    total: 0,
    synced: 0,
    pending: 0,
  });
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [submissionSearch, setSubmissionSearch] = useState("");

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal states
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgSheetUrl, setNewOrgSheetUrl] = useState("");
  const [newOrgSheetName, setNewOrgSheetName] = useState("Bookings");

  const [editingSheetOrg, setEditingSheetOrg] = useState<Organization | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [sheetTabNameInput, setSheetTabNameInput] = useState("Bookings");
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ ok: boolean; message: string; tabs?: string[]; email?: string } | null>(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Welcome@123");
  const [newUserRole, setNewUserRole] = useState<"USER" | "ADMIN">("USER");
  const [newUserTenantId, setNewUserTenantId] = useState("");

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTenantId, setNewGroupTenantId] = useState("");
  const [newGroupKind, setNewGroupKind] = useState<"GROUP" | "AI" | "DIRECT">("GROUP");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  // Conversation inspector modal
  const [inspectingConv, setInspectingConv] = useState<ConversationDetail | null>(null);
  const [loadingConvDetail, setLoadingConvDetail] = useState(false);

  // AI settings
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState("");
  const [systemPromptInput, setSystemPromptInput] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingAiSettings, setSavingAiSettings] = useState(false);

  // Searches
  const [orgSearch, setOrgSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [convSearch, setConvSearch] = useState("");

  const showToast = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const authHeaders = (): Record<string, string> => ({
    "Content-Type": "application/json",
    "x-sa-token": sessionStorage.getItem("sa_token") ?? "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, orgsRes, usersRes, groupsRes, convRes, healthRes, aiRes, templatesRes, submissionsRes] = await Promise.all([
        fetch("/api/admin/overview", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/organizations", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/users", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/groups", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/conversations", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/system-health", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/ai-settings", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/templates", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/submissions", { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ ok: false })),
      ]);

      if (overviewRes.ok) setOverview(overviewRes.data);
      if (orgsRes.ok) {
        setOrgs(orgsRes.data);
        if (orgsRes.data.length > 0) {
          setNewUserTenantId((prev) => prev || orgsRes.data[0].id);
          setNewGroupTenantId((prev) => prev || orgsRes.data[0].id);
        }
      }
      if (usersRes.ok) setUsers(usersRes.data);
      if (groupsRes.ok) setGroups(groupsRes.data);
      if (convRes.ok) setConversations(convRes.data);
      if (healthRes.ok) setSystemHealth(healthRes.data);
      if (aiRes.ok) {
        setAiSettings(aiRes.data);
        setSelectedAiModel(aiRes.data.model);
        setSystemPromptInput(aiRes.data.systemPrompt);
      }
      if (templatesRes.ok && Array.isArray(templatesRes.data)) {
        setTemplates(templatesRes.data);
      }
      if (submissionsRes?.ok && submissionsRes.data) {
        setSubmissions(submissionsRes.data.submissions || []);
        if (submissionsRes.data.stats) {
          setSubmissionStats(submissionsRes.data.stats);
        }
      }
    } catch {
      showToast("error", "Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplCommand.trim() || !newTplName.trim()) return;
    setCreatingTemplate(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          command: newTplCommand.trim(),
          name: newTplName.trim(),
          description: newTplDesc.trim() || undefined,
          sheetName: newTplSheetName.trim() || `${newTplName.trim()} Records`,
          icon: newTplIcon.trim() || "📋",
          fields: newTplFields.filter((f) => f.label.trim().length > 0),
          autoCreateSheet: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", `Template "/${newTplCommand}" & Google Sheet tab created!`);
        setShowTemplateModal(false);
        setNewTplCommand("");
        setNewTplName("");
        setNewTplDesc("");
        setNewTplSheetName("");
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to create template");
      }
    } catch {
      showToast("error", "Request failed");
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (command: string, sheetName: string) => {
    if (!window.confirm(`Are you sure you want to delete template "/${command}"?\n\n🛡️ NOTE: All existing Google Sheet tabs ("${sheetName}") and submitted data will remain preserved!`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/templates?command=${encodeURIComponent(command)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", `Template "/${command}" deleted. Google Sheet data was preserved.`);
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to delete template");
      }
    } catch {
      showToast("error", "Request failed");
    }
  };

  const handleSeedSportsTemplates = async () => {
    setSeedingTemplates(true);
    try {
      const res = await fetch("/api/admin/templates/seed", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", data.data?.message || "Seeded 8 Sports Foundation templates & sheets!");
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to seed templates");
      }
    } catch {
      showToast("error", "Request failed");
    } finally {
      setSeedingTemplates(false);
    }
  };

  const handleSyncOneSubmission = async (subId: string) => {
    setSyncingId(subId);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "sync_one", submissionId: subId }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", "Successfully synced record to Google Sheets!");
        fetchData();
      } else {
        showToast("error", data.error?.message || "Sync failed");
      }
    } catch {
      showToast("error", "Failed to sync to Google Sheets");
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAllSubmissions = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "sync_all" }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", data.data?.message || "All records synced to Google Sheets!");
        fetchData();
      } else {
        showToast("error", data.error?.message || "Batch sync failed");
      }
    } catch {
      showToast("error", "Failed to batch sync");
    } finally {
      setSyncingAll(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: newOrgName.trim(),
          slug: newOrgSlug.trim() || undefined,
          sheetUrl: newOrgSheetUrl.trim() || undefined,
          sheetName: newOrgSheetName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", `"${newOrgName}" created successfully!`);
        setShowOrgModal(false);
        setNewOrgName(""); setNewOrgSlug(""); setNewOrgSheetUrl("");
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to create organization");
      }
    } catch {
      showToast("error", "Request failed");
    }
  };

  const handleSaveSheetConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSheetOrg) return;
    try {
      const res = await fetch(`/api/admin/organizations/${editingSheetOrg.id}/sheet`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          spreadsheetIdOrUrl: sheetUrlInput.trim(),
          sheetName: sheetTabNameInput.trim() || "Bookings",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", `Google Sheet configured for "${editingSheetOrg.name}"!`);
        setEditingSheetOrg(null);
        setSheetTestResult(null);
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to save configuration");
      }
    } catch {
      showToast("error", "Request failed");
    }
  };

  const handleTestSheetConnection = async () => {
    if (!sheetUrlInput.trim()) return;
    setTestingSheet(true);
    setSheetTestResult(null);
    try {
      const res = await fetch("/api/admin/sheet-test", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ spreadsheetIdOrUrl: sheetUrlInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setSheetTestResult({
          ok: true,
          message: data.data.message,
          tabs: data.data.tabs,
          email: data.data.serviceAccountEmail,
        });
      } else {
        setSheetTestResult({
          ok: false,
          message: data.error?.message || "Cannot access spreadsheet",
        });
      }
    } catch {
      setSheetTestResult({ ok: false, message: "Network error testing spreadsheet" });
    } finally {
      setTestingSheet(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword.trim() || !newUserTenantId) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: newUserName.trim() || undefined,
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
          tenantId: newUserTenantId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", `"${newUserEmail}" added successfully!`);
        setShowUserModal(false);
        setNewUserName(""); setNewUserEmail("");
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to add user");
      }
    } catch {
      showToast("error", "Request failed");
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to remove user "${email}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", `User "${email}" deleted successfully`);
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to delete user");
      }
    } catch {
      showToast("error", "Request failed");
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupTenantId) return;
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: newGroupName.trim(),
          tenantId: newGroupTenantId,
          kind: newGroupKind,
          participantIds: selectedParticipantIds,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", `"${newGroupName}" created!`);
        setShowGroupModal(false);
        setNewGroupName(""); setSelectedParticipantIds([]);
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to create group");
      }
    } catch {
      showToast("error", "Request failed");
    }
  };

  const handleInspectConversation = async (convId: string) => {
    setLoadingConvDetail(true);
    try {
      const res = await fetch(`/api/admin/conversations?id=${encodeURIComponent(convId)}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setInspectingConv(data.data);
      } else {
        showToast("error", data.error?.message || "Failed to load conversation");
      }
    } catch {
      showToast("error", "Request failed");
    } finally {
      setLoadingConvDetail(false);
    }
  };

  const exportConversationsToCsv = () => {
    if (conversations.length === 0) return;
    const rows = [
      ["Organization", "Conversation Name", "Type", "Total Messages", "Last Message", "Created At"],
      ...conversations.map((c) => [
        `"${c.tenantName}"`,
        `"${c.name}"`,
        `"${c.kind}"`,
        c.totalMessages,
        `"${(c.lastMessage?.body || "").replace(/"/g, '""')}"`,
        `"${c.createdAt}"`,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ofa_chat_inquiries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAiSettings = async () => {
    setSavingAiSettings(true);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          apiKey: apiKeyInput.trim() || undefined,
          model: selectedAiModel,
          systemPrompt: systemPromptInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", "AI settings saved globally!");
        setApiKeyInput("");
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed to save AI settings");
      }
    } catch {
      showToast("error", "Request failed");
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleTestAiConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          apiKey: apiKeyInput.trim() || undefined,
          model: selectedAiModel,
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("success", "Connection successful: " + data.message);
      } else {
        showToast("error", "Connection failed: " + (data.error?.message || "Unknown error"));
      }
    } catch {
      showToast("error", "Request failed");
    } finally {
      setTestingConnection(false);
    }
  };

  const filteredOrgs = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      o.slug.toLowerCase().includes(orgSearch.toLowerCase())
  );
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.tenantName.toLowerCase().includes(userSearch.toLowerCase())
  );
  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
      g.tenantName.toLowerCase().includes(groupSearch.toLowerCase())
  );
  const filteredConversations = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(convSearch.toLowerCase()) ||
      c.tenantName.toLowerCase().includes(convSearch.toLowerCase()) ||
      (c.lastMessage?.body && c.lastMessage.body.toLowerCase().includes(convSearch.toLowerCase()))
  );

  const filteredSubmissions = submissions.filter((sub) => {
    const q = submissionSearch.toLowerCase();
    if (!q) return true;
    return (
      (sub.submissionRef && sub.submissionRef.toLowerCase().includes(q)) ||
      (sub.userName && sub.userName.toLowerCase().includes(q)) ||
      (sub.userPhone && sub.userPhone.toLowerCase().includes(q)) ||
      sub.templateCommand.toLowerCase().includes(q) ||
      sub.sheetName.toLowerCase().includes(q) ||
      (sub.rawMessage && sub.rawMessage.toLowerCase().includes(q)) ||
      Object.values(sub.data || {}).some((v) => String(v).toLowerCase().includes(q))
    );
  });

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "templates", label: `Templates & Submissions (${templates.length})` },
    { key: "orgs", label: `Organizations (${orgs.length})` },
    { key: "groups", label: `Groups (${groups.length})` },
    { key: "users", label: `Users (${users.length})` },
    { key: "conversations", label: `Chats & Leads (${conversations.length})` },
    { key: "ai", label: "AI Agent" },
    { key: "audit", label: "Security" },
    { key: "settings", label: "System" },
  ];

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerContent}>
          <div style={s.brandGroup}>
            <div style={s.brandIconWrap}>OFA</div>
            <div>
              <h1 style={s.brandTitle}>OFA Sports — Super Admin Panel</h1>
              <p style={s.brandSubtitle}>Organizations • Users • Live Chats • Groq AI • Google Sheets</p>
            </div>
          </div>
          <div style={s.headerActions}>
            <span style={s.badgeLive}>Protected &amp; Verified</span>
            <a href="/api/health" target="_blank" style={s.healthLink}>API Health</a>
            <button style={s.logoutBtn} onClick={onLogout}>Sign Out</button>
          </div>
        </div>
      </header>

      {actionMessage && (
        <div style={{
          ...s.toast,
          backgroundColor: actionMessage.type === "success" ? "#E8F5E9" : "#FFEBEE",
          borderColor: actionMessage.type === "success" ? "#4CAF50" : "#E53935",
          color: actionMessage.type === "success" ? "#1B5E20" : "#B71C1C",
        }}>
          <span>{actionMessage.type === "success" ? "✅" : "⚠️"}</span>
          <span>{actionMessage.text}</span>
        </div>
      )}

      <div style={s.container}>
        <nav style={s.navTabs}>
          {tabs.map((t) => (
            <button key={t.key} style={activeTab === t.key ? s.tabActive : s.tab} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>

        {loading && !overview ? (
          <div style={s.loadingCard}>
            <div style={s.spinner} />
            <p>Loading OFA Admin Console...</p>
          </div>
        ) : (
          <div>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && overview && (
              <div>
                {/* Live System Health Diagnostics */}
                {systemHealth && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
                    <div style={{ ...s.statCard, padding: 18, textAlign: "left" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#54656F" }}>Database (PostgreSQL)</span>
                        <span style={systemHealth.services.database.status === "ONLINE" ? s.badgeSuccess : s.badgeWarning}>
                          {systemHealth.services.database.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#667781" }}>
                        Ping: <strong>{systemHealth.services.database.latencyMs}ms</strong>
                      </div>
                    </div>

                    <div style={{ ...s.statCard, padding: 18, textAlign: "left" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#54656F" }}>Realtime (Socket.io)</span>
                        <span style={systemHealth.services.realtime.status === "ONLINE" ? s.badgeSuccess : s.badgeWarning}>
                          {systemHealth.services.realtime.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#667781" }}>
                        Port 4000 • Active sockets: <strong>{systemHealth.services.realtime.connectedClients}</strong>
                      </div>
                    </div>

                    <div style={{ ...s.statCard, padding: 18, textAlign: "left" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#54656F" }}>AI Provider (Groq)</span>
                        <span style={s.badgeInfo}>{systemHealth.services.ai.status}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#667781" }}>
                        Model: <strong>{systemHealth.services.ai.model.split("/").pop()}</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div style={s.grid4}>
                  {[
                    { label: "Organizations", value: overview.totalTenants },
                    { label: "Registered Users", value: overview.totalUsers },
                    { label: "Total Conversations", value: overview.totalConversations },
                    { label: "Google Sheets Active", value: overview.totalSheets },
                  ].map((stat) => (
                    <div key={stat.label} style={s.statCard}>
                      <div style={s.statValue}>{stat.value}</div>
                      <div style={s.statLabel}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div style={s.quickActionsRow}>
                  {[
                    { label: "📋 Chat Templates", fn: () => setActiveTab("templates"), color: "#00796B" },
                    { label: "+ New Organization", fn: () => setShowOrgModal(true), color: "#00A884" },
                    { label: "+ Add User", fn: () => setShowUserModal(true), color: "#1565C0" },
                    { label: "+ Create Group", fn: () => setShowGroupModal(true), color: "#6A1B9A" },
                    { label: "View Chats & Leads", fn: () => setActiveTab("conversations"), color: "#2E7D32" },
                    { label: "Configure AI", fn: () => setActiveTab("ai"), color: "#E65100" },
                    { label: "Refresh Data", fn: fetchData, color: "#37474F" },
                  ].map((q) => (
                    <button key={q.label} style={{ ...s.quickBtn, backgroundColor: q.color }} onClick={q.fn}>
                      {q.label}
                    </button>
                  ))}
                </div>

                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <h2 style={s.cardTitle}>Recent Organizations</h2>
                    <button style={s.btnPrimary} onClick={() => setShowOrgModal(true)}>+ Create Organization</button>
                  </div>
                  <table style={s.table}>
                    <thead>
                      <tr style={s.tableHeadRow}>
                        {["Name", "Slug", "Users", "Groups", "Google Sheet", "Action"].map((h) => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentTenants.map((t) => (
                        <tr key={t.id} style={s.tr}>
                          <td style={s.td}><strong>{t.name}</strong></td>
                          <td style={s.td}><code>{t.slug}</code></td>
                          <td style={s.td}>{t.userCount}</td>
                          <td style={s.td}>{t.groupCount}</td>
                          <td style={s.td}>
                            {t.hasSheet
                              ? <span style={s.badgeSuccess}>Connected</span>
                              : <span style={s.badgeWarning}>Not Configured</span>}
                          </td>
                          <td style={s.td}>
                            <button style={s.btnSmall} onClick={() => {
                              const found = orgs.find((o) => o.id === t.id);
                              if (found) {
                                setEditingSheetOrg(found);
                                setSheetUrlInput(found.sheetConnection?.spreadsheetId || "");
                                setSheetTabNameInput(found.sheetConnection?.sheetName || "Bookings");
                                setSheetTestResult(null);
                              }
                            }}>Config Sheet</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TEMPLATES TAB */}
            {activeTab === "templates" && (
              <div>
                <div style={s.card}>
                  <div style={{ ...s.cardHeader, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h2 style={s.cardTitle}>Chat Templates &amp; Multi-Sheet Automation</h2>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#667781" }}>
                        Every template generates its own dedicated tab inside your connected Google Spreadsheet. Users invoke templates with <code>/&lt;command&gt;</code> in chat.
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        style={{ ...s.btnSecondary, background: "#E8F5E9", color: "#2E7D32", borderColor: "#A5D6A7", fontWeight: 700 }}
                        onClick={handleSeedSportsTemplates}
                        disabled={seedingTemplates}
                      >
                        {seedingTemplates ? "⚡ Generating Sheets..." : "⚡ Seed 8 Sports Templates"}
                      </button>
                      <button
                        style={s.btnPrimary}
                        onClick={() => {
                          setNewTplCommand("");
                          setNewTplName("");
                          setNewTplDesc("");
                          setNewTplSheetName("");
                          setNewTplFields([
                            { key: "full_name", label: "Full Name", required: true, type: "text" },
                            { key: "phone_number", label: "Phone Number", required: true, type: "phone" },
                            { key: "details", label: "Details / Notes", required: true, type: "text" },
                          ]);
                          setShowTemplateModal(true);
                        }}
                      >
                        + Create New Template
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: "0 20px 16px" }}>
                    <input
                      style={s.searchInput}
                      placeholder="Search templates by /command, name, or Google Sheet tab..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                    />
                  </div>

                  {templates.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#667781" }}>
                      <p style={{ fontSize: 16, marginBottom: 12 }}>No chat templates found for this organization.</p>
                      <button
                        style={{ ...s.btnPrimary, margin: "0 auto" }}
                        onClick={handleSeedSportsTemplates}
                        disabled={seedingTemplates}
                      >
                        {seedingTemplates ? "Generating..." : "⚡ One-Click Seed 8 Sports Foundation Templates"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, padding: "0 20px 24px" }}>
                      {templates
                        .filter((t) =>
                          t.command.toLowerCase().includes(templateSearch.toLowerCase()) ||
                          t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                          t.sheetName.toLowerCase().includes(templateSearch.toLowerCase())
                        )
                        .map((t) => (
                          <div
                            key={t.id}
                            style={{
                              border: "1px solid #E0E0E0",
                              borderRadius: 12,
                              padding: 16,
                              backgroundColor: "#FFFFFF",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 24 }}>{t.icon || "📋"}</span>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111B21" }}>{t.name}</div>
                                    <code style={{ fontSize: 13, color: "#00A884", fontWeight: 700 }}>/{t.command}</code>
                                  </div>
                                </div>
                                <span style={{
                                  backgroundColor: "#E0F2F1",
                                  color: "#00796B",
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}>
                                  📊 Tab: {t.sheetName}
                                </span>
                              </div>

                              {t.description && (
                                <p style={{ fontSize: 12, color: "#54656F", margin: "0 0 10px", lineHeight: 1.4 }}>
                                  {t.description}
                                </p>
                              )}

                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#8696A0", textTransform: "uppercase", marginBottom: 6 }}>
                                  Columns ({t.fields?.length || 0}):
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {(t.fields || []).map((f: any, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        backgroundColor: "#F5F6F6",
                                        border: "1px solid #E0E0E0",
                                        borderRadius: 4,
                                        padding: "2px 6px",
                                        fontSize: 11,
                                        color: "#111B21",
                                      }}
                                    >
                                      {f.label}{f.required ? " *" : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid #F0F2F5" }}>
                              <span style={{ fontSize: 11, color: "#8696A0" }}>
                                Preserved in Google Sheets
                              </span>
                              <button
                                style={{ ...s.btnDangerSmall, padding: "4px 8px", fontSize: 12 }}
                                onClick={() => handleDeleteTemplate(t.command, t.sheetName)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* DUAL-SYNCED SUBMISSIONS CARD */}
                <div style={{ ...s.card, marginTop: 24 }}>
                  <div style={{ ...s.cardHeader, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 20 }}>💾</span>
                        <h2 style={s.cardTitle}>Database &amp; Google Sheets Form Submissions</h2>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#667781" }}>
                        All user inputs via slash commands and AI extraction are stored permanently in PostgreSQL and dual-synced with Google Sheets.
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 6, fontSize: 12 }}>
                        <span style={{ ...s.badgeSuccess, padding: "5px 10px" }}>
                          🟢 Synced: {submissionStats.synced}
                        </span>
                        {submissionStats.pending > 0 && (
                          <span style={{ ...s.badgeWarning, padding: "5px 10px", backgroundColor: "#FFF3E0", color: "#E65100" }}>
                            🟡 DB Only: {submissionStats.pending}
                          </span>
                        )}
                        <span style={{ ...s.badgeDefault, padding: "5px 10px" }}>
                          Total: {submissionStats.total}
                        </span>
                      </div>

                      {submissionStats.pending > 0 && (
                        <button
                          style={{ ...s.btnSecondary, background: "#E8F5E9", color: "#2E7D32", borderColor: "#A5D6A7", fontWeight: 700 }}
                          onClick={handleSyncAllSubmissions}
                          disabled={syncingAll}
                        >
                          {syncingAll ? "Syncing..." : `⚡ Sync Pending (${submissionStats.pending}) to Sheets`}
                        </button>
                      )}

                      <button style={s.btnSmall} onClick={fetchData}>
                        🔄 Refresh
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: "0 20px 16px" }}>
                    <input
                      style={s.searchInput}
                      placeholder="Search submissions by ref ID, submitter name, phone, command (/booking), sheet tab, or content..."
                      value={submissionSearch}
                      onChange={(e) => setSubmissionSearch(e.target.value)}
                    />
                  </div>

                  {filteredSubmissions.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#667781" }}>
                      <p style={{ fontSize: 15, margin: 0 }}>
                        {submissionSearch ? "No matching submissions found." : "No template or form submissions recorded yet."}
                      </p>
                      <p style={{ fontSize: 13, color: "#8696A0", marginTop: 4 }}>
                        When members complete forms via <code>/booking</code>, <code>/membership</code>, etc. in chat, they will appear here and sync to Google Sheets.
                      </p>
                    </div>
                  ) : (
                    <table style={s.table}>
                      <thead>
                        <tr style={s.tableHeadRow}>
                          {["Ref ID & Time", "Template & Sheet", "Submitter", "Extracted Data", "Status & Sync", "Action"].map((h) => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubmissions.map((sub) => (
                          <tr key={sub.id} style={s.tr}>
                            <td style={s.td}>
                              <strong style={{ fontSize: 12, fontFamily: "monospace", color: "#00A884" }}>
                                {sub.submissionRef || sub.id.slice(0, 10)}
                              </strong>
                              <div style={{ fontSize: 11, color: "#8696A0", marginTop: 2 }}>
                                {new Date(sub.createdAt).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </td>

                            <td style={s.td}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span>{sub.template?.icon || "📋"}</span>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                                    {sub.template?.name || sub.templateCommand}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#00796B" }}>
                                    📊 Tab: <strong>{sub.sheetName}</strong>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={s.td}>
                              <div>
                                <strong>{sub.userName || "Anonymous"}</strong>
                              </div>
                              {sub.userPhone && (
                                <div style={{ fontSize: 12, color: "#54656F" }}>📞 {sub.userPhone}</div>
                              )}
                            </td>

                            <td style={{ ...s.td, maxWidth: 320 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {Object.entries(sub.data || {}).map(([key, val]) => (
                                  <span
                                    key={key}
                                    style={{
                                      backgroundColor: "#F5F6F6",
                                      border: "1px solid #E0E0E0",
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      fontSize: 11,
                                    }}
                                  >
                                    <strong>{key}:</strong> {String(val)}
                                  </span>
                                ))}
                              </div>
                              {sub.rawMessage && (
                                <div style={{ fontSize: 11, color: "#8696A0", marginTop: 4, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                                  Msg: &ldquo;{sub.rawMessage}&rdquo;
                                </div>
                              )}
                            </td>

                            <td style={s.td}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                                {sub.syncedToSheet ? (
                                  <span style={{ ...s.badgeSuccess, fontSize: 11 }}>
                                    ✅ Synced to Sheets
                                  </span>
                                ) : (
                                  <span style={{ ...s.badgeWarning, fontSize: 11, backgroundColor: "#FFF3E0", color: "#E65100" }}>
                                    ⚠️ In DB Only
                                  </span>
                                )}
                                <span style={{ ...s.badgeDefault, fontSize: 10 }}>
                                  {sub.status}
                                </span>
                              </div>
                            </td>

                            <td style={s.td}>
                              {!sub.syncedToSheet && (
                                <button
                                  style={{ ...s.btnSmall, fontSize: 11, padding: "4px 8px", backgroundColor: "#E8F5E9", color: "#2E7D32", borderColor: "#A5D6A7" }}
                                  onClick={() => handleSyncOneSubmission(sub.id)}
                                  disabled={syncingId === sub.id}
                                >
                                  {syncingId === sub.id ? "Syncing..." : "Sync to Sheet"}
                                </button>
                              )}
                              {sub.syncedToSheet && (
                                <span style={{ fontSize: 11, color: "#8696A0" }}>100% In Sync</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ORGANIZATIONS TAB */}
            {activeTab === "orgs" && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div>
                    <h2 style={s.cardTitle}>Organizations (Tenants)</h2>
                    <p style={s.cardSubtitle}>Each organization has isolated users, groups and exactly one Google Sheet.</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input style={s.searchInput} placeholder="Search organizations..." value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} />
                    <button style={s.btnPrimary} onClick={() => setShowOrgModal(true)}>+ New Organization</button>
                  </div>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr style={s.tableHeadRow}>
                      {["Organization", "Slug", "Users", "Groups", "Google Sheet", "Actions"].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.map((org) => (
                      <tr key={org.id} style={s.tr}>
                        <td style={s.td}>
                          <strong>{org.name}</strong>
                          {(org.slug.toLowerCase().includes("ofa")) && (
                            <span style={{ ...s.badgeSuccess, marginLeft: 8 }}>Primary</span>
                          )}
                        </td>
                        <td style={s.td}><code>{org.slug}</code></td>
                        <td style={s.td}>{org.userCount}</td>
                        <td style={s.td}>{org.groupCount}</td>
                        <td style={s.td}>
                          {org.sheetConnection ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#00A884" }}>Tab: {org.sheetConnection.sheetName}</div>
                              <code style={{ fontSize: 11, color: "#666" }}>{org.sheetConnection.spreadsheetId.slice(0, 20)}...</code>
                            </div>
                          ) : <span style={s.badgeWarning}>No Sheet Configured</span>}
                        </td>
                        <td style={s.td}>
                          <button style={s.btnSmall} onClick={() => {
                            setEditingSheetOrg(org);
                            setSheetUrlInput(org.sheetConnection?.spreadsheetId || "");
                            setSheetTabNameInput(org.sheetConnection?.sheetName || "Bookings");
                            setSheetTestResult(null);
                          }}>
                            {org.sheetConnection ? "Edit Sheet" : "Setup Sheet"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* GROUPS TAB */}
            {activeTab === "groups" && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div>
                    <h2 style={s.cardTitle}>Groups and Channels</h2>
                    <p style={s.cardSubtitle}>Manage chat channels and group assignments.</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input style={s.searchInput} placeholder="Search groups..." value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
                    <button style={s.btnPrimary} onClick={() => setShowGroupModal(true)}>+ Create Group</button>
                  </div>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr style={s.tableHeadRow}>
                      {["Group Name", "Type", "Organization", "Participants", "Messages", "Created"].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => (
                      <tr key={group.id} style={s.tr}>
                        <td style={s.td}><strong>{group.name}</strong></td>
                        <td style={s.td}>
                          <span style={group.kind === "AI" ? s.badgeSuccess : group.kind === "DIRECT" ? s.badgeInfo : s.badgeDefault}>
                            {group.kind}
                          </span>
                        </td>
                        <td style={s.td}><strong>{group.tenantName}</strong></td>
                        <td style={s.td}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {group.participants.map((p) => (
                              <span key={p.id} style={s.badgeSmall}>{p.name}{p.role === "BOT" ? " [AI]" : ""}</span>
                            ))}
                          </div>
                        </td>
                        <td style={s.td}>{group.messageCount}</td>
                        <td style={s.td}>{new Date(group.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === "users" && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div>
                    <h2 style={s.cardTitle}>People &amp; Members</h2>
                    <p style={s.cardSubtitle}>Manage accounts and assign administrative roles.</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input style={s.searchInput} placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                    <button style={s.btnPrimary} onClick={() => setShowUserModal(true)}>+ Add User</button>
                  </div>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr style={s.tableHeadRow}>
                      {["Name", "Email", "Role", "Organization", "Joined", "Actions"].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} style={s.tr}>
                        <td style={s.td}><strong>{u.name}</strong></td>
                        <td style={s.td}>{u.email}</td>
                        <td style={s.td}>
                          <span style={u.role === "ADMIN" ? s.badgeSuccess : u.role === "BOT" ? s.badgeInfo : s.badgeDefault}>
                            {u.role}
                          </span>
                        </td>
                        <td style={s.td}><strong>{u.tenantName}</strong></td>
                        <td style={s.td}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td style={s.td}>
                          {u.role !== "BOT" && (
                            <button
                              style={{ ...s.btnSmall, color: "#C62828", borderColor: "#C62828" }}
                              onClick={() => handleDeleteUser(u.id, u.email)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CONVERSATIONS & LEADS TAB */}
            {activeTab === "conversations" && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div>
                    <h2 style={s.cardTitle}>Conversations &amp; Customer Leads</h2>
                    <p style={s.cardSubtitle}>Inspect customer inquiries, booking requests, and AI responses.</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      style={s.searchInput}
                      placeholder="Search inquiries or messages..."
                      value={convSearch}
                      onChange={(e) => setConvSearch(e.target.value)}
                    />
                    <button style={{ ...s.btnSecondary, backgroundColor: "#00A884", color: "#FFF", border: "none" }} onClick={exportConversationsToCsv}>
                      Export CSV
                    </button>
                  </div>
                </div>

                <table style={s.table}>
                  <thead>
                    <tr style={s.tableHeadRow}>
                      {["Organization", "Chat Title", "Total Msgs", "Last Message Snippet", "Last Active", "Action"].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConversations.map((c) => (
                      <tr key={c.id} style={s.tr}>
                        <td style={s.td}><strong>{c.tenantName}</strong></td>
                        <td style={s.td}>
                          <strong>{c.name}</strong>
                          <span style={{ ...s.badgeDefault, marginLeft: 8, fontSize: 11 }}>{c.kind}</span>
                        </td>
                        <td style={s.td}>{c.totalMessages}</td>
                        <td style={{ ...s.td, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.lastMessage ? (
                            <span><strong>{c.lastMessage.senderName}:</strong> {c.lastMessage.body}</span>
                          ) : <span style={{ color: "#999" }}>No messages yet</span>}
                        </td>
                        <td style={s.td}>{new Date(c.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td style={s.td}>
                          <button style={s.btnSmall} onClick={() => handleInspectConversation(c.id)}>
                            Inspect Chat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* AI AGENT TAB */}
            {activeTab === "ai" && aiSettings && (
              <div>
                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <div>
                      <h2 style={s.cardTitle}>Global AI Agent Configuration</h2>
                      <p style={s.cardSubtitle}>Powered by Groq Cloud. Changes apply dynamically to all chats.</p>
                    </div>
                    <span style={{ ...s.badgeSuccess, fontSize: 13 }}>{aiSettings.hasApiKey ? "API Key Configured" : "No Key Set"}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    <div>
                      <div style={s.formGroup}>
                        <label style={s.label}>Groq AI API Key</label>
                        <div style={{ display: "flex", gap: 10 }}>
                          <input type="password" style={{ ...s.input, flex: 1 }} placeholder={aiSettings.maskedApiKey || "gsk_..."} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} />
                          <button style={s.btnSecondary} onClick={handleTestAiConnection} disabled={testingConnection}>
                            {testingConnection ? "Testing..." : "Test"}
                          </button>
                        </div>
                        <small style={s.hint}>Leave blank to keep existing key ({aiSettings.maskedApiKey || "from .env"}).</small>
                      </div>
                      <div style={s.formGroup}>
                        <label style={s.label}>AI Model</label>
                        <select style={s.input} value={selectedAiModel} onChange={(e) => setSelectedAiModel(e.target.value)}>
                          {aiSettings.availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>Global System Instructions</label>
                      <textarea
                        style={{ ...s.input, minHeight: 140, fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
                        value={systemPromptInput}
                        onChange={(e) => setSystemPromptInput(e.target.value)}
                      />
                      <small style={s.hint}>Defines the AI persona and automated sheet logging behaviors.</small>
                    </div>
                  </div>
                  <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                    <button style={s.btnPrimary} onClick={handleSaveAiSettings} disabled={savingAiSettings}>
                      {savingAiSettings ? "Saving..." : "Save AI Settings"}
                    </button>
                    <button style={s.btnSecondary} onClick={handleTestAiConnection} disabled={testingConnection}>
                      {testingConnection ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                </div>

                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <h2 style={s.cardTitle}>Organization Google Sheet Connections</h2>
                  </div>
                  <table style={s.table}>
                    <thead>
                      <tr style={s.tableHeadRow}>
                        {["Organization", "Sheet ID", "Tab", "Status", "Action"].map((h) => <th key={h} style={s.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {orgs.map((org) => (
                        <tr key={org.id} style={s.tr}>
                          <td style={s.td}><strong>{org.name}</strong></td>
                          <td style={s.td}>{org.sheetConnection ? <code style={{ fontSize: 11 }}>{org.sheetConnection.spreadsheetId.slice(0, 20)}...</code> : "-"}</td>
                          <td style={s.td}>{org.sheetConnection?.sheetName || "-"}</td>
                          <td style={s.td}>{org.sheetConnection ? <span style={s.badgeSuccess}>Connected</span> : <span style={s.badgeWarning}>Not Set</span>}</td>
                          <td style={s.td}>
                            <button style={s.btnSmall} onClick={() => {
                              setEditingSheetOrg(org);
                              setSheetUrlInput(org.sheetConnection?.spreadsheetId || "");
                              setSheetTabNameInput(org.sheetConnection?.sheetName || "Bookings");
                              setSheetTestResult(null);
                            }}>
                              {org.sheetConnection ? "Edit" : "Setup"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === "audit" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <div style={s.card}>
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Super Admin Credentials &amp; Sessions</h2>
                    <p style={{ fontSize: 14, color: "#54656F", lineHeight: 1.6 }}>
                      Protected by timing-safe HMAC-SHA256 tokens.
                    </p>
                    {[
                      ["Login Email", "SUPER_ADMIN_EMAIL in .env"],
                      ["Password", "SUPER_ADMIN_PASSWORD in .env"],
                      ["Token Algorithm", "HMAC-SHA256 with timing-safe validation"],
                      ["Session Lifetime", "24 hours auto-expiration"],
                      ["API Protection", "All /api/admin/* endpoints guarded"],
                    ].map(([k, v]) => (
                      <div key={k} style={s.auditRow}>
                        <span style={s.auditLabel}>{k}</span>
                        <code style={s.auditValue}>{v}</code>
                      </div>
                    ))}
                  </div>

                  <div style={s.card}>
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Tenant Isolation &amp; Safety</h2>
                    <p style={{ fontSize: 14, color: "#54656F", lineHeight: 1.6 }}>
                      Every Prisma query strictly scopes by <code>tenantId</code>.
                    </p>
                    {[
                      ["AI Tool Calls", "Scoped to tenant sheet connection"],
                      ["Socket Events", "Room-scoped per conversationId"],
                      ["Database Queries", "Enforced tenantId filtering"],
                      ["Google Sheet", "Isolated 1:1 per organization"],
                    ].map(([k, v]) => (
                      <div key={k} style={s.auditRow}>
                        <span style={s.auditLabel}>{k}</span>
                        <code style={s.auditValue}>{v}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SYSTEM TAB */}
            {activeTab === "settings" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <div style={s.card}>
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Production Architecture</h2>
                    {[
                      ["Web Server", "Next.js 14 App Router (Port 3000)"],
                      ["Database", "PostgreSQL via Prisma ORM"],
                      ["Realtime Server", "Socket.io (Port 4000)"],
                      ["AI Provider", "Groq Cloud (openai/gpt-oss-120b)"],
                      ["Sheets Sync", "Google Service Account OAuth"],
                      ["Mobile Client", "React Native (Standalone Release APK)"],
                    ].map(([k, v]) => (
                      <div key={k} style={s.auditRow}>
                        <span style={s.auditLabel}>{k}</span>
                        <code style={s.auditValue}>{v}</code>
                      </div>
                    ))}
                  </div>

                  <div style={s.card}>
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Quick Admin Actions</h2>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                      {[
                        { label: "+ New Organization", fn: () => { setActiveTab("orgs"); setShowOrgModal(true); }, color: "#00A884" },
                        { label: "+ Add User", fn: () => { setActiveTab("users"); setShowUserModal(true); }, color: "#1565C0" },
                        { label: "View Chats & Leads", fn: () => setActiveTab("conversations"), color: "#00796B" },
                        { label: "Export Leads (CSV)", fn: exportConversationsToCsv, color: "#E65100" },
                        { label: "Refresh Status", fn: fetchData, color: "#37474F" },
                        { label: "Sign Out", fn: onLogout, color: "#B71C1C" },
                      ].map((q) => (
                        <button key={q.label} style={{ ...s.btnPrimary, backgroundColor: q.color }} onClick={q.fn}>
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE ORG MODAL */}
      {showOrgModal && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Create New Organization</h3>
              <button style={s.closeBtn} onClick={() => setShowOrgModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateOrg}>
              <div style={s.formGroup}><label style={s.label}>Organization Name *</label><input style={s.input} placeholder="e.g. OFA Sports Academy" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required /></div>
              <div style={s.formGroup}><label style={s.label}>Slug (optional)</label><input style={s.input} placeholder="e.g. ofa-sports-academy" value={newOrgSlug} onChange={(e) => setNewOrgSlug(e.target.value)} /></div>
              <div style={s.formGroup}><label style={s.label}>Google Sheet URL or ID (optional)</label><input style={s.input} placeholder="https://docs.google.com/spreadsheets/d/..." value={newOrgSheetUrl} onChange={(e) => setNewOrgSheetUrl(e.target.value)} /></div>
              <div style={s.formGroup}><label style={s.label}>Sheet Tab Name</label><input style={s.input} placeholder="Bookings" value={newOrgSheetName} onChange={(e) => setNewOrgSheetName(e.target.value)} /></div>
              <div style={s.modalFooter}>
                <button type="button" style={s.btnSecondary} onClick={() => setShowOrgModal(false)}>Cancel</button>
                <button type="submit" style={s.btnPrimary}>Create Organization</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHEET CONFIG & DIAGNOSTIC MODAL */}
      {editingSheetOrg && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Google Sheet for {editingSheetOrg.name}</h3>
              <button style={s.closeBtn} onClick={() => setEditingSheetOrg(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveSheetConfig}>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
                Every organization links to a dedicated Google Sheet. Customer inquiries and bookings are appended automatically.
              </p>
              <div style={s.formGroup}>
                <label style={s.label}>Sheet URL or Spreadsheet ID *</label>
                <input
                  style={s.input}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={sheetUrlInput}
                  onChange={(e) => {
                    setSheetUrlInput(e.target.value);
                    setSheetTestResult(null);
                  }}
                  required
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Sheet Tab Name</label>
                <input
                  style={s.input}
                  placeholder="Bookings"
                  value={sheetTabNameInput}
                  onChange={(e) => setSheetTabNameInput(e.target.value)}
                />
              </div>

              {/* Diagnostic Test Button */}
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  style={{ ...s.btnSecondary, width: "100%", padding: "10px" }}
                  onClick={handleTestSheetConnection}
                  disabled={testingSheet || !sheetUrlInput.trim()}
                >
                  {testingSheet ? "Verifying Google Service Account Access..." : "🔍 Test Connection & Permissions"}
                </button>
                {sheetTestResult && (
                  <div style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 8,
                    fontSize: 13,
                    backgroundColor: sheetTestResult.ok ? "#E8F5E9" : "#FFEBEE",
                    color: sheetTestResult.ok ? "#1B5E20" : "#B71C1C",
                  }}>
                    <strong>{sheetTestResult.ok ? "✅ Connected: " : "❌ Error: "}</strong>
                    {sheetTestResult.message}
                    {sheetTestResult.tabs && (
                      <div style={{ marginTop: 4 }}>Tabs: {sheetTestResult.tabs.join(", ")}</div>
                    )}
                  </div>
                )}
              </div>

              <div style={s.modalFooter}>
                <button type="button" style={s.btnSecondary} onClick={() => setEditingSheetOrg(null)}>Cancel</button>
                <button type="submit" style={s.btnPrimary}>Save Sheet Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showUserModal && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Add Person to Organization</h3>
              <button style={s.closeBtn} onClick={() => setShowUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div style={s.formGroup}><label style={s.label}>Select Organization *</label><select style={s.input} value={newUserTenantId} onChange={(e) => setNewUserTenantId(e.target.value)} required>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}</select></div>
              <div style={s.formGroup}><label style={s.label}>Full Name</label><input style={s.input} placeholder="e.g. John Smith" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} /></div>
              <div style={s.formGroup}><label style={s.label}>Email Address *</label><input type="email" style={s.input} placeholder="john@ofa-sports.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required /></div>
              <div style={s.formGroup}><label style={s.label}>Password *</label><input type="password" style={s.input} value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required /></div>
              <div style={s.formGroup}><label style={s.label}>Role</label><select style={s.input} value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as "USER" | "ADMIN")}><option value="USER">User (Standard Member)</option><option value="ADMIN">Admin (Org Manager)</option></select></div>
              <div style={s.modalFooter}>
                <button type="button" style={s.btnSecondary} onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" style={s.btnPrimary}>Add Person</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showGroupModal && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Create New Group</h3>
              <button style={s.closeBtn} onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div style={s.formGroup}><label style={s.label}>Select Organization *</label><select style={s.input} value={newGroupTenantId} onChange={(e) => setNewGroupTenantId(e.target.value)} required>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}</select></div>
              <div style={s.formGroup}><label style={s.label}>Group Name *</label><input style={s.input} placeholder="e.g. Coaching Inquiries" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required /></div>
              <div style={s.formGroup}><label style={s.label}>Channel Type</label><select style={s.input} value={newGroupKind} onChange={(e) => setNewGroupKind(e.target.value as "GROUP" | "AI" | "DIRECT")}><option value="GROUP">Team Group</option><option value="AI">AI Assistant Channel</option><option value="DIRECT">Direct Chat</option></select></div>
              <div style={s.modalFooter}>
                <button type="button" style={s.btnSecondary} onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" style={s.btnPrimary}>Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERSATION INSPECTION MODAL */}
      {inspectingConv && (
        <div style={s.modalOverlay}>
          <div style={{ ...s.modalCard, maxWidth: 680, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>{inspectingConv.name}</h3>
                <p style={{ fontSize: 13, color: "#666", margin: "2px 0 0" }}>
                  {inspectingConv.tenantName} • {inspectingConv.messages.length} message(s)
                </p>
              </div>
              <button style={s.closeBtn} onClick={() => setInspectingConv(null)}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {inspectingConv.messages.map((m) => {
                const isBot = m.senderRole === "BOT";
                return (
                  <div
                    key={m.id}
                    style={{
                      maxWidth: "80%",
                      alignSelf: isBot ? "flex-start" : "flex-end",
                      backgroundColor: isBot ? "#FFFFFF" : "#DCF8C6",
                      borderRadius: 10,
                      padding: "10px 14px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      border: isBot ? "1px solid #E0E0E0" : "none",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: isBot ? "#075E54" : "#1B5E20", marginBottom: 2 }}>
                      {m.senderName} {isBot && "🤖"}
                    </div>
                    <div style={{ fontSize: 14, color: "#111B21", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                      {m.body}
                    </div>
                    <div style={{ fontSize: 10, color: "#8696A0", textAlign: "right", marginTop: 4 }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid #F0F2F5", paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button style={s.btnPrimary} onClick={() => setInspectingConv(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TEMPLATE MODAL */}
      {showTemplateModal && (
        <div style={s.modalOverlay}>
          <div style={{ ...s.modalCard, maxWidth: 540 }}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Create New Chat Template</h3>
              <button style={s.closeBtn} onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTemplate}>
              <p style={{ fontSize: 13, color: "#667781", marginBottom: 16 }}>
                Every template automatically generates a dedicated tab in your Google Spreadsheet.
              </p>

              <div style={s.formGroup}>
                <label style={s.label}>Slash Command (lowercase, e.g. physio, diet, camp) *</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "#00A884" }}>/</span>
                  <input
                    style={s.input}
                    placeholder="booking"
                    value={newTplCommand}
                    onChange={(e) => {
                      const cmd = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                      setNewTplCommand(cmd);
                      if (!newTplSheetName || newTplSheetName.endsWith("Records")) {
                        setNewTplSheetName(cmd ? `${cmd.charAt(0).toUpperCase() + cmd.slice(1)} Records` : "");
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Display Name *</label>
                <input
                  style={s.input}
                  placeholder="Facility Booking"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  required
                />
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Dedicated Google Sheet Tab Name *</label>
                <input
                  style={s.input}
                  placeholder="Facility Bookings"
                  value={newTplSheetName}
                  onChange={(e) => setNewTplSheetName(e.target.value)}
                  required
                />
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Icon Emoji</label>
                <input
                  style={{ ...s.input, width: 80 }}
                  value={newTplIcon}
                  onChange={(e) => setNewTplIcon(e.target.value)}
                />
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Description (Optional)</label>
                <input
                  style={s.input}
                  placeholder="e.g. Reserve badminton courts or turf"
                  value={newTplDesc}
                  onChange={(e) => setNewTplDesc(e.target.value)}
                />
              </div>

              {/* Dynamic Column Builder */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ ...s.label, marginBottom: 0 }}>Template Columns / Headers</label>
                  <button
                    type="button"
                    style={{ ...s.btnSecondary, padding: "4px 8px", fontSize: 12 }}
                    onClick={() => {
                      setNewTplFields([
                        ...newTplFields,
                        { key: `col_${Date.now().toString().slice(-4)}`, label: "", required: true, type: "text" },
                      ]);
                    }}
                  >
                    + Add Column
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {newTplFields.map((field, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        style={{ ...s.input, flex: 2, padding: "6px 8px", fontSize: 13 }}
                        placeholder="Column Name (e.g. Age Group)"
                        value={field.label}
                        onChange={(e) => {
                          const updated = [...newTplFields];
                          updated[idx].label = e.target.value;
                          updated[idx].key = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_");
                          setNewTplFields(updated);
                        }}
                        required
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#54656F" }}>
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => {
                            const updated = [...newTplFields];
                            updated[idx].required = e.target.checked;
                            setNewTplFields(updated);
                          }}
                        />
                        Req
                      </label>
                      {newTplFields.length > 1 && (
                        <button
                          type="button"
                          style={{ background: "transparent", border: "none", color: "#C62828", cursor: "pointer", fontSize: 14 }}
                          onClick={() => {
                            setNewTplFields(newTplFields.filter((_, i) => i !== idx));
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={s.modalFooter}>
                <button type="button" style={s.btnSecondary} onClick={() => setShowTemplateModal(false)}>
                  Cancel
                </button>
                <button type="submit" style={s.btnPrimary} disabled={creatingTemplate}>
                  {creatingTemplate ? "Creating Sheet..." : "Create Template & Sheet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F0F2F5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#111B21",
  },
  header: {
    background: "linear-gradient(135deg, #075E54 0%, #128C7E 100%)",
    color: "#FFFFFF",
    padding: "16px 24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  headerContent: { maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" },
  brandGroup: { display: "flex", alignItems: "center", gap: 14 },
  brandIconWrap: { width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: 1 },
  brandTitle: { fontSize: 20, fontWeight: 700, margin: 0 },
  brandSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", margin: "2px 0 0" },
  headerActions: { display: "flex", alignItems: "center", gap: 12 },
  badgeLive: { backgroundColor: "rgba(37,211,102,0.2)", color: "#25D366", padding: "4px 10px", borderRadius: 16, fontSize: 12, fontWeight: 600 },
  healthLink: { color: "#fff", fontSize: 13, textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)", padding: "4px 12px", borderRadius: 6 },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  toast: { maxWidth: 1280, margin: "12px auto 0", padding: "12px 16px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500 },
  container: { maxWidth: 1280, margin: "20px auto", padding: "0 16px 40px" },
  navTabs: { display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" },
  tab: { backgroundColor: "#FFFFFF", border: "1px solid #D1D7DB", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#54656F", cursor: "pointer" },
  tabActive: { background: "linear-gradient(135deg, #075E54, #128C7E)", border: "1px solid #075E54", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 },
  statCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", textAlign: "center" },
  statValue: { fontSize: 36, fontWeight: 800, color: "#075E54", marginBottom: 4 },
  statLabel: { fontSize: 13, color: "#667781", fontWeight: 500 },
  quickActionsRow: { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  quickBtn: { color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 20 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #F0F2F5" },
  cardTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#111B21" },
  cardSubtitle: { fontSize: 13, color: "#667781", margin: "4px 0 0" },
  searchInput: { padding: "8px 12px", border: "1px solid #D1D7DB", borderRadius: 8, fontSize: 13, color: "#111B21", minWidth: 220 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  tableHeadRow: { borderBottom: "2px solid #E9EDEF", backgroundColor: "#F7F9FA" },
  th: { textAlign: "left", padding: "12px 16px", color: "#54656F", fontWeight: 600, fontSize: 13 },
  tr: { borderBottom: "1px solid #F0F2F5" },
  td: { padding: "14px 16px", color: "#111B21" },
  badgeSuccess: { backgroundColor: "#E8F5E9", color: "#2E7D32", padding: "4px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgeWarning: { backgroundColor: "#FFF3E0", color: "#E65100", padding: "4px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgeInfo: { backgroundColor: "#E3F2FD", color: "#1565C0", padding: "4px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgeDefault: { backgroundColor: "#ECEFF1", color: "#455A64", padding: "4px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgeSmall: { backgroundColor: "#F0F2F5", color: "#111B21", padding: "2px 8px", borderRadius: 10, fontSize: 12 },
  btnPrimary: { background: "linear-gradient(135deg, #00A884, #128C7E)", color: "#FFFFFF", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnSecondary: { backgroundColor: "#F0F2F5", color: "#111B21", border: "1px solid #D1D7DB", padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnSmall: { backgroundColor: "#F0F2F5", color: "#00A884", border: "1px solid #00A884", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  formGroup: { marginBottom: 16 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#54656F", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #D1D7DB", fontSize: 14, boxSizing: "border-box", backgroundColor: "#FFFFFF", color: "#111B21" },
  hint: { display: "block", fontSize: 12, color: "#8696A0", marginTop: 4 },
  auditRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0F2F5", gap: 12 },
  auditLabel: { fontSize: 13, color: "#54656F", fontWeight: 600, flexShrink: 0 },
  auditValue: { fontSize: 12, color: "#111B21", textAlign: "right" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(11,20,26,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 28, width: "100%", maxWidth: 540, boxShadow: "0 16px 48px rgba(0,0,0,0.2)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#111B21" },
  closeBtn: { backgroundColor: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "#667781", fontWeight: 700 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 },
  loadingCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 48, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  spinner: { width: 36, height: 36, border: "4px solid #F0F2F5", borderTop: "4px solid #00A884", borderRadius: "50%", margin: "0 auto 16px" },
};
