import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  StatusBar,
  Image,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Colors, Fonts, Spacing, Radius } from "../theme/tokens";
import { getDashboardData, BASE_URL, DEFAULT_FALLBACK_TEMPLATES } from "../api/client";
import { MOCK_CURRENT_USER } from "../data/mockData";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

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

// Fallback mock records when offline
const MOCK_FALLBACK_SUBMISSIONS: SubmissionItem[] = [
  {
    id: "sub-mock-1",
    submissionRef: "BK-8841",
    tenantId: "default",
    conversationId: "conv-1",
    templateId: "tpl-booking",
    templateCommand: "booking",
    sheetName: "Facility Bookings",
    userName: "Rohan Sharma",
    userPhone: "+91 98765 43210",
    data: {
      "Phone Number": "+91 98765 43210",
      "Full Name": "Rohan Sharma",
      "Sport / Facility": "Tennis - Court 1",
      "Booking Date": "2026-09-05",
      "Time Slot": "06:00 AM",
      Duration: "1 Hr 00 Min",
      "No. of Players": "2",
    },
    rawMessage: "/booking Tennis - Court 1",
    status: "CONFIRMED",
    syncedToSheet: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template: {
      name: "Facility & Court Booking",
      command: "booking",
      icon: "🏟️",
      sheetName: "Facility Bookings",
      fields: [],
    },
  },
  {
    id: "sub-mock-2",
    submissionRef: "BK-8842",
    tenantId: "default",
    conversationId: "conv-1",
    templateId: "tpl-booking",
    templateCommand: "booking",
    sheetName: "Facility Bookings",
    userName: "Ananya Roy",
    userPhone: "+91 98765 11223",
    data: {
      "Phone Number": "+91 98765 11223",
      "Full Name": "Ananya Roy",
      "Sport / Facility": "Tennis - Court 2",
      "Booking Date": "2026-09-05",
      "Time Slot": "07:00 PM",
      Duration: "2 Hr 00 Min",
      "No. of Players": "4",
    },
    rawMessage: "/booking Tennis - Court 2",
    status: "CONFIRMED",
    syncedToSheet: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    template: {
      name: "Facility & Court Booking",
      command: "booking",
      icon: "🏟️",
      sheetName: "Facility Bookings",
      fields: [],
    },
  },
  {
    id: "sub-mock-3",
    submissionRef: "MB-2041",
    tenantId: "default",
    conversationId: "conv-1",
    templateId: "tpl-membership",
    templateCommand: "membership",
    sheetName: "Memberships",
    userName: "Aarav Mehta",
    userPhone: "+91 98765 77889",
    data: {
      "Member Name": "Aarav Mehta",
      "Contact Phone": "+91 98765 77889",
      "Sport Program": "Badminton",
      "Membership Plan": "Annual Academy",
    },
    rawMessage: "/membership Badminton",
    status: "CONFIRMED",
    syncedToSheet: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    template: {
      name: "Academy & Club Membership",
      command: "membership",
      icon: "🏅",
      sheetName: "Memberships",
      fields: [],
    },
  },
];

