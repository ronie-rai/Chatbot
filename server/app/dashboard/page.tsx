"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

// --- Types ---

interface TemplateItem {
  id: string;
  command: string;
  name: string;
  description: string | null;
  sheetName: string;
  icon: string | null;
  fields: Array<{
    key: string;
    label: string;
    required: boolean;
    type?: string;
    placeholder?: string;
    options?: string[];
  }>;
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
  template?: {
    name: string;
    command: string;
    icon: string | null;
    sheetName: string;
    fields: any[];
  } | null;
}

interface DashboardInsights {
  totalSubmissions: number;
  submissionsToday: number;
  syncedCount: number;
  pendingCount: number;
  syncRate: number;
  byTemplate: Array<{
    command: string;
    name: string;
    icon: string;
    sheetName: string;
    count: number;
    fieldCount: number;
  }>;
  bySport: Array<{
    sport: string;
    count: number;
    percentage: number;
  }>;
  dailyActivity: Array<{
    date: string;
    label: string;
    count: number;
  }>;
  byTimeSlot: {
    morning: number;
    afternoon: number;
    evening: number;
  };
  availableSports: string[];
}

export default function UserDashboardPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedTab, setSelectedTab] = useState<string>("all"); // "all" or template command
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [sportFilter, setSportFilter] = useState<string>("");
  const [syncFilter, setSyncFilter] = useState<string>(""); // "", "synced", "pending"
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>("");
  const [targetDateFilter, setTargetDateFilter] = useState<string>("");

  // Active detail modal
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionItem | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTab !== "all") params.set("command", selectedTab);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (sportFilter) params.set("sport", sportFilter);
      if (syncFilter) params.set("sync", syncFilter);
      if (timeSlotFilter) params.set("timeSlot", timeSlotFilter);
      if (targetDateFilter) params.set("targetDate", targetDateFilter);

      if (dateRange === "today") {
        const today = new Date().toISOString().slice(0, 10);
        params.set("startDate", today);
      } else if (dateRange === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.set("startDate", weekAgo.toISOString().slice(0, 10));
      } else if (dateRange === "month") {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        params.set("startDate", monthAgo.toISOString().slice(0, 10));
      }

      const res = await fetch(`/api/dashboard/data?${params.toString()}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setTemplates(json.data.templates || []);
        setSubmissions(json.data.submissions || []);
        setInsights(json.data.insights || null);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTab, searchQuery, dateRange, sportFilter, syncFilter, timeSlotFilter, targetDateFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleResetFilters = () => {
    setSelectedTab("all");
    setSearchQuery("");
    setDateRange("all");
    setSportFilter("");
    setSyncFilter("");
    setTimeSlotFilter("");
    setTargetDateFilter("");
  };

  const hasActiveDrilldown = Boolean(sportFilter || timeSlotFilter || targetDateFilter || syncFilter);

  // Active template metadata
  const currentTemplate = useMemo(() => {
    return templates.find((t) => t.command === selectedTab) || null;
  }, [templates, selectedTab]);

  // Dynamic columns for active view
  const tableColumns = useMemo(() => {
    if (currentTemplate && currentTemplate.fields && currentTemplate.fields.length > 0) {
      return currentTemplate.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type || "text",
      }));
    }
    return [
      { key: "userName", label: "Full Name / Submitter", type: "text" },
      { key: "userPhone", label: "Phone Number", type: "phone" },
      { key: "sport", label: "Sport / Facility", type: "text" },
      { key: "sheetName", label: "Google Sheet Tab", type: "badge" },
    ];
  }, [currentTemplate]);

  // Export to CSV
  const handleExportCSV = () => {
    if (submissions.length === 0) return;

    // Collect all dynamic headers
    const headers = ["Ref ID", "Date & Time", "Template", "Google Sheet Tab", "User Name", "User Phone", "Status", "Synced To Sheet"];
    const extraKeys = new Set<string>();

    for (const sub of submissions) {
      if (sub.data) {
        for (const k of Object.keys(sub.data)) {
          extraKeys.add(k);
        }
      }
    }
    const extraKeysArr = Array.from(extraKeys);
    const allHeaders = [...headers, ...extraKeysArr];

    const rows = submissions.map((sub) => {
      const base = [
        sub.submissionRef || sub.id.slice(0, 10),
        new Date(sub.createdAt).toLocaleString(),
        sub.template?.name || sub.templateCommand,
        sub.sheetName,
        sub.userName || "",
        sub.userPhone || "",
        sub.status,
        sub.syncedToSheet ? "YES" : "NO",
      ];
      const extras = extraKeysArr.map((k) => {
        const val = sub.data?.[k];
        return val !== undefined && val !== null ? String(val).replace(/"/g, '""') : "";
      });
      return [...base, ...extras].map((v) => `"${v}"`).join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [allHeaders.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OFA_Sports_Dashboard_${selectedTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maxDailyCount = useMemo(() => {
    if (!insights?.dailyActivity || insights.dailyActivity.length === 0) return 1;
    return Math.max(...insights.dailyActivity.map((d) => d.count), 1);
  }, [insights]);

  return (
    <div style={styles.page}>
      {/* HEADER / NAVIGATION */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.brandGroup}>
            <div style={{ ...styles.logoBadge, backgroundColor: "#000000", overflow: "hidden", padding: 0 }}>
              <img src="/icon.png" alt="OFA Sports Foundation" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={styles.brandTitle}>OFA Sports Analytics &amp; Data Hub</h1>
                <span style={styles.liveBadge}>🟢 Live Sync</span>
              </div>
              <p style={styles.brandSubtitle}>
                Unified Member Portal • All Tables, Form Data &amp; Facility Insights
              </p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              style={{ ...styles.btnHeader, backgroundColor: "rgba(255,255,255,0.15)" }}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "🔄 Refresh"}
            </button>
            <button
              style={{ ...styles.btnHeader, backgroundColor: "#FFFFFF", color: "#075E54", fontWeight: 700 }}
              onClick={handleExportCSV}
            >
              📥 Export CSV
            </button>
            <a href="/admin" style={styles.headerLink}>
              ⚙️ Admin Panel
            </a>
          </div>
        </div>
      </header>

      <main style={styles.container}>
        {/* TOP KPI CARDS */}
        {insights && (
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiIcon}>📊</div>
              <div>
                <div style={styles.kpiLabel}>Total Submissions &amp; Records</div>
                <div style={styles.kpiValue}>{insights.totalSubmissions}</div>
                <div style={styles.kpiSub}>Across all 8 sports categories</div>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiIcon, backgroundColor: "#E8F5E9", color: "#2E7D32" }}>⚡</div>
              <div>
                <div style={styles.kpiLabel}>Activity Today</div>
                <div style={{ ...styles.kpiValue, color: "#2E7D32" }}>{insights.submissionsToday}</div>
                <div style={styles.kpiSub}>New bookings &amp; entries</div>
              </div>
            </div>

            <div
              style={{
                ...styles.kpiCard,
                cursor: "pointer",
                border: syncFilter === "synced" ? "2px solid #00A884" : undefined,
                backgroundColor: syncFilter === "synced" ? "#F0FDF4" : "#FFFFFF",
                transition: "all 0.15s ease",
              }}
              onClick={() => setSyncFilter(syncFilter === "synced" ? "" : "synced")}
              title="Click to toggle filter: Sheets Synced records"
            >
              <div style={{ ...styles.kpiIcon, backgroundColor: "#E0F2F1", color: "#00796B" }}>🔄</div>
              <div>
                <div style={styles.kpiLabel}>Google Sheets Sync Rate</div>
                <div style={{ ...styles.kpiValue, color: "#00796B" }}>{insights.syncRate}%</div>
                <div style={styles.kpiSub}>
                  {insights.syncedCount} of {insights.totalSubmissions} tabs in sync {syncFilter === "synced" ? "✓ Active" : ""}
                </div>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiIcon, backgroundColor: "#EDE7F6", color: "#512DA8" }}>🏟️</div>
              <div>
                <div style={styles.kpiLabel}>Active Categories / Tabs</div>
                <div style={{ ...styles.kpiValue, color: "#512DA8" }}>
                  {insights.byTemplate.length}
                </div>
                <div style={styles.kpiSub}>Multi-sheet automation live</div>
              </div>
            </div>
          </div>
        )}

        {/* INSIGHTS & ANALYTICS VISUALIZATIONS */}
        {insights && (
          <div style={styles.analyticsRow}>
            {/* Sport / Court Distribution */}
            <div style={{ ...styles.card, flex: 1.2 }}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>🏟️ Facility &amp; Court Bookings Distribution</h3>
                  <p style={styles.cardSubtitle}>Tap any facility bar to drill down and filter</p>
                </div>
                <span style={styles.badgePill}>
                  {insights.bySport.reduce((acc, s) => acc + s.count, 0)} Total
                </span>
              </div>

              {insights.bySport.length === 0 ? (
                <div style={styles.emptyCardText}>No court breakdown recorded yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {insights.bySport.map((item, idx) => {
                    const isSelected = sportFilter.toLowerCase() === item.sport.toLowerCase();
                    return (
                      <div
                        key={idx}
                        onClick={() => setSportFilter(isSelected ? "" : item.sport)}
                        style={{
                          cursor: "pointer",
                          padding: "6px 8px",
                          borderRadius: 8,
                          backgroundColor: isSelected ? "#F0FDF4" : "transparent",
                          border: isSelected ? "1.5px solid #00A884" : "1px solid transparent",
                          transition: "all 0.15s ease",
                        }}
                        title={`Click to filter table by ${item.sport}`}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: isSelected ? "#00A884" : "#111B21" }}>
                            {isSelected ? "✓ " : ""}{item.sport}
                          </span>
                          <span style={{ color: "#54656F", fontWeight: 700 }}>
                            {item.count} bookings ({item.percentage}%)
                          </span>
                        </div>
                        <div style={styles.progressBarTrack}>
                          <div
                            style={{
                              ...styles.progressBarFill,
                              width: `${Math.max(item.percentage, 8)}%`,
                              backgroundColor: isSelected ? "#00A884" : idx % 2 === 0 ? "#00A884" : "#128C7E",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 14-Day Velocity Trend */}
            <div style={{ ...styles.card, flex: 1.5 }}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>📈 14-Day Activity Velocity</h3>
                  <p style={styles.cardSubtitle}>Tap a day column to filter records by date</p>
                </div>
              </div>

              <div style={styles.chartContainer}>
                {insights.dailyActivity.map((d, i) => {
                  const heightPercent = Math.max((d.count / maxDailyCount) * 100, 6);
                  const isSelected = targetDateFilter === d.date;
                  return (
                    <div
                      key={i}
                      style={{
                        ...styles.chartCol,
                        cursor: "pointer",
                        backgroundColor: isSelected ? "#DCFCE7" : "transparent",
                        borderRadius: 6,
                        padding: "4px 2px",
                        border: isSelected ? "1.5px solid #22C55E" : "1px solid transparent",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setTargetDateFilter(isSelected ? "" : d.date)}
                      title={`Click to filter by ${d.label} (${d.count} submissions)`}
                    >
                      <div style={styles.barWrap}>
                        {d.count > 0 && <span style={styles.barTooltip}>{d.count}</span>}
                        <div
                          style={{
                            ...styles.bar,
                            height: `${heightPercent}%`,
                            backgroundColor: isSelected ? "#00A884" : d.count > 0 ? "#128C7E" : "#E2E8F0",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          ...styles.chartDateLabel,
                          fontWeight: isSelected ? 800 : 500,
                          color: isSelected ? "#00A884" : "#64748B",
                        }}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Preferences */}
            <div style={{ ...styles.card, flex: 0.9 }}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>⏰ Peak Time Slots</h3>
                  <p style={styles.cardSubtitle}>Tap slot to filter submissions</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Morning */}
                <div
                  style={{
                    ...styles.slotRow,
                    cursor: "pointer",
                    backgroundColor: timeSlotFilter === "morning" ? "#FFF7ED" : "transparent",
                    border: timeSlotFilter === "morning" ? "1.5px solid #FB8C00" : "1px solid transparent",
                    borderRadius: 8,
                    padding: "6px 8px",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => setTimeSlotFilter(timeSlotFilter === "morning" ? "" : "morning")}
                  title="Click to filter by morning bookings"
                >
                  <div style={styles.slotHeader}>
                    <span style={{ fontWeight: 600, color: timeSlotFilter === "morning" ? "#C2410C" : "#111B21" }}>
                      {timeSlotFilter === "morning" ? "✓ " : ""}🌅 Morning (6 AM - 12 PM)
                    </span>
                    <strong>{insights.byTimeSlot.morning}</strong>
                  </div>
                  <div style={styles.slotTrack}>
                    <div
                      style={{
                        ...styles.slotFill,
                        width: `${Math.min((insights.byTimeSlot.morning / (insights.totalSubmissions || 1)) * 100, 100)}%`,
                        backgroundColor: "#FFA726",
                      }}
                    />
                  </div>
                </div>

                {/* Afternoon */}
                <div
                  style={{
                    ...styles.slotRow,
                    cursor: "pointer",
                    backgroundColor: timeSlotFilter === "afternoon" ? "#F0F9FF" : "transparent",
                    border: timeSlotFilter === "afternoon" ? "1.5px solid #0284C7" : "1px solid transparent",
                    borderRadius: 8,
                    padding: "6px 8px",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => setTimeSlotFilter(timeSlotFilter === "afternoon" ? "" : "afternoon")}
                  title="Click to filter by afternoon bookings"
                >
                  <div style={styles.slotHeader}>
                    <span style={{ fontWeight: 600, color: timeSlotFilter === "afternoon" ? "#0369A1" : "#111B21" }}>
                      {timeSlotFilter === "afternoon" ? "✓ " : ""}☀️ Afternoon (12 PM - 5 PM)
                    </span>
                    <strong>{insights.byTimeSlot.afternoon}</strong>
                  </div>
                  <div style={styles.slotTrack}>
                    <div
                      style={{
                        ...styles.slotFill,
                        width: `${Math.min((insights.byTimeSlot.afternoon / (insights.totalSubmissions || 1)) * 100, 100)}%`,
                        backgroundColor: "#29B6F6",
                      }}
                    />
                  </div>
                </div>

                {/* Evening */}
                <div
                  style={{
                    ...styles.slotRow,
                    cursor: "pointer",
                    backgroundColor: timeSlotFilter === "evening" ? "#FAF5FF" : "transparent",
                    border: timeSlotFilter === "evening" ? "1.5px solid #9333EA" : "1px solid transparent",
                    borderRadius: 8,
                    padding: "6px 8px",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => setTimeSlotFilter(timeSlotFilter === "evening" ? "" : "evening")}
                  title="Click to filter by evening bookings"
                >
                  <div style={styles.slotHeader}>
                    <span style={{ fontWeight: 600, color: timeSlotFilter === "evening" ? "#7E22CE" : "#111B21" }}>
                      {timeSlotFilter === "evening" ? "✓ " : ""}🌙 Evening (5 PM - 10 PM)
                    </span>
                    <strong>{insights.byTimeSlot.evening}</strong>
                  </div>
                  <div style={styles.slotTrack}>
                    <div
                      style={{
                        ...styles.slotFill,
                        width: `${Math.min((insights.byTimeSlot.evening / (insights.totalSubmissions || 1)) * 100, 100)}%`,
                        backgroundColor: "#7E57C2",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MULTI-TABLE TAB SELECTOR                                                 */}
        {/* ========================================================================= */}
        <div style={styles.tabsCard}>
          <div style={styles.tabsScroll}>
            <button
              style={selectedTab === "all" ? styles.tabActive : styles.tabInactive}
              onClick={() => setSelectedTab("all")}
            >
              📋 All Tables &amp; Records ({insights?.totalSubmissions || 0})
            </button>

            {templates.map((tpl) => {
              const count = insights?.byTemplate.find((b) => b.command === tpl.command)?.count || 0;
              const isActive = selectedTab === tpl.command;
              return (
                <button
                  key={tpl.id}
                  style={isActive ? styles.tabActive : styles.tabInactive}
                  onClick={() => setSelectedTab(tpl.command)}
                >
                  <span>{tpl.icon || "📋"}</span>
                  <span>{tpl.name}</span>
                  <span style={isActive ? styles.tabCountBadgeActive : styles.tabCountBadge}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE TAB INFO BAR */}
          <div style={styles.tabInfoBanner}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>
                {selectedTab === "all" ? "📊" : currentTemplate?.icon || "📋"}
              </span>
              <div>
                <strong>
                  {selectedTab === "all" ? "Master Unified Table" : currentTemplate?.name}
                </strong>
                <span style={{ fontSize: 12, color: "#667781", marginLeft: 8 }}>
                  {selectedTab === "all"
                    ? "Displaying submissions from all synchronized Google Sheet tabs"
                    : `Linked to Google Sheet tab: "${currentTemplate?.sheetName}" • ${currentTemplate?.fields?.length || 0} columns`}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#00796B", fontWeight: 600 }}>
              Showing {submissions.length} filtered records
            </div>
          </div>

          {/* ACTIVE CHART DRILLDOWN BAR */}
          {hasActiveDrilldown && (
            <div
              style={{
                backgroundColor: "#F0FDF4",
                border: "1px solid #86EFAC",
                borderRadius: 8,
                padding: "8px 14px",
                margin: "8px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>⚡ Active Chart Filter:</span>
                {sportFilter && (
                  <button
                    onClick={() => setSportFilter("")}
                    style={{
                      backgroundColor: "#DCFCE7",
                      border: "1px solid #22C55E",
                      color: "#15803D",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    🏟️ {sportFilter} ✕
                  </button>
                )}
                {targetDateFilter && (
                  <button
                    onClick={() => setTargetDateFilter("")}
                    style={{
                      backgroundColor: "#DCFCE7",
                      border: "1px solid #22C55E",
                      color: "#15803D",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    📅 {targetDateFilter} ✕
                  </button>
                )}
                {timeSlotFilter && (
                  <button
                    onClick={() => setTimeSlotFilter("")}
                    style={{
                      backgroundColor: "#DCFCE7",
                      border: "1px solid #22C55E",
                      color: "#15803D",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    ⏰ {timeSlotFilter.toUpperCase()} ✕
                  </button>
                )}
                {syncFilter && (
                  <button
                    onClick={() => setSyncFilter("")}
                    style={{
                      backgroundColor: "#DCFCE7",
                      border: "1px solid #22C55E",
                      color: "#15803D",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    🔄 {syncFilter === "synced" ? "Sheets Synced" : "In DB Only"} ✕
                  </button>
                )}
              </div>
              <button
                onClick={handleResetFilters}
                style={{
                  backgroundColor: "#FEE2E2",
                  border: "1px solid #F87171",
                  color: "#B91C1C",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Clear All ✕
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ADVANCED FILTER CONTROLS TOOLBAR                                          */}
          {/* ========================================================================= */}
          <div style={styles.filterToolbar}>
            {/* Search Input */}
            <div style={{ flex: 2, minWidth: 240 }}>
              <input
                style={styles.searchInput}
                placeholder="🔍 Search name, phone (+91), court, ref ID, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Date Range Dropdown */}
            <div style={{ minWidth: 150 }}>
              <select
                style={styles.selectInput}
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
              >
                <option value="all">📅 All Time</option>
                <option value="today">Today Only</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>
            </div>

            {/* Sport / Court Dropdown */}
            <div style={{ minWidth: 170 }}>
              <select
                style={styles.selectInput}
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
              >
                <option value="">🏟️ All Courts &amp; Sports</option>
                {(insights?.availableSports || [
                  "Tennis - Court 1",
                  "Tennis - Court 2",
                  "Tennis - Court 3",
                  "Tennis - Court 4",
                  "Badminton - Court 1",
                  "Badminton - Court 2",
                  "Football Turf A",
                  "Basketball Court",
                ]).map((sport, i) => (
                  <option key={i} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            {/* Sync Status Filter */}
            <div style={{ minWidth: 160 }}>
              <select
                style={styles.selectInput}
                value={syncFilter}
                onChange={(e) => setSyncFilter(e.target.value)}
              >
                <option value="">🔄 All Sync Statuses</option>
                <option value="synced">✅ Synced to Sheets</option>
                <option value="pending">⚠️ In DB Only</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(searchQuery || dateRange !== "all" || sportFilter || syncFilter || selectedTab !== "all" || timeSlotFilter || targetDateFilter) && (
              <button style={styles.resetBtn} onClick={handleResetFilters}>
                ✕ Reset
              </button>
            )}
          </div>

          {/* ========================================================================= */}
          {/* DATA TABLE                                                                */}
          {/* ========================================================================= */}
          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner} />
              <p style={{ color: "#667781", fontSize: 14 }}>Loading records &amp; tables...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div style={styles.emptyContainer}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#111B21", margin: 0 }}>
                No matching submissions found.
              </p>
              <p style={{ fontSize: 13, color: "#8696A0", marginTop: 6 }}>
                Try adjusting your filters, search term, or select another template tab.
              </p>
              <button style={styles.resetBtn} onClick={handleResetFilters}>
                Clear All Filters
              </button>
            </div>
          ) : (
            <div style={styles.tableResponsiveWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeadRow}>
                    <th style={styles.th}>Ref ID &amp; Time</th>
                    {selectedTab === "all" && <th style={styles.th}>Template / Tab</th>}
                    <th style={styles.th}>Submitter (Phone Key)</th>

                    {/* Dynamic Template Specific Columns */}
                    {selectedTab !== "all" &&
                      tableColumns.map((col) => (
                        <th key={col.key} style={styles.th}>
                          {col.label}
                        </th>
                      ))}

                    {selectedTab === "all" && <th style={styles.th}>Details Summary</th>}
                    <th style={styles.th}>Sync Status</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => {
                    const data = sub.data || {};

                    return (
                      <tr
                        key={sub.id}
                        style={styles.tableRow}
                        onClick={() => setSelectedSubmission(sub)}
                      >
                        {/* Ref ID & Time */}
                        <td style={styles.td}>
                          <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#00A884", fontSize: 12 }}>
                            {sub.submissionRef || sub.id.slice(0, 10)}
                          </div>
                          <div style={{ fontSize: 11, color: "#8696A0", marginTop: 2 }}>
                            {new Date(sub.createdAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Template Tab (Only in All mode) */}
                        {selectedTab === "all" && (
                          <td style={styles.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span>{sub.template?.icon || "📋"}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                  {sub.template?.name || sub.templateCommand}
                                </div>
                                <span style={styles.tabBadgeSmall}>
                                  📊 {sub.sheetName}
                                </span>
                              </div>
                            </div>
                          </td>
                        )}

                        {/* Submitter & Phone Key */}
                        <td style={styles.td}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {sub.userName || data["Full Name"] || data["Member Name"] || data["Athlete Name"] || "Member"}
                          </div>
                          {sub.userPhone && (
                            <a
                              href={`tel:${sub.userPhone}`}
                              style={styles.phoneLink}
                              onClick={(e) => e.stopPropagation()}
                            >
                              📞 {sub.userPhone}
                            </a>
                          )}
                        </td>

                        {/* Dynamic Fields for specific template */}
                        {selectedTab !== "all" &&
                          tableColumns.map((col) => {
                            const val = data[col.label] ?? data[col.key] ?? "";
                            const isCourt =
                              col.label.toLowerCase().includes("sport") ||
                              col.label.toLowerCase().includes("court");

                            return (
                              <td key={col.key} style={styles.td}>
                                {isCourt && val ? (
                                  <span style={styles.courtBadge}>
                                    🎾 {String(val)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 13, color: "#111B21" }}>
                                    {val ? String(val) : "—"}
                                  </span>
                                )}
                              </td>
                            );
                          })}

                        {/* Details Summary for All mode */}
                        {selectedTab === "all" && (
                          <td style={{ ...styles.td, maxWidth: 300 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {Object.entries(data).slice(0, 3).map(([k, v]) => (
                                <span key={k} style={styles.chipMini}>
                                  <strong>{k}:</strong> {String(v)}
                                </span>
                              ))}
                              {Object.keys(data).length > 3 && (
                                <span style={{ fontSize: 11, color: "#8696A0", alignSelf: "center" }}>
                                  +{Object.keys(data).length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Sync Status */}
                        <td style={styles.td}>
                          {sub.syncedToSheet ? (
                            <span style={styles.badgeSynced}>
                              ✅ Synced to Sheet
                            </span>
                          ) : (
                            <span style={styles.badgePending}>
                              ⚠️ In DB Only
                            </span>
                          )}
                        </td>

                        {/* View Button */}
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <button
                            style={styles.viewBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubmission(sub);
                            }}
                          >
                            👁️ View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* ROW DETAIL MODAL / DRAWER                                                 */}
      {/* ========================================================================= */}
      {selectedSubmission && (
        <div style={styles.modalOverlay} onClick={() => setSelectedSubmission(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>
                  {selectedSubmission.template?.icon || "📋"}
                </span>
                <div>
                  <h3 style={styles.modalTitle}>
                    {selectedSubmission.template?.name || selectedSubmission.templateCommand} Record
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#00A884", fontWeight: 700 }}>
                    Ref: {selectedSubmission.submissionRef || selectedSubmission.id}
                  </p>
                </div>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setSelectedSubmission(null)}>
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Top Sync & Timestamp Row */}
              <div style={styles.modalMetaRow}>
                <div>
                  <div style={styles.metaLabel}>GOOGLE SHEET TAB</div>
                  <div style={styles.metaValue}>📊 {selectedSubmission.sheetName}</div>
                </div>
                <div>
                  <div style={styles.metaLabel}>TIMESTAMP</div>
                  <div style={styles.metaValue}>
                    {new Date(selectedSubmission.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={styles.metaLabel}>SYNC STATUS</div>
                  <div>
                    {selectedSubmission.syncedToSheet ? (
                      <span style={styles.badgeSynced}>✅ Synced to Sheets</span>
                    ) : (
                      <span style={styles.badgePending}>⚠️ DB Only</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Submitter Info Card */}
              <div style={styles.submitterCard}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2E7D32", marginBottom: 6 }}>
                  👤 Submitter Information (Mobile Key)
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#667781" }}>Name: </span>
                    <strong style={{ fontSize: 13, color: "#111B21" }}>
                      {selectedSubmission.userName || selectedSubmission.data?.["Full Name"] || "Member"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#667781" }}>Phone: </span>
                    <strong style={{ fontSize: 13, color: "#111B21" }}>
                      {selectedSubmission.userPhone || "Not provided"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Full Form Data Fields */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#54656F", marginBottom: 8, textTransform: "uppercase" }}>
                  Form Submission Data
                </div>

                <div style={styles.fieldsGrid}>
                  {Object.entries(selectedSubmission.data || {}).map(([key, val]) => (
                    <div key={key} style={styles.fieldItem}>
                      <div style={styles.fieldKey}>{key}</div>
                      <div style={styles.fieldVal}>{String(val)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSubmission.rawMessage && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "#8696A0", fontWeight: 600 }}>Raw Prompt / Message:</div>
                  <div style={styles.rawMessageCard}>
                    &ldquo;{selectedSubmission.rawMessage}&rdquo;
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                style={{ ...styles.btnHeader, backgroundColor: "#00A884", color: "#fff" }}
                onClick={() => setSelectedSubmission(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- High-Aesthetic Modern CSS Styles ---

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F0F2F5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#111B21",
  },
  header: {
    background: "linear-gradient(135deg, #075E54 0%, #128C7E 50%, #00A884 100%)",
    color: "#FFFFFF",
    padding: "16px 28px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
  },
  headerContent: {
    maxWidth: 1360,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    letterSpacing: -0.3,
  },
  liveBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    padding: "3px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    margin: "2px 0 0",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  btnHeader: {
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  headerLink: {
    color: "#FFFFFF",
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.35)",
    padding: "7px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  container: {
    maxWidth: 1360,
    margin: "20px auto",
    padding: "0 16px 40px",
  },

  // KPI Grid
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  kpiCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: "18px 20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 14,
    border: "1px solid #E9EDEF",
  },
  kpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E0F2F1",
    color: "#00796B",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    flexShrink: 0,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#667781",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111B21",
    margin: "2px 0",
  },
  kpiSub: {
    fontSize: 11,
    color: "#8696A0",
  },

  // Analytics Row
  analyticsRow: {
    display: "flex",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    border: "1px solid #E9EDEF",
    minWidth: 280,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111B21",
    margin: 0,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#667781",
    margin: "2px 0 0",
  },
  badgePill: {
    backgroundColor: "#E8F5E9",
    color: "#2E7D32",
    padding: "3px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  emptyCardText: {
    fontSize: 13,
    color: "#8696A0",
    padding: "20px 0",
    textAlign: "center",
  },

  // Chart Container
  chartContainer: {
    display: "flex",
    alignItems: "flex-end",
    gap: 6,
    height: 140,
    paddingTop: 24,
    borderBottom: "1px solid #E2E8F0",
  },
  chartCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barWrap: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  barTooltip: {
    fontSize: 9,
    fontWeight: 700,
    color: "#00A884",
    marginBottom: 2,
  },
  bar: {
    width: "70%",
    minHeight: 4,
    borderRadius: 4,
  },
  chartDateLabel: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 6,
    whiteSpace: "nowrap",
  },

  // Time slot row
  slotRow: {
    marginBottom: 8,
  },
  slotHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#111B21",
    marginBottom: 4,
  },
  slotTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  slotFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Multi-table tabs container
  tabsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    border: "1px solid #E9EDEF",
    overflow: "hidden",
  },
  tabsScroll: {
    display: "flex",
    gap: 6,
    padding: "16px 20px 10px",
    overflowX: "auto",
    borderBottom: "1px solid #F0F2F5",
  },
  tabActive: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #075E54 0%, #128C7E 100%)",
    color: "#FFFFFF",
    border: "none",
    padding: "8px 16px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tabInactive: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F7F8FA",
    color: "#54656F",
    border: "1px solid #E0E0E0",
    padding: "8px 16px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tabCountBadge: {
    backgroundColor: "#E0E0E0",
    color: "#111B21",
    padding: "1px 6px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
  },
  tabCountBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
    color: "#FFFFFF",
    padding: "1px 6px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
  },
  tabInfoBanner: {
    padding: "10px 20px",
    backgroundColor: "#F8FAFC",
    borderBottom: "1px solid #F0F2F5",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  // Filter Toolbar
  filterToolbar: {
    display: "flex",
    gap: 10,
    padding: "14px 20px",
    borderBottom: "1px solid #F0F2F5",
    backgroundColor: "#FFFFFF",
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchInput: {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #CFD8DC",
    borderRadius: 8,
    fontSize: 13,
    boxSizing: "border-box",
    backgroundColor: "#FAFAFA",
    color: "#111B21",
  },
  selectInput: {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #CFD8DC",
    borderRadius: 8,
    fontSize: 13,
    backgroundColor: "#FAFAFA",
    color: "#111B21",
  },
  resetBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #EF5350",
    backgroundColor: "#FFEBEE",
    color: "#C62828",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  // Table
  tableResponsiveWrapper: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  tableHeadRow: {
    backgroundColor: "#F8FAFC",
    borderBottom: "2px solid #E2E8F0",
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    fontSize: 12,
    fontWeight: 700,
    color: "#54656F",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    borderBottom: "1px solid #F0F2F5",
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  td: {
    padding: "12px 16px",
    verticalAlign: "middle",
  },
  phoneLink: {
    fontSize: 12,
    color: "#00A884",
    textDecoration: "none",
    fontWeight: 600,
    display: "block",
    marginTop: 2,
  },
  tabBadgeSmall: {
    display: "inline-block",
    backgroundColor: "#E0F2F1",
    color: "#00796B",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    marginTop: 2,
  },
  courtBadge: {
    display: "inline-block",
    backgroundColor: "#EDE7F6",
    color: "#512DA8",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
  },
  chipMini: {
    backgroundColor: "#F1F5F9",
    border: "1px solid #E2E8F0",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 11,
  },
  badgeSynced: {
    backgroundColor: "#E8F5E9",
    color: "#2E7D32",
    padding: "3px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
  },
  badgePending: {
    backgroundColor: "#FFF3E0",
    color: "#E65100",
    padding: "3px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
  },
  viewBtn: {
    backgroundColor: "#F0F2F5",
    border: "1px solid #CFD8DC",
    color: "#075E54",
    padding: "5px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  // Loading & Empty States
  loadingContainer: {
    padding: 60,
    textAlign: "center",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "4px solid #E2E8F0",
    borderTop: "4px solid #00A884",
    borderRadius: "50%",
    margin: "0 auto 12px",
    animation: "spin 1s linear infinite",
  },
  emptyContainer: {
    padding: 60,
    textAlign: "center",
  },

  // Modal / Drawer
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11,20,26,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 580,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
  },
  modalHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #F0F2F5",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#111B21",
    margin: 0,
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    fontSize: 18,
    color: "#667781",
    cursor: "pointer",
    fontWeight: 700,
  },
  modalBody: {
    padding: 20,
  },
  modalMetaRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    paddingBottom: 14,
    borderBottom: "1px solid #F0F2F5",
    marginBottom: 14,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#8696A0",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: 600,
    color: "#111B21",
  },
  submitterCard: {
    backgroundColor: "#F4FDF9",
    border: "1px solid #C8E6C9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  fieldItem: {
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "8px 12px",
  },
  fieldKey: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748B",
    marginBottom: 2,
  },
  fieldVal: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0F172A",
  },
  rawMessageCard: {
    fontSize: 12,
    color: "#54656F",
    fontStyle: "italic",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
    border: "1px solid #E2E8F0",
  },
  modalFooter: {
    padding: "12px 20px",
    borderTop: "1px solid #F0F2F5",
    display: "flex",
    justifyContent: "flex-end",
  },
};
