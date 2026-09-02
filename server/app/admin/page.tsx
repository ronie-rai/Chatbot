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

interface AISettings {
  hasApiKey: boolean;
  maskedApiKey: string;
  model: string;
  systemPrompt: string;
  availableModels: string[];
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
              placeholder="........"
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
          Credentials set via <code>SUPER_ADMIN_EMAIL</code> &amp;{" "}
          <code>SUPER_ADMIN_PASSWORD</code> in <code>.env</code>
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
    padding: "11px 14px",
    borderRadius: 8,
    border: "1.5px solid #D1D7DB",
    fontSize: 14,
    boxSizing: "border-box",
    color: "#111B21",
    outline: "none",
  },
  btn: {
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    background: "linear-gradient(135deg, #075E54, #25D366)",
    color: "#FFFFFF",
    border: "none",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  hint: { fontSize: 12, color: "#8696A0", marginTop: 20 },
};

// --- Main Page Export ---

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("sa_token");
    setIsAuthenticated(!!token);
    setCheckingAuth(false);
  }, []);

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#075E54" }}>
        <div style={{ color: "#fff", fontSize: 16 }}>Loading...</div>
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
  const [activeTab, setActiveTab] = useState<"overview" | "orgs" | "groups" | "users" | "ai" | "audit" | "settings">("overview");

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Org modal
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgSheetUrl, setNewOrgSheetUrl] = useState("");
  const [newOrgSheetName, setNewOrgSheetName] = useState("Bookings");

  // Sheet config modal
  const [editingSheetOrg, setEditingSheetOrg] = useState<Organization | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [sheetTabNameInput, setSheetTabNameInput] = useState("Bookings");

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Welcome@123");
  const [newUserRole, setNewUserRole] = useState<"USER" | "ADMIN">("USER");
  const [newUserTenantId, setNewUserTenantId] = useState("");

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTenantId, setNewGroupTenantId] = useState("");
  const [newGroupKind, setNewGroupKind] = useState<"GROUP" | "AI" | "DIRECT">("GROUP");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  // AI settings
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState("");
  const [systemPromptInput, setSystemPromptInput] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingAiSettings, setSavingAiSettings] = useState(false);

  // Search
  const [orgSearch, setOrgSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

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
      const [overviewRes, orgsRes, usersRes, groupsRes, aiRes] = await Promise.all([
        fetch("/api/admin/overview", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/organizations", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/users", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/groups", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/admin/ai-settings", { headers: authHeaders() }).then((r) => r.json()),
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
      if (aiRes.ok) {
        setAiSettings(aiRes.data);
        setSelectedAiModel(aiRes.data.model);
        setSystemPromptInput(aiRes.data.systemPrompt);
      }
    } catch {
      showToast("error", "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        showToast("success", `Sheet configured for "${editingSheetOrg.name}"!`);
        setEditingSheetOrg(null);
        fetchData();
      } else {
        showToast("error", data.error?.message || "Failed");
      }
    } catch {
      showToast("error", "Request failed");
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
        showToast("error", data.error?.message || "Failed");
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
        showToast("error", data.error?.message || "Failed");
      }
    } catch {
      showToast("error", "Request failed");
    }
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
        showToast("error", data.error?.message || "Failed");
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

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "orgs", label: `Organizations (${orgs.length})` },
    { key: "groups", label: `Groups (${groups.length})` },
    { key: "users", label: `Users (${users.length})` },
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
              <h1 style={s.brandTitle}>OFA Sports - Super Admin Panel</h1>
              <p style={s.brandSubtitle}>Organizations - Users - Groups - AI Agent - Security</p>
            </div>
          </div>
          <div style={s.headerActions}>
            <span style={s.badgeLive}>Live</span>
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
          <span>{actionMessage.type === "success" ? "[OK]" : "[!]"}</span>
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
                <div style={s.grid4}>
                  {[
                    { label: "Organizations", value: overview.totalTenants },
                    { label: "Registered Users", value: overview.totalUsers },
                    { label: "Groups and Chats", value: overview.totalConversations },
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
                    { label: "+ New Organization", fn: () => setShowOrgModal(true), color: "#00A884" },
                    { label: "+ Add User", fn: () => setShowUserModal(true), color: "#1565C0" },
                    { label: "+ Create Group", fn: () => setShowGroupModal(true), color: "#6A1B9A" },
                    { label: "Configure AI", fn: () => setActiveTab("ai"), color: "#E65100" },
                    { label: "Refresh", fn: fetchData, color: "#37474F" },
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
                          {(org.slug === "ofa_sports" || org.slug === "ofa-sports") && (
                            <span style={{ ...s.badgeSuccess, marginLeft: 8 }}>Default</span>
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
                    <h2 style={s.cardTitle}>Groups and Conversations</h2>
                    <p style={s.cardSubtitle}>Manage groups across all organizations.</p>
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
                    <h2 style={s.cardTitle}>People and Members</h2>
                    <p style={s.cardSubtitle}>Manage users across all organizations with roles.</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input style={s.searchInput} placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                    <button style={s.btnPrimary} onClick={() => setShowUserModal(true)}>+ Add User</button>
                  </div>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr style={s.tableHeadRow}>
                      {["Name", "Email", "Role", "Organization", "Joined"].map((h) => (
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
                      <p style={s.cardSubtitle}>Shared across all organizations. Changes apply immediately.</p>
                    </div>
                    <span style={{ ...s.badgeSuccess, fontSize: 13 }}>{aiSettings.hasApiKey ? "API Key Set" : "No API Key"}</span>
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
                        <small style={s.hint}>Leave blank to keep current key ({aiSettings.maskedApiKey || "from .env"}).</small>
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
                      <small style={s.hint}>Defines the AI persona for all organizations and groups.</small>
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
                    <h2 style={s.cardTitle}>Per-Organization Google Sheet Status</h2>
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
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Super Admin Credentials</h2>
                    <p style={{ fontSize: 14, color: "#54656F", lineHeight: 1.6 }}>
                      Stored securely in <code>.env</code> - never persisted to the database.
                    </p>
                    {[
                      ["Login Email", "SUPER_ADMIN_EMAIL in .env"],
                      ["Password", "SUPER_ADMIN_PASSWORD in .env"],
                      ["Session", "Browser sessionStorage (auto-expires on tab close)"],
                      ["Registration", "Disabled - org creation is admin-only"],
                    ].map(([k, v]) => (
                      <div key={k} style={s.auditRow}>
                        <span style={s.auditLabel}>{k}</span>
                        <code style={s.auditValue}>{v}</code>
                      </div>
                    ))}
                    <div style={{ marginTop: 16, padding: "10px 14px", background: "#E8F5E9", borderRadius: 8, fontSize: 13, color: "#2E7D32" }}>
                      No public registration endpoint exposed.
                    </div>
                  </div>

                  <div style={s.card}>
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Tenant Isolation</h2>
                    <p style={{ fontSize: 14, color: "#54656F", lineHeight: 1.6 }}>
                      Every DB query is scoped by <code>tenantId</code>. Data never leaks between orgs.
                    </p>
                    {[
                      ["AI Calls", "Scoped to org's SheetConnection"],
                      ["Socket Events", "Room-scoped per conversationId"],
                      ["API Key", "Single shared key (never per-org)"],
                      ["Google Sheet", "1 sheet per org (enforced in DB)"],
                      ["Prisma Queries", "Always filtered by tenantId"],
                    ].map(([k, v]) => (
                      <div key={k} style={s.auditRow}>
                        <span style={s.auditLabel}>{k}</span>
                        <code style={s.auditValue}>{v}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={s.card}>
                  <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Organization Access Summary</h2>
                  <table style={s.table}>
                    <thead>
                      <tr style={s.tableHeadRow}>
                        {["Organization", "Users", "Groups", "Sheet", "Isolation"].map((h) => <th key={h} style={s.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {orgs.map((org) => (
                        <tr key={org.id} style={s.tr}>
                          <td style={s.td}><strong>{org.name}</strong> <code style={{ fontSize: 11 }}>({org.slug})</code></td>
                          <td style={s.td}>{org.userCount}</td>
                          <td style={s.td}>{org.groupCount}</td>
                          <td style={s.td}>{org.sheetConnection ? <span style={s.badgeSuccess}>Configured</span> : <span style={s.badgeWarning}>Missing</span>}</td>
                          <td style={s.td}><span style={s.badgeSuccess}>Isolated</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SYSTEM SETTINGS TAB */}
            {activeTab === "settings" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <div style={s.card}>
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Environment and Runtime</h2>
                    {[
                      ["Runtime", "Next.js 14 (App Router)"],
                      ["Database", "PostgreSQL via Prisma ORM"],
                      ["Realtime", "Socket.io (port 4000)"],
                      ["AI Provider", "Groq Cloud"],
                      ["Google Sheets", "Service Account Auth"],
                      ["Mobile Client", "React Native (Expo + Web)"],
                    ].map(([k, v]) => (
                      <div key={k} style={s.auditRow}>
                        <span style={s.auditLabel}>{k}</span>
                        <code style={s.auditValue}>{v}</code>
                      </div>
                    ))}
                  </div>
                  <div style={s.card}>
                    <h2 style={{ ...s.cardTitle, marginBottom: 16 }}>Architecture Rules</h2>
                    {[
                      ["Org Registration", "Super Admin only - no self-signup"],
                      ["Google Sheet", "Strictly 1 per organization"],
                      ["AI API Key", "Common across all orgs"],
                      ["Socket Events", "Always room-scoped (never global)"],
                      ["Tenant Queries", "Always filtered by tenantId"],
                      ["Secrets", ".env only - never hardcoded"],
                    ].map(([k, v]) => (
                      <div key={k} style={s.auditRow}>
                        <span style={s.auditLabel}>{k}</span>
                        <code style={{ ...s.auditValue, color: "#1565C0" }}>{v}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={s.card}>
                  <h2 style={{ ...s.cardTitle, marginBottom: 8 }}>Quick Actions</h2>
                  <p style={{ ...s.cardSubtitle, marginBottom: 20 }}>Common super admin shortcuts.</p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {[
                      { label: "New Organization", fn: () => { setActiveTab("orgs"); setShowOrgModal(true); }, color: "#00A884" },
                      { label: "Add User", fn: () => { setActiveTab("users"); setShowUserModal(true); }, color: "#1565C0" },
                      { label: "New Group", fn: () => { setActiveTab("groups"); setShowGroupModal(true); }, color: "#6A1B9A" },
                      { label: "Refresh Data", fn: fetchData, color: "#E65100" },
                      { label: "Sign Out", fn: onLogout, color: "#B71C1C" },
                    ].map((q) => (
                      <button key={q.label} style={{ ...s.btnPrimary, backgroundColor: q.color }} onClick={q.fn}>
                        {q.label}
                      </button>
                    ))}
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
              <button style={s.closeBtn} onClick={() => setShowOrgModal(false)}>X</button>
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

      {/* SHEET CONFIG MODAL */}
      {editingSheetOrg && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Google Sheet for {editingSheetOrg.name}</h3>
              <button style={s.closeBtn} onClick={() => setEditingSheetOrg(null)}>X</button>
            </div>
            <form onSubmit={handleSaveSheetConfig}>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>One Google Sheet per organization. AI calls sync automatically.</p>
              <div style={s.formGroup}><label style={s.label}>Sheet URL or Spreadsheet ID *</label><input style={s.input} placeholder="https://docs.google.com/spreadsheets/d/.../edit" value={sheetUrlInput} onChange={(e) => setSheetUrlInput(e.target.value)} required /></div>
              <div style={s.formGroup}><label style={s.label}>Sheet Tab Name</label><input style={s.input} placeholder="Bookings" value={sheetTabNameInput} onChange={(e) => setSheetTabNameInput(e.target.value)} /></div>
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
              <button style={s.closeBtn} onClick={() => setShowUserModal(false)}>X</button>
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
              <button style={s.closeBtn} onClick={() => setShowGroupModal(false)}>X</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div style={s.formGroup}><label style={s.label}>Select Organization *</label><select style={s.input} value={newGroupTenantId} onChange={(e) => { setNewGroupTenantId(e.target.value); setSelectedParticipantIds([]); }} required>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}</select></div>
              <div style={s.formGroup}><label style={s.label}>Group Name *</label><input style={s.input} placeholder="e.g. Tennis Tournament 2026" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required /></div>
              <div style={s.formGroup}><label style={s.label}>Conversation Type</label><select style={s.input} value={newGroupKind} onChange={(e) => setNewGroupKind(e.target.value as "GROUP" | "AI" | "DIRECT")}><option value="GROUP">Group (Multi-user)</option><option value="AI">AI Chat (OFA AI Assistant)</option><option value="DIRECT">Direct 1-on-1</option></select></div>
              <div style={s.formGroup}>
                <label style={s.label}>Select Members</label>
                <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid #E0E0E0", borderRadius: 8, padding: 8 }}>
                  {users.filter((u) => u.tenantId === newGroupTenantId).map((u) => {
                    const checked = selectedParticipantIds.includes(u.id);
                    return (
                      <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          if (e.target.checked) setSelectedParticipantIds([...selectedParticipantIds, u.id]);
                          else setSelectedParticipantIds(selectedParticipantIds.filter((id) => id !== u.id));
                        }} />
                        <span style={{ fontSize: 13 }}>{u.name} ({u.email}) - {u.role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={s.modalFooter}>
                <button type="button" style={s.btnSecondary} onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" style={s.btnPrimary}>Create Group</button>
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
  searchInput: { padding: "8px 12px", border: "1px solid #D1D7DB", borderRadius: 8, fontSize: 13, color: "#111B21", minWidth: 200 },
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