export function DashboardScreen({ navigation }: Props) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [templates, setTemplates] = useState<any[]>(DEFAULT_FALLBACK_TEMPLATES);
  const [insights, setInsights] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [selectedCommand, setSelectedCommand] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [sportFilter, setSportFilter] = useState<string>("");
  const [syncFilter, setSyncFilter] = useState<string>("");

  // Interactive Chart View Modes & Drilldown Filters
  const [activeChartTab, setActiveChartTab] = useState<"courts" | "velocity" | "slots" | "sync">("courts");
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>("");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("");
  const [chartExpanded, setChartExpanded] = useState<boolean>(true);

  // Detail Modal
  const [activeDetail, setActiveDetail] = useState<SubmissionItem | null>(null);

  // Set up header with explicit return button
  useEffect(() => {
    navigation.setOptions({
      title: "Analytics & Data Hub",
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity
          style={{
            backgroundColor: "rgba(255,255,255,0.2)",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            marginLeft: 6,
          }}
          onPress={() => navigation.navigate("ConversationList")}
          activeOpacity={0.7}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
            ← Chats
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const loadData = useCallback(async () => {
    try {
      const res = await getDashboardData({
        tenantId: MOCK_CURRENT_USER.tenantId,
        command: selectedCommand,
        search: searchQuery,
        sport: sportFilter,
        sync: syncFilter,
        startDate:
          dateFilter === "today"
            ? new Date().toISOString().slice(0, 10)
            : dateFilter === "week"
            ? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
            : dateFilter === "month"
            ? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
            : undefined,
      });

      if (res && res.ok && res.data) {
        setSubmissions(res.data.submissions || []);
        if (res.data.templates && res.data.templates.length > 0) {
          setTemplates(res.data.templates);
        }
        setInsights(res.data.insights || null);
      } else {
        // Fall back gracefully to mock data
        setSubmissions(MOCK_FALLBACK_SUBMISSIONS);
      }
    } catch {
      setSubmissions(MOCK_FALLBACK_SUBMISSIONS);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCommand, searchQuery, dateFilter, sportFilter, syncFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleOpenWebView = () => {
    const url = `${BASE_URL}/dashboard`;
    Linking.openURL(url).catch(() => {
      // Fallback
    });
  };

  const handleResetFilters = () => {
    setSelectedCommand("all");
    setSearchQuery("");
    setDateFilter("all");
    setSportFilter("");
    setSyncFilter("");
    setTimeSlotFilter("");
    setSelectedDayFilter("");
  };

  // Dynamic Chart Computations
  const courtChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sub of submissions) {
      const data = sub.data || {};
      const sport = data["Sport / Facility"] || data["Sport"] || data["Target Sport"] || data["Sport Program"] || "Other Facility";
      map[sport] = (map[sport] || 0) + 1;
    }
    const colors = ["#00897B", "#1E88E5", "#8E24AA", "#FB8C00", "#43A047", "#D81B60", "#3949AB", "#00ACC1"];
    const total = submissions.length || 1;
    return Object.entries(map)
      .map(([sport, count], idx) => ({
        sport,
        count,
        percentage: Math.round((count / total) * 100),
        color: colors[idx % colors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [submissions]);

  const velocityChartData = useMemo(() => {
    const days: Array<{ dateStr: string; label: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const count = submissions.filter((s) => {
        const cDate = (s.createdAt || "").slice(0, 10);
        const fDate = s.data?.["Booking Date"] || "";
        return cDate === dateStr || fDate === dateStr;
      }).length;
      days.push({ dateStr, label, count });
    }
    const maxCount = Math.max(...days.map((d) => d.count), 1);
    return { days, maxCount };
  }, [submissions]);

  const timeSlotChartData = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let evening = 0;
    for (const sub of submissions) {
      const dStr = JSON.stringify(sub.data || {}).toLowerCase();
      if (dStr.includes("am") || dStr.includes("06:") || dStr.includes("07:") || dStr.includes("08:") || dStr.includes("09:") || dStr.includes("10:") || dStr.includes("11:")) {
        morning++;
      } else if (dStr.includes("12:") || dStr.includes("01:") || dStr.includes("02:") || dStr.includes("03:") || dStr.includes("04:")) {
        afternoon++;
      } else if (dStr.includes("pm") || dStr.includes("05:") || dStr.includes("06:") || dStr.includes("07:") || dStr.includes("08:") || dStr.includes("09:")) {
        evening++;
      }
    }
    const total = (morning + afternoon + evening) || 1;
    return {
      morning: { count: morning, pct: Math.round((morning / total) * 100) },
      afternoon: { count: afternoon, pct: Math.round((afternoon / total) * 100) },
      evening: { count: evening, pct: Math.round((evening / total) * 100) },
      total: morning + afternoon + evening,
    };
  }, [submissions]);

  const syncHealthData = useMemo(() => {
    const synced = submissions.filter((s) => s.syncedToSheet).length;
    const pending = submissions.length - synced;
    const rate = submissions.length > 0 ? Math.round((synced / submissions.length) * 100) : 100;
    return { synced, pending, rate };
  }, [submissions]);

  // Filtered in memory if offline
  const displaySubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (selectedCommand !== "all" && sub.templateCommand !== selectedCommand) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nMatch = (sub.userName || "").toLowerCase().includes(q);
        const pMatch = (sub.userPhone || "").toLowerCase().includes(q);
        const rMatch = (sub.submissionRef || "").toLowerCase().includes(q);
        const dMatch = JSON.stringify(sub.data || {}).toLowerCase().includes(q);
        if (!nMatch && !pMatch && !rMatch && !dMatch) return false;
      }
      if (sportFilter) {
        const dStr = JSON.stringify(sub.data || {}).toLowerCase();
        if (!dStr.includes(sportFilter.toLowerCase())) return false;
      }
      if (timeSlotFilter) {
        const dStr = JSON.stringify(sub.data || {}).toLowerCase();
        if (timeSlotFilter === "morning" && !(dStr.includes("am") || dStr.includes("06:") || dStr.includes("07:") || dStr.includes("08:") || dStr.includes("09:") || dStr.includes("10:") || dStr.includes("11:"))) return false;
        if (timeSlotFilter === "afternoon" && !(dStr.includes("12:") || dStr.includes("01:") || dStr.includes("02:") || dStr.includes("03:") || dStr.includes("04:"))) return false;
        if (timeSlotFilter === "evening" && !(dStr.includes("pm") || dStr.includes("05:") || dStr.includes("06:") || dStr.includes("07:") || dStr.includes("08:") || dStr.includes("09:"))) return false;
      }
      if (selectedDayFilter) {
        const subDate = (sub.createdAt || "").slice(0, 10);
        const formDate = sub.data?.["Booking Date"] || sub.data?.["Date"] || "";
        if (!subDate.includes(selectedDayFilter) && !formDate.includes(selectedDayFilter)) return false;
      }
      if (syncFilter === "synced" && !sub.syncedToSheet) return false;
      if (syncFilter === "pending" && sub.syncedToSheet) return false;
      return true;
    });
  }, [submissions, selectedCommand, searchQuery, sportFilter, syncFilter, timeSlotFilter, selectedDayFilter]);

  const totalCount = insights?.totalSubmissions || submissions.length;
  const syncedRate = syncHealthData.rate;
  const todayCount = insights?.submissionsToday || 2;

  const availableCourts = [
    "Tennis - Court 1",
    "Tennis - Court 2",
    "Tennis - Court 3",
    "Tennis - Court 4",
    "Badminton - Court 1",
    "Football Turf A",
  ];

  const hasActiveDrilldown = Boolean(sportFilter || timeSlotFilter || selectedDayFilter || syncFilter);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.headerBackground} barStyle="light-content" />

      {/* TOP BANNER */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={[styles.avatarCircle, { backgroundColor: "#000000", overflow: "hidden" }]}>
            <Image
              source={require("../../assets/icon.png")}
              style={{ width: 42, height: 42, borderRadius: 10 }}
              resizeMode="cover"
            />
          </View>
          <View style={styles.headerInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.headerTitle}>OFA Sports Hub</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>🟢 Live Sync</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Tables, Submissions &amp; Analytics
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity style={styles.btnHeader} onPress={handleRefresh}>
              <Text style={styles.btnHeaderText}>
                {isRefreshing ? "..." : "🔄 Refresh"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnHeader, styles.btnHeaderGreen]}
              onPress={handleOpenWebView}
            >
              <Text style={styles.btnHeaderGreenText}>🌐 Web</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* METRICS ROW */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{totalCount}</Text>
            <Text style={styles.metricLabel}>TOTAL RECORDS</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: "#2E7D32" }]}>{todayCount}</Text>
            <Text style={styles.metricLabel}>TODAY</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: "#00796B" }]}>{syncedRate}%</Text>
            <Text style={styles.metricLabel}>SHEETS SYNC</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: "#512DA8" }]}>{templates.length}</Text>
            <Text style={styles.metricLabel}>TABLES</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* INTERACTIVE VISUAL CHARTS & GRAPHS MODULE */}
        <View style={styles.chartMasterCard}>
          <View style={styles.chartMasterHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.chartMasterTitle}>📊 Visual Analytics & Insights</Text>
                <View style={styles.interactivePill}>
                  <Text style={styles.interactivePillText}>Interactive</Text>
                </View>
              </View>
              <Text style={styles.chartMasterSubtitle}>
                Tap bars, columns, or time slots to drill-down and filter data
              </Text>
            </View>
            <TouchableOpacity
              style={styles.expandToggleBtn}
              onPress={() => setChartExpanded(!chartExpanded)}
            >
              <Text style={styles.expandToggleText}>
                {chartExpanded ? "▲ Hide" : "▼ Show"}
              </Text>
            </TouchableOpacity>
          </View>

          {chartExpanded && (
            <>
              {/* Chart Sub-Tabs */}
              <View style={styles.chartNavTabs}>
                <TouchableOpacity
                  style={[
                    styles.chartNavTab,
                    activeChartTab === "courts" && styles.chartNavTabActive,
                  ]}
                  onPress={() => setActiveChartTab("courts")}
                >
                  <Text
                    style={[
                      styles.chartNavTabText,
                      activeChartTab === "courts" && styles.chartNavTabTextActive,
                    ]}
                  >
                    🏟️ Facilities
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chartNavTab,
                    activeChartTab === "velocity" && styles.chartNavTabActive,
                  ]}
                  onPress={() => setActiveChartTab("velocity")}
                >
                  <Text
                    style={[
                      styles.chartNavTabText,
                      activeChartTab === "velocity" && styles.chartNavTabTextActive,
                    ]}
                  >
                    📈 14-Day Velocity
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chartNavTab,
                    activeChartTab === "slots" && styles.chartNavTabActive,
                  ]}
                  onPress={() => setActiveChartTab("slots")}
                >
                  <Text
                    style={[
                      styles.chartNavTabText,
                      activeChartTab === "slots" && styles.chartNavTabTextActive,
                    ]}
                  >
                    ⏰ Time Slots
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chartNavTab,
                    activeChartTab === "sync" && styles.chartNavTabActive,
                  ]}
                  onPress={() => setActiveChartTab("sync")}
                >
                  <Text
                    style={[
                      styles.chartNavTabText,
                      activeChartTab === "sync" && styles.chartNavTabTextActive,
                    ]}
                  >
                    🔄 Sync Health
                  </Text>
                </TouchableOpacity>
              </View>

              {/* TAB 1: COURTS & FACILITIES */}
              {activeChartTab === "courts" && (
                <View style={styles.chartBody}>
                  <View style={styles.chartBodyHeader}>
                    <Text style={styles.chartBodyTitle}>Court & Facility Distribution</Text>
                    <Text style={styles.chartBodyHint}>Touch any facility to filter</Text>
                  </View>
                  {courtChartData.length === 0 ? (
                    <Text style={styles.chartEmptyText}>No facility booking records found</Text>
                  ) : (
                    <View style={styles.courtBarList}>
                      {courtChartData.map((item, idx) => {
                        const isSelected = sportFilter.toLowerCase() === item.sport.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[
                              styles.courtBarRow,
                              isSelected && styles.courtBarRowSelected,
                            ]}
                            onPress={() => {
                              if (isSelected) {
                                setSportFilter("");
                              } else {
                                setSportFilter(item.sport);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.courtBarLabels}>
                              <Text
                                style={[
                                  styles.courtBarName,
                                  isSelected && { color: "#00A884", fontWeight: "800" },
                                ]}
                                numberOfLines={1}
                              >
                                {isSelected ? "✓ " : ""}{item.sport}
                              </Text>
                              <Text style={styles.courtBarValue}>
                                {item.count} ({item.percentage}%)
                              </Text>
                            </View>
                            <View style={styles.courtBarTrack}>
                              <View
                                style={[
                                  styles.courtBarFill,
                                  {
                                    width: `${Math.max(item.percentage, 6)}%`,
                                    backgroundColor: isSelected ? "#00A884" : item.color,
                                  },
                                ]}
                              />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* TAB 2: 14-DAY VELOCITY HISTOGRAM */}
              {activeChartTab === "velocity" && (
                <View style={styles.chartBody}>
                  <View style={styles.chartBodyHeader}>
                    <Text style={styles.chartBodyTitle}>14-Day Booking Velocity</Text>
                    <Text style={styles.chartBodyHint}>Tap a day column to filter records</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.velocityChartContainer}
                  >
                    {velocityChartData.days.map((day, idx) => {
                      const isSelected = selectedDayFilter === day.dateStr;
                      const heightPercent = Math.max((day.count / velocityChartData.maxCount) * 100, 8);
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.velocityColumn,
                            isSelected && styles.velocityColumnSelected,
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedDayFilter("");
                            } else {
                              setSelectedDayFilter(day.dateStr);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          {day.count > 0 ? (
                            <Text
                              style={[
                                styles.velocityCountBadge,
                                isSelected && { color: "#00A884", fontWeight: "800" },
                              ]}
                            >
                              {day.count}
                            </Text>
                          ) : null}
                          <View style={styles.velocityBarWrap}>
                            <View
                              style={[
                                styles.velocityBarFill,
                                {
                                  height: `${heightPercent}%`,
                                  backgroundColor: isSelected
                                    ? "#00A884"
                                    : day.count > 0
                                    ? "#128C7E"
                                    : "#E2E8F0",
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.velocityDayLabel,
                              isSelected && { color: "#00A884", fontWeight: "800" },
                            ]}
                          >
                            {day.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* TAB 3: TIME SLOTS */}
              {activeChartTab === "slots" && (
                <View style={styles.chartBody}>
                  <View style={styles.chartBodyHeader}>
                    <Text style={styles.chartBodyTitle}>Peak Usage Slots</Text>
                    <Text style={styles.chartBodyHint}>Tap slot card to filter submissions</Text>
                  </View>
                  <View style={styles.slotCardsRow}>
                    {/* Morning */}
                    <TouchableOpacity
                      style={[
                        styles.slotCard,
                        timeSlotFilter === "morning" && styles.slotCardSelected,
                      ]}
                      onPress={() => setTimeSlotFilter(timeSlotFilter === "morning" ? "" : "morning")}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.slotCardIcon}>🌅</Text>
                      <Text style={styles.slotCardTitle}>Morning</Text>
                      <Text style={styles.slotCardSub}>6 AM – 12 PM</Text>
                      <Text style={[styles.slotCardCount, { color: "#FB8C00" }]}>
                        {timeSlotChartData.morning.count}
                      </Text>
                      <View style={styles.slotMiniTrack}>
                        <View
                          style={[
                            styles.slotMiniFill,
                            {
                              width: `${timeSlotChartData.morning.pct}%`,
                              backgroundColor: "#FB8C00",
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.slotPctText}>{timeSlotChartData.morning.pct}% volume</Text>
                    </TouchableOpacity>

                    {/* Afternoon */}
                    <TouchableOpacity
                      style={[
                        styles.slotCard,
                        timeSlotFilter === "afternoon" && styles.slotCardSelected,
                      ]}
                      onPress={() => setTimeSlotFilter(timeSlotFilter === "afternoon" ? "" : "afternoon")}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.slotCardIcon}>☀️</Text>
                      <Text style={styles.slotCardTitle}>Afternoon</Text>
                      <Text style={styles.slotCardSub}>12 PM – 5 PM</Text>
                      <Text style={[styles.slotCardCount, { color: "#1E88E5" }]}>
                        {timeSlotChartData.afternoon.count}
                      </Text>
                      <View style={styles.slotMiniTrack}>
                        <View
                          style={[
                            styles.slotMiniFill,
                            {
                              width: `${timeSlotChartData.afternoon.pct}%`,
                              backgroundColor: "#1E88E5",
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.slotPctText}>{timeSlotChartData.afternoon.pct}% volume</Text>
                    </TouchableOpacity>

                    {/* Evening */}
                    <TouchableOpacity
                      style={[
                        styles.slotCard,
                        timeSlotFilter === "evening" && styles.slotCardSelected,
                      ]}
                      onPress={() => setTimeSlotFilter(timeSlotFilter === "evening" ? "" : "evening")}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.slotCardIcon}>🌙</Text>
                      <Text style={styles.slotCardTitle}>Evening</Text>
                      <Text style={styles.slotCardSub}>5 PM – 10 PM</Text>
                      <Text style={[styles.slotCardCount, { color: "#8E24AA" }]}>
                        {timeSlotChartData.evening.count}
                      </Text>
                      <View style={styles.slotMiniTrack}>
                        <View
                          style={[
                            styles.slotMiniFill,
                            {
                              width: `${timeSlotChartData.evening.pct}%`,
                              backgroundColor: "#8E24AA",
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.slotPctText}>{timeSlotChartData.evening.pct}% volume</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* TAB 4: SYNC HEALTH */}
              {activeChartTab === "sync" && (
                <View style={styles.chartBody}>
                  <View style={styles.chartBodyHeader}>
                    <Text style={styles.chartBodyTitle}>Google Sheets Integration Health</Text>
                    <Text style={styles.chartBodyHint}>Tap to filter by sync status</Text>
                  </View>
                  <View style={styles.syncRow}>
                    <TouchableOpacity
                      style={[
                        styles.syncCard,
                        syncFilter === "synced" && styles.syncCardSelected,
                      ]}
                      onPress={() => setSyncFilter(syncFilter === "synced" ? "" : "synced")}
                      activeOpacity={0.7}
                    >
                      <View style={styles.syncIconWrapGreen}>
                        <Text style={{ fontSize: 20 }}>✅</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.syncCardTitle}>Synced to Sheets</Text>
                        <Text style={styles.syncCardSub}>Automated 2-way Google Sheets export</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.syncCountBig, { color: "#2E7D32" }]}>
                          {syncHealthData.synced}
                        </Text>
                        <Text style={styles.syncRateText}>{syncHealthData.rate}% rate</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.syncCard,
                        syncFilter === "pending" && styles.syncCardSelected,
                      ]}
                      onPress={() => setSyncFilter(syncFilter === "pending" ? "" : "pending")}
                      activeOpacity={0.7}
                    >
                      <View style={styles.syncIconWrapAmber}>
                        <Text style={{ fontSize: 20 }}>⏳</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.syncCardTitle}>Pending Sync</Text>
                        <Text style={styles.syncCardSub}>Queued for cloud synchronization</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.syncCountBig, { color: "#E65100" }]}>
                          {syncHealthData.pending}
                        </Text>
                        <Text style={styles.syncRateText}>Queued</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* ACTIVE DRILLDOWN FILTER BAR */}
        {hasActiveDrilldown && (
          <View style={styles.activeDrilldownBar}>
            <Text style={styles.activeDrilldownTitle}>⚡ Active Chart Drilldown Filters:</Text>
            <View style={styles.drilldownBadgesRow}>
              {sportFilter ? (
                <TouchableOpacity style={styles.drilldownBadge} onPress={() => setSportFilter("")}>
                  <Text style={styles.drilldownBadgeText}>🏟️ {sportFilter} ✕</Text>
                </TouchableOpacity>
              ) : null}
              {selectedDayFilter ? (
                <TouchableOpacity style={styles.drilldownBadge} onPress={() => setSelectedDayFilter("")}>
                  <Text style={styles.drilldownBadgeText}>📅 {selectedDayFilter} ✕</Text>
                </TouchableOpacity>
              ) : null}
              {timeSlotFilter ? (
                <TouchableOpacity style={styles.drilldownBadge} onPress={() => setTimeSlotFilter("")}>
                  <Text style={styles.drilldownBadgeText}>⏰ {timeSlotFilter.toUpperCase()} ✕</Text>
                </TouchableOpacity>
              ) : null}
              {syncFilter ? (
                <TouchableOpacity style={styles.drilldownBadge} onPress={() => setSyncFilter("")}>
                  <Text style={styles.drilldownBadgeText}>🔄 {syncFilter === "synced" ? "Synced" : "Pending"} ✕</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.clearAllBadge} onPress={handleResetFilters}>
                <Text style={styles.clearAllBadgeText}>Clear All ✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MULTI-TABLE CATEGORY TABS */}
        <Text style={styles.sectionHeader}>SELECT TABLE / CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          <TouchableOpacity
            style={[
              styles.tabPill,
              selectedCommand === "all" && styles.tabPillActive,
            ]}
            onPress={() => setSelectedCommand("all")}
          >
            <Text
              style={[
                styles.tabPillText,
                selectedCommand === "all" && styles.tabPillTextActive,
              ]}
            >
              📋 All Tables ({totalCount})
            </Text>
          </TouchableOpacity>

          {templates.map((tpl) => {
            const isActive = selectedCommand === tpl.command;
            return (
              <TouchableOpacity
                key={tpl.id || tpl.command}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => setSelectedCommand(tpl.command)}
              >
                <Text style={styles.tabPillEmoji}>{tpl.icon || "📋"}</Text>
                <Text
                  style={[
                    styles.tabPillText,
                    isActive && styles.tabPillTextActive,
                  ]}
                >
                  {tpl.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* SEARCH & FILTER CONTROLS */}
        <View style={styles.filtersCard}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, phone (+91), court, ref..."
              placeholderTextColor="#8696A0"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text style={{ color: "#8696A0", fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Date Chips */}
          <View style={styles.chipsRow}>
            <Text style={styles.chipsLabel}>Date:</Text>
            {(["all", "today", "week", "month"] as const).map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.filterChip,
                  dateFilter === d && styles.filterChipActive,
                ]}
                onPress={() => setDateFilter(d)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    dateFilter === d && styles.filterChipTextActive,
                  ]}
                >
                  {d === "all"
                    ? "All"
                    : d === "today"
                    ? "Today"
                    : d === "week"
                    ? "7 Days"
                    : "30 Days"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Court Chips */}
          <View style={styles.chipsRow}>
            <Text style={styles.chipsLabel}>Court:</Text>
            <TouchableOpacity
              style={[
                styles.filterChip,
                sportFilter === "" && styles.filterChipActive,
              ]}
              onPress={() => setSportFilter("")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  sportFilter === "" && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {availableCourts.slice(0, 3).map((court) => (
              <TouchableOpacity
                key={court}
                style={[
                  styles.filterChip,
                  sportFilter === court && styles.filterChipActive,
                ]}
                onPress={() => setSportFilter(sportFilter === court ? "" : court)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sportFilter === court && styles.filterChipTextActive,
                  ]}
                >
                  {court.replace("Tennis - ", "")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sync Status Chips */}
          <View style={styles.chipsRow}>
            <Text style={styles.chipsLabel}>Sync:</Text>
            {(["", "synced", "pending"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterChip,
                  syncFilter === s && styles.filterChipActive,
                ]}
                onPress={() => setSyncFilter(s)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    syncFilter === s && styles.filterChipTextActive,
                  ]}
                >
                  {s === "" ? "All" : s === "synced" ? "✅ Synced" : "⚠️ DB Only"}
                </Text>
              </TouchableOpacity>
            ))}

            {Boolean(searchQuery || dateFilter !== "all" || sportFilter || syncFilter || selectedCommand !== "all" || timeSlotFilter || selectedDayFilter) ? (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={handleResetFilters}
              >
                <Text style={styles.clearFilterBtnText}>✕ Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* RECORDS LIST */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionHeader}>
            RECORDS ({displaySubmissions.length})
          </Text>
          <Text style={styles.listSubText}>Tap row for details</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#00A884" />
            <Text style={{ marginTop: 8, color: "#667781" }}>Loading records...</Text>
          </View>
        ) : displaySubmissions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
            <Text style={styles.emptyTitle}>No matching records found</Text>
            <Text style={styles.emptySub}>
              Adjust your search keywords or clear the active filters.
            </Text>
            <TouchableOpacity
              style={styles.clearFiltersLargeBtn}
              onPress={handleResetFilters}
            >
              <Text style={styles.clearFiltersLargeBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          displaySubmissions.map((sub) => {
            const data = sub.data || {};
            const sport =
              data["Sport / Facility"] ||
              data["Sport"] ||
              data["Sport Program"] ||
              data["Gear Requested"];
            const dateVal = data["Booking Date"] || data["date"] || data["Required Date"] || "";
            const timeSlot = data["Time Slot"] || data["time_slot"] || "";

            return (
              <TouchableOpacity
                key={sub.id}
                style={styles.recordCard}
                onPress={() => setActiveDetail(sub)}
                activeOpacity={0.7}
              >
                {/* Top Row: Ref & Tab */}
                <View style={styles.recordTopRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.refText}>
                      {sub.submissionRef || sub.id.slice(0, 8)}
                    </Text>
                    <View style={styles.sheetPill}>
                      <Text style={styles.sheetPillText}>
                        📊 {sub.sheetName}
                      </Text>
                    </View>
                  </View>

                  {sub.syncedToSheet ? (
                    <View style={styles.syncedPill}>
                      <Text style={styles.syncedPillText}>✅ Synced</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>⚠️ DB Only</Text>
                    </View>
                  )}
                </View>

                {/* Submitter & Phone */}
                <View style={styles.recordMainRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.submitterName}>
                      {sub.userName || data["Full Name"] || data["Member Name"] || "Member"}
                    </Text>
                    {sub.userPhone && (
                      <Text style={styles.submitterPhone}>
                        📞 {sub.userPhone}
                      </Text>
                    )}
                  </View>

                  {sport ? (
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportBadgeText}>🎾 {sport}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Bottom Row: Date / Time slot */}
                <View style={styles.recordBottomRow}>
                  <Text style={styles.recordDateText}>
                    {dateVal ? `📅 ${dateVal}` : new Date(sub.createdAt).toLocaleDateString()}
                    {timeSlot ? ` • ⏰ ${timeSlot}` : ""}
                  </Text>
                  <Text style={styles.tapDetailsHint}>View Details ›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* DETAIL MODAL */}
      {activeDetail && (
        <Modal
          visible={!!activeDetail}
          animationType="slide"
          transparent
          onRequestClose={() => setActiveDetail(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {activeDetail.template?.name || activeDetail.templateCommand} Record
                  </Text>
                  <Text style={styles.modalSub}>
                    Ref ID: {activeDetail.submissionRef || activeDetail.id}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setActiveDetail(null)}
                >
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Meta block */}
                <View style={styles.modalMetaCard}>
                  <View style={styles.modalMetaRow}>
                    <Text style={styles.modalMetaLabel}>Google Sheet Tab:</Text>
                    <Text style={styles.modalMetaValue}>📊 {activeDetail.sheetName}</Text>
                  </View>
                  <View style={styles.modalMetaRow}>
                    <Text style={styles.modalMetaLabel}>Logged At:</Text>
                    <Text style={styles.modalMetaValue}>
                      {new Date(activeDetail.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.modalMetaRow}>
                    <Text style={styles.modalMetaLabel}>Sync Status:</Text>
                    <Text style={styles.modalMetaValue}>
                      {activeDetail.syncedToSheet ? "✅ In Google Sheets & DB" : "⚠️ Recorded in PostgreSQL"}
                    </Text>
                  </View>
                </View>

                {/* Submitter Box */}
                <View style={styles.submitterModalBox}>
                  <Text style={styles.submitterModalTitle}>
                    👤 Submitter (Mobile Key)
                  </Text>
                  <Text style={styles.submitterModalText}>
                    Name: {activeDetail.userName || activeDetail.data?.["Full Name"] || "Member"}
                  </Text>
                  <Text style={styles.submitterModalText}>
                    Phone: {activeDetail.userPhone || "Not provided"}
                  </Text>
                </View>

                {/* All Dynamic Fields */}
                <Text style={styles.fieldsSectionTitle}>SUBMITTED FIELDS</Text>
                <View style={styles.fieldsContainer}>
                  {Object.entries(activeDetail.data || {}).map(([k, v]) => (
                    <View key={k} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{k}</Text>
                      <Text style={styles.fieldValue}>{String(v)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseMainBtn}
                  onPress={() => setActiveDetail(null)}
                >
                  <Text style={styles.modalCloseMainBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.listBackground,
  },
  headerCard: {
    backgroundColor: Colors.headerBackground,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: "800",
    color: Colors.textLight,
  },
  headerSubtitle: {
    fontSize: Fonts.sizes.xs,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  btnHeader: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  btnHeaderGreen: {
    backgroundColor: "#FFFFFF",
  },
  btnHeaderGreenText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#075E54",
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-around",
  },
  metricItem: {
    alignItems: "center",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#667781",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  tabsScroll: {
    marginBottom: 12,
  },
  tabsContent: {
    gap: 8,
    paddingRight: 16,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CFD8DC",
  },
  tabPillActive: {
    backgroundColor: "#075E54",
    borderColor: "#075E54",
  },
  tabPillEmoji: {
    fontSize: 14,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#54656F",
  },
  tabPillTextActive: {
    color: "#FFFFFF",
  },

  // Filters Card
  filtersCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#111B21",
    padding: 0,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  chipsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8696A0",
    width: 45,
  },
  filterChip: {
    backgroundColor: "#F0F2F5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterChipActive: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#00A884",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#54656F",
  },
  filterChipTextActive: {
    color: "#00796B",
    fontWeight: "700",
  },
  clearFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFEBEE",
    borderRadius: 12,
    marginLeft: "auto",
  },
  clearFilterBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#C62828",
  },

  // Records list
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listSubText: {
    fontSize: 11,
    color: "#8696A0",
  },
  recordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  recordTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  refText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
    color: "#00A884",
    fontSize: 12,
  },
  sheetPill: {
    backgroundColor: "#E0F2F1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sheetPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#00796B",
  },
  syncedPill: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  syncedPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E7D32",
  },
  pendingPill: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pendingPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#E65100",
  },
  recordMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  submitterName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111B21",
  },
  submitterPhone: {
    fontSize: 12,
    color: "#00A884",
    fontWeight: "600",
    marginTop: 2,
  },
  sportBadge: {
    backgroundColor: "#EDE7F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#512DA8",
  },
  recordBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
    paddingTop: 8,
  },
  recordDateText: {
    fontSize: 12,
    color: "#667781",
  },
  tapDetailsHint: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00A884",
  },

  // Loading & Empty
  loadingBox: {
    padding: 40,
    alignItems: "center",
  },
  emptyBox: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111B21",
  },
  emptySub: {
    fontSize: 12,
    color: "#8696A0",
    marginTop: 4,
    textAlign: "center",
  },
  clearFiltersLargeBtn: {
    marginTop: 14,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearFiltersLargeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2E7D32",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    minHeight: "50%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111B21",
  },
  modalSub: {
    fontSize: 12,
    color: "#00A884",
    fontWeight: "700",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: "#54656F",
    fontWeight: "700",
  },
  modalBody: {
    padding: 16,
  },
  modalMetaCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalMetaLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  modalMetaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  submitterModalBox: {
    backgroundColor: "#F4FDF9",
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  submitterModalTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
    marginBottom: 4,
  },
  submitterModalText: {
    fontSize: 13,
    color: "#111B21",
    fontWeight: "600",
    marginTop: 2,
  },
  fieldsSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8696A0",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fieldsContainer: {
    gap: 8,
  },
  fieldBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
  },
  fieldLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  fieldValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 2,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  modalCloseMainBtn: {
    backgroundColor: "#00A884",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseMainBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Active Drilldown Bar
  activeDrilldownBar: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  activeDrilldownTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  drilldownBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  drilldownBadge: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#22C55E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  drilldownBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  clearAllBadge: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#F87171",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearAllBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
  },

  // Chart Master Card
  chartMasterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chartMasterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  chartMasterTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  interactivePill: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  interactivePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0369A1",
  },
  chartMasterSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  expandToggleBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  expandToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },

  // Chart Nav Tabs
  chartNavTabs: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: 4,
  },
  chartNavTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  chartNavTabActive: {
    backgroundColor: "#00A884",
    shadowColor: "#00A884",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  chartNavTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  chartNavTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Chart Body Common
  chartBody: {
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chartBodyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  chartBodyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  chartBodyHint: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
  },
  chartEmptyText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 14,
  },

  // Tab 1: Court Bars
  courtBarList: {
    gap: 8,
  },
  courtBarRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  courtBarRowSelected: {
    borderColor: "#00A884",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
  },
  courtBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  courtBarName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
  },
  courtBarValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  courtBarTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  courtBarFill: {
    height: "100%",
    borderRadius: 4,
  },

  // Tab 2: Velocity Histogram
  velocityChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  velocityColumn: {
    alignItems: "center",
    width: 38,
    padding: 4,
    borderRadius: 6,
  },
  velocityColumnSelected: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  velocityCountBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  velocityBarWrap: {
    width: 16,
    height: 90,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  velocityBarFill: {
    width: "100%",
    borderRadius: 8,
  },
  velocityDayLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 6,
  },

  // Tab 3: Time Slot Cards
  slotCardsRow: {
    flexDirection: "row",
    gap: 8,
  },
  slotCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  slotCardSelected: {
    borderColor: "#00A884",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
  },
  slotCardIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  slotCardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  slotCardSub: {
    fontSize: 9,
    color: "#94A3B8",
    marginBottom: 4,
  },
  slotCardCount: {
    fontSize: 16,
    fontWeight: "800",
    marginVertical: 2,
  },
  slotMiniTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 2,
    overflow: "hidden",
    marginVertical: 4,
  },
  slotMiniFill: {
    height: "100%",
    borderRadius: 2,
  },
  slotPctText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#64748B",
  },

  // Tab 4: Sync Integration Health
  syncRow: {
    gap: 8,
  },
  syncCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  syncCardSelected: {
    borderColor: "#00A884",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
  },
  syncIconWrapGreen: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  syncIconWrapAmber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  syncCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  syncCardSub: {
    fontSize: 11,
    color: "#64748B",
  },
  syncCountBig: {
    fontSize: 18,
    fontWeight: "800",
  },
  syncRateText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
});
