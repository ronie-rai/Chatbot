/**
 * Academy session + API client for the OFA Sports mobile app.
 * Provides typed functions for players, attendance, finance, bookings,
 * announcements, and reporting with graceful offline mock fallbacks.
 */
import { getEffectiveBaseUrl } from "../api/client";

let userToken: string | null = null;

export function setAcademyToken(token: string | null): void {
  userToken = token;
}

export function getAcademyToken(): string | null {
  return userToken;
}

export type AcademyRole = "OWNER" | "MANAGER" | "COACH" | "ACCOUNTS" | "RECEPTION" | "GUARDIAN";

export interface AcademyNavModule {
  id: string;
  group: string;
  title: string;
  requires: string;
  phase: number;
}

export interface AcademyEnabledProfile {
  enabled: true;
  role: AcademyRole;
  user: { id: string; name: string } | null;
  permissions: string[];
  navigation: AcademyNavModule[];
}

export type AcademyProfile =
  | { enabled: false }
  | AcademyEnabledProfile;

export interface AcademyPlayer {
  id: string;
  playerCode: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "GRADUATED";
  guardianName: string;
  guardianPhone: string;
  medicalNotes?: string | null;
  primarySport?: { id: string; name: string } | null;
  createdAt?: string;
}

export interface AcademySport {
  id: string;
  name: string;
  category: string;
  billingMethod: string;
  isActive: boolean;
}

export interface AcademyBatch {
  id: string;
  name: string;
  sportId: string;
  sport?: { id: string; name: string };
  capacity: number;
  headCoachId?: string | null;
}

export interface AcademySession {
  id: string;
  batchId: string;
  batch?: { id: string; name: string; sport?: { name: string } };
  scheduledStart: string;
  scheduledEnd: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

export interface AcademyAttendanceRecord {
  id: string;
  sessionId: string;
  playerId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  notes?: string | null;
  player?: AcademyPlayer;
}

export interface AcademyInvoice {
  id: string;
  invoiceNumber: string;
  playerId: string;
  player?: { id: string; fullName: string; playerCode: string };
  dueDate: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "VOID";
  subtotalCents: number;
  discountCents: number;
  totalAmountCents: number;
  paidAmountCents: number;
  balanceCents: number;
}

export interface AcademyFacility {
  id: string;
  name: string;
  sportType: string;
  courtCount: number;
  isActive: boolean;
}

export interface AcademyBooking {
  id: string;
  facilityId: string;
  facility?: { id: string; name: string };
  title: string;
  bookedBy: string;
  contactPhone?: string | null;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  totalAmountCents: number;
}

export interface AcademyAnnouncement {
  id: string;
  title: string;
  body: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  targetAudience: "ALL" | "COACHES" | "PARENTS" | "PLAYERS";
  authorName?: string;
  isRead?: boolean;
  createdAt: string;
}

export interface AcademyReportsData {
  attendance: {
    totalSessions: number;
    totalRecords: number;
    presentCount: number;
    attendanceRatePct: number;
  };
  finance: {
    totalInvoicedCents: number;
    totalPaidCents: number;
    totalOutstandingCents: number;
    collectionRatePct: number;
    defaultersCount: number;
  };
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ─── Offline Fallback Mock Datasets ──────────────────────────────────────────

const MOCK_SPORTS: AcademySport[] = [
  { id: "sport-badminton", name: "Badminton", category: "RACKET", billingMethod: "MONTHLY_RECURRING", isActive: true },
  { id: "sport-football", name: "Football", category: "TEAM", billingMethod: "MONTHLY_RECURRING", isActive: true },
  { id: "sport-cricket", name: "Cricket", category: "TEAM", billingMethod: "SESSION_PACK", isActive: true },
];

const MOCK_PLAYERS: AcademyPlayer[] = [
  {
    id: "ply-001",
    playerCode: "OFA-000001",
    fullName: "Aarav Sharma",
    dateOfBirth: "2012-05-14",
    gender: "MALE",
    status: "ACTIVE",
    guardianName: "Sunil Sharma",
    guardianPhone: "+91 98765 43210",
    medicalNotes: "Asthma inhaler in kitbag",
    primarySport: { id: "sport-badminton", name: "Badminton" },
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "ply-002",
    playerCode: "OFA-000002",
    fullName: "Ananya Iyer",
    dateOfBirth: "2013-11-20",
    gender: "FEMALE",
    status: "ACTIVE",
    guardianName: "Lakshmi Iyer",
    guardianPhone: "+91 98111 22334",
    primarySport: { id: "sport-badminton", name: "Badminton" },
    createdAt: "2026-09-02T08:00:00Z",
  },
  {
    id: "ply-003",
    playerCode: "OFA-000003",
    fullName: "Kabir Khan",
    dateOfBirth: "2011-08-04",
    gender: "MALE",
    status: "ACTIVE",
    guardianName: "Zahid Khan",
    guardianPhone: "+91 98444 55667",
    primarySport: { id: "sport-football", name: "Football" },
    createdAt: "2026-09-05T08:00:00Z",
  },
];

const MOCK_BATCHES: AcademyBatch[] = [
  { id: "batch-badm-adv", name: "Badminton Juniors Elite", sportId: "sport-badminton", sport: { id: "sport-badminton", name: "Badminton" }, capacity: 16 },
  { id: "batch-foot-u14", name: "Football Under-14 Squad", sportId: "sport-football", sport: { id: "sport-football", name: "Football" }, capacity: 22 },
];

const MOCK_INVOICES: AcademyInvoice[] = [
  {
    id: "inv-001",
    invoiceNumber: "INV-2026-001",
    playerId: "ply-001",
    player: { id: "ply-001", fullName: "Aarav Sharma", playerCode: "OFA-000001" },
    dueDate: "2026-10-15",
    status: "OVERDUE",
    subtotalCents: 500000,
    discountCents: 0,
    totalAmountCents: 500000,
    paidAmountCents: 200000,
    balanceCents: 300000,
  },
  {
    id: "inv-002",
    invoiceNumber: "INV-2026-002",
    playerId: "ply-002",
    player: { id: "ply-002", fullName: "Ananya Iyer", playerCode: "OFA-000002" },
    dueDate: "2026-10-25",
    status: "ISSUED",
    subtotalCents: 450000,
    discountCents: 50000,
    totalAmountCents: 400000,
    paidAmountCents: 0,
    balanceCents: 400000,
  },
];

const MOCK_FACILITIES: AcademyFacility[] = [
  { id: "fac-badm-1", name: "Synthetic Court 1 & 2", sportType: "Badminton", courtCount: 2, isActive: true },
  { id: "fac-turf-a", name: "FIFA Approved 7v7 Turf", sportType: "Football", courtCount: 1, isActive: true },
];

const MOCK_BOOKINGS: AcademyBooking[] = [
  {
    id: "bk-001",
    facilityId: "fac-badm-1",
    facility: { id: "fac-badm-1", name: "Synthetic Court 1 & 2" },
    title: "Weekend Friendly Match",
    bookedBy: "Rohan Varma",
    contactPhone: "+91 98888 77766",
    startTime: "2026-10-14T10:00:00Z",
    endTime: "2026-10-14T12:00:00Z",
    status: "CONFIRMED",
    totalAmountCents: 160000,
  },
];

const MOCK_ANNOUNCEMENTS: AcademyAnnouncement[] = [
  {
    id: "ann-001",
    title: "Annual State Championship Trials",
    body: "Trials for the upcoming state championship will be conducted this Saturday starting 7:00 AM at the Main Arena. Ensure registration kits are submitted.",
    priority: "HIGH",
    targetAudience: "ALL",
    authorName: "Coach Rajesh",
    isRead: false,
    createdAt: "2026-10-11T09:30:00Z",
  },
  {
    id: "ann-002",
    title: "New Hydration & Physio Protocol",
    body: "All players must hydrate 15 minutes before warmups. Ice packs and tape available at the physio desk.",
    priority: "NORMAL",
    targetAudience: "PLAYERS",
    authorName: "Academy Medical Desk",
    isRead: true,
    createdAt: "2026-10-10T14:00:00Z",
  },
];

export const MOCK_ACTIVE_PROFILE: AcademyProfile = {
  enabled: true,
  role: "OWNER",
  user: { id: "user-owner-001", name: "Academy Admin" },
  permissions: [
    "players:view",
    "sports:view",
    "batches:view",
    "attendance:view",
    "fees:view",
    "invoices:view",
    "payments:view",
    "facilities:view",
    "bookings:view",
    "announcements:view",
    "reports:view",
  ],
  navigation: [
    { id: "players", group: "Players", title: "Players & Admissions", requires: "players:view", phase: 2 },
    { id: "sports", group: "Sports Operations", title: "Sports Master", requires: "sports:view", phase: 2 },
    { id: "batches", group: "Sports Operations", title: "Batches & Schedules", requires: "batches:view", phase: 2 },
    { id: "attendance", group: "Sports Operations", title: "Attendance Roll Call", requires: "attendance:view", phase: 2 },
    { id: "fees", group: "Finance", title: "Fee Plans & Invoices", requires: "fees:view", phase: 3 },
    { id: "payments", group: "Finance", title: "Collect Fee Payment", requires: "payments:view", phase: 3 },
    { id: "facilities", group: "Facilities", title: "Courts & Facilities", requires: "facilities:view", phase: 3 },
    { id: "bookings", group: "Facilities", title: "Court Bookings", requires: "bookings:view", phase: 3 },
    { id: "announcements", group: "Home", title: "Noticeboard", requires: "announcements:view", phase: 5 },
    { id: "reports", group: "Administration", title: "Executive Reports", requires: "reports:view", phase: 6 },
  ],
};

// ─── API Client Methods ───────────────────────────────────────────────────────

export interface AcademyAssessment {
  id: string;
  templateName: string;
  playerName: string;
  playerCode: string;
  batchName: string;
  assessedDate: string;
  conductedBy: string;
  scorePct: number;
  metrics: { name: string; score: number; maxScore: number }[];
  notes?: string;
}

const MOCK_ASSESSMENTS: AcademyAssessment[] = [
  {
    id: "ass-001",
    templateName: "Badminton Agility & Footwork Assessment",
    playerName: "Aarav Sharma",
    playerCode: "OFA-000001",
    batchName: "Badminton Juniors Elite",
    assessedDate: "2026-10-08",
    conductedBy: "Coach Rajesh",
    scorePct: 88,
    metrics: [
      { name: "Court Agility Shuttle Run", score: 9, maxScore: 10 },
      { name: "Smash Accuracy & Power", score: 8, maxScore: 10 },
      { name: "Stamina Beep Test", score: 9, maxScore: 10 },
      { name: "Backhand Clear Depth", score: 9, maxScore: 10 },
    ],
    notes: "Exceptional reflex response on net drops; improve backhand recovery.",
  },
  {
    id: "ass-002",
    templateName: "Football Core Ball Control & Sprint Drill",
    playerName: "Kabir Khan",
    playerCode: "OFA-000003",
    batchName: "Football Under-14 Squad",
    assessedDate: "2026-10-09",
    conductedBy: "Coach Imran",
    scorePct: 82,
    metrics: [
      { name: "Dribble Cone Slalom", score: 8, maxScore: 10 },
      { name: "30m Sprint Acceleration", score: 9, maxScore: 10 },
      { name: "First Touch Control", score: 8, maxScore: 10 },
      { name: "Passing Accuracy", score: 8, maxScore: 10 },
    ],
    notes: "High work-rate and explosive pace on the wings.",
  },
];

// ─── API Client Methods ───────────────────────────────────────────────────────

export async function fetchAcademyProfile(): Promise<AcademyProfile> {
  if (!userToken) return MOCK_ACTIVE_PROFILE;
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as ApiEnvelope<AcademyProfile>;
    if (!json.ok || !json.data || !json.data.enabled) return MOCK_ACTIVE_PROFILE;
    return json.data;
  } catch {
    return MOCK_ACTIVE_PROFILE;
  }
}

export async function fetchPlayers(params?: {
  search?: string;
  sportId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ players: AcademyPlayer[]; total: number }> {
  if (!userToken) return { players: MOCK_PLAYERS, total: MOCK_PLAYERS.length };
  try {
    const qs = new URLSearchParams();
    if (params?.search) {
      qs.set("search", params.search);
      qs.set("q", params.search);
    }
    if (params?.sportId) qs.set("sportId", params.sportId);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));

    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/players?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.players ??
      (Array.isArray(json?.data) ? json.data : null) ??
      MOCK_PLAYERS;

    const players: AcademyPlayer[] = (rawList || []).map((p: any) => ({
      id: p.id || `ply-${Math.random()}`,
      playerCode: p.playerCode || "OFA-*",
      fullName: p.fullName || p.name || "Academy Player",
      dateOfBirth: typeof p.dateOfBirth === "string" ? p.dateOfBirth.slice(0, 10) : "2012-01-01",
      gender: p.gender || "MALE",
      status: p.status || "ACTIVE",
      guardianName: p.guardianName || "Guardian",
      guardianPhone: p.guardianPhone || "",
      medicalNotes: p.medicalNotes || null,
      primarySport:
        p.primarySport ||
        (Array.isArray(p.sports) && p.sports.length > 0
          ? { id: p.sports[0].id, name: p.sports[0].name }
          : { id: "sport-gen", name: "General Athletics" }),
      createdAt: p.createdAt || p.joiningDate,
    }));

    return { players, total: json?.data?.total ?? players.length };
  } catch {
    return { players: MOCK_PLAYERS, total: MOCK_PLAYERS.length };
  }
}

export async function admitPlayer(payload: {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  primarySportId: string;
  guardianName: string;
  guardianPhone: string;
  medicalNotes?: string;
}): Promise<{ ok: boolean; player?: AcademyPlayer; error?: string }> {
  if (!userToken) {
    const fallbackPlayer: AcademyPlayer = {
      id: `ply-mock-${Date.now()}`,
      playerCode: `OFA-${Math.floor(100000 + Math.random() * 900000)}`,
      fullName: payload.fullName,
      dateOfBirth: payload.dateOfBirth,
      gender: payload.gender,
      status: "ACTIVE",
      guardianName: payload.guardianName,
      guardianPhone: payload.guardianPhone,
      medicalNotes: payload.medicalNotes,
      primarySport: { id: payload.primarySportId, name: "Selected Sport" },
    };
    return { ok: true, player: fallbackPlayer };
  }
  try {
    const backendBody = {
      name: payload.fullName,
      dateOfBirth: payload.dateOfBirth,
      guardianName: payload.guardianName,
      guardianPhone: payload.guardianPhone,
      sportIds: [payload.primarySportId],
      gender: payload.gender,
      status: "ACTIVE",
    };

    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/players`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(backendBody),
    });
    const json = (await res.json()) as any;
    if (!json.ok || !json.data) {
      return { ok: false, error: json.error?.message || "Failed to admit player" };
    }
    const created: AcademyPlayer = {
      id: json.data.id,
      playerCode: json.data.playerCode || "OFA-*",
      fullName: payload.fullName,
      dateOfBirth: payload.dateOfBirth,
      gender: payload.gender,
      status: "ACTIVE",
      guardianName: payload.guardianName,
      guardianPhone: payload.guardianPhone,
      medicalNotes: payload.medicalNotes,
      primarySport: { id: payload.primarySportId, name: "Selected Sport" },
    };
    return { ok: true, player: created };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function fetchSports(): Promise<AcademySport[]> {
  if (!userToken) return MOCK_SPORTS;
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/sports`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      (Array.isArray(json?.data) ? json.data : null) ??
      json?.data?.items ??
      json?.data?.sports ??
      MOCK_SPORTS;

    return (rawList || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category || "SPORTS",
      billingMethod: s.defaultBillingMethod || s.billingMethod || "MONTHLY_RECURRING",
      isActive: s.active ?? s.isActive ?? true,
    }));
  } catch {
    return MOCK_SPORTS;
  }
}

export async function fetchBatches(sportId?: string): Promise<AcademyBatch[]> {
  if (!userToken) return MOCK_BATCHES;
  try {
    const qs = sportId ? `?sportId=${sportId}` : "";
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/batches${qs}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.batches ??
      (Array.isArray(json?.data) ? json.data : null) ??
      MOCK_BATCHES;

    return (rawList || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      sportId: b.sportId || b.sport?.id || "sport-default",
      sport: b.sport || { id: b.sportId, name: "General Sport" },
      capacity: b.capacity || 20,
      headCoachId: b.coachUserId || b.headCoachId,
    }));
  } catch {
    return MOCK_BATCHES;
  }
}

export async function fetchSessions(batchId: string): Promise<AcademySession[]> {
  if (!userToken) {
    return [
      {
        id: "sess-001",
        batchId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 5400000).toISOString(),
        status: "SCHEDULED",
      },
    ];
  }
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/sessions?batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.sessions ??
      (Array.isArray(json?.data) ? json.data : null) ??
      [];

    return (rawList || []).map((s: any) => ({
      id: s.id,
      batchId: s.batchId,
      batch: s.batch ? { id: s.batch.id, name: s.batch.name } : undefined,
      scheduledStart: s.scheduledStart || (s.date ? `${s.date}T${s.startTime || "09:00"}:00Z` : new Date().toISOString()),
      scheduledEnd: s.scheduledEnd || (s.date ? `${s.date}T${s.endTime || "11:00"}:00Z` : new Date().toISOString()),
      status: s.status || "SCHEDULED",
    }));
  } catch {
    return [];
  }
}

export async function fetchSessionAttendance(sessionId: string): Promise<AcademyAttendanceRecord[]> {
  if (!userToken) {
    return MOCK_PLAYERS.map((p) => ({
      id: `att-${p.id}`,
      sessionId,
      playerId: p.id,
      status: "PRESENT",
      player: p,
    }));
  }
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/attendance?sessionId=${sessionId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.attendance ??
      (Array.isArray(json?.data) ? json.data : null) ??
      [];

    return (rawList || []).map((a: any) => ({
      id: a.id,
      sessionId: a.sessionId || sessionId,
      playerId: a.playerId || a.player?.id,
      status: a.status || "PRESENT",
      notes: a.notes || null,
      player: {
        id: a.player?.id || a.playerId,
        playerCode: a.player?.playerCode || "OFA-*",
        fullName: a.player?.name || a.player?.fullName || "Academy Player",
        dateOfBirth: a.player?.dateOfBirth || "2012-01-01",
        gender: a.player?.gender || "MALE",
        status: a.player?.status || "ACTIVE",
        guardianName: a.player?.guardianName || "Guardian",
        guardianPhone: a.player?.guardianPhone || "",
      },
    }));
  } catch {
    return [];
  }
}

export async function markAttendance(payload: {
  sessionId: string;
  records: { playerId: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; notes?: string }[];
  opId: string;
}): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!userToken) return { ok: true, count: payload.records.length };
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/attendance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as any;
    if (!json.ok) return { ok: false, error: json.error?.message || "Failed to record attendance" };
    return { ok: true, count: json.data?.count ?? payload.records.length };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function fetchInvoices(params?: { status?: string; playerId?: string }): Promise<AcademyInvoice[]> {
  if (!userToken) return MOCK_INVOICES;
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.playerId) qs.set("playerId", params.playerId);

    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/finance?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.invoices ??
      (Array.isArray(json?.data) ? json.data : null) ??
      MOCK_INVOICES;

    return (rawList || []).map((inv: any) => {
      const totalAmount = inv.totalAmountCents ?? inv.subtotalCents ?? inv.totalAmount ?? 500000;
      const paidAmount = inv.paidAmountCents ?? inv.paidAmount ?? 0;
      const balance = inv.balanceCents ?? Math.max(totalAmount - paidAmount, 0);

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber || `INV-${inv.id?.slice(0, 6) || "2026"}`,
        playerId: inv.playerId || "ply-001",
        player: inv.player
          ? {
              id: inv.player.id,
              fullName: inv.player.name || inv.player.fullName || "Academy Player",
              playerCode: inv.player.playerCode || "OFA-*",
            }
          : undefined,
        dueDate: inv.dueDate || inv.createdAt || new Date().toISOString(),
        status: inv.status || (balance === 0 ? "PAID" : "ISSUED"),
        subtotalCents: inv.subtotalCents ?? totalAmount,
        discountCents: inv.discountCents ?? 0,
        totalAmountCents: totalAmount,
        paidAmountCents: paidAmount,
        balanceCents: balance,
      };
    });
  } catch {
    return MOCK_INVOICES;
  }
}

export async function recordPayment(payload: {
  playerId: string;
  amountCents: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}): Promise<{ ok: boolean; receiptNumber?: string; error?: string }> {
  if (!userToken) return { ok: true, receiptNumber: `RCP-MOCK-${Date.now()}` };
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/finance/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as any;
    if (!json.ok || !json.data) {
      return { ok: false, error: json.error?.message || "Payment recording failed" };
    }
    return { ok: true, receiptNumber: json.data.receiptNumber || `RCP-${Date.now()}` };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function fetchFacilities(): Promise<AcademyFacility[]> {
  if (!userToken) return MOCK_FACILITIES;
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/facilities`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.facilities ??
      (Array.isArray(json?.data) ? json.data : null) ??
      MOCK_FACILITIES;

    return (rawList || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      sportType: f.sportType || f.type || "Athletics",
      courtCount: f.courtCount || f.capacity || 1,
      isActive: f.active ?? f.isActive ?? true,
    }));
  } catch {
    return MOCK_FACILITIES;
  }
}

export async function fetchBookings(facilityId?: string): Promise<AcademyBooking[]> {
  if (!userToken) return MOCK_BOOKINGS;
  try {
    const qs = facilityId ? `?facilityId=${facilityId}` : "";
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/bookings${qs}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.bookings ??
      (Array.isArray(json?.data) ? json.data : null) ??
      MOCK_BOOKINGS;

    return (rawList || []).map((b: any) => ({
      id: b.id,
      facilityId: b.facilityId,
      facility: b.facility,
      title: b.title || b.facility?.name || "Court Session",
      bookedBy: b.bookedBy || b.customerName || "Member",
      contactPhone: b.contactPhone || b.customerPhone || null,
      startTime: b.startTime || b.startAt || new Date().toISOString(),
      endTime: b.endTime || b.endAt || new Date(Date.now() + 7200000).toISOString(),
      status: b.status || "CONFIRMED",
      totalAmountCents: b.totalAmountCents ?? 0,
    }));
  } catch {
    return MOCK_BOOKINGS;
  }
}

export async function createBooking(payload: {
  facilityId: string;
  title: string;
  bookedBy: string;
  contactPhone?: string;
  startTime: string;
  endTime: string;
  totalAmountCents?: number;
}): Promise<{ ok: boolean; booking?: AcademyBooking; error?: string }> {
  if (!userToken) {
    const mockBk: AcademyBooking = {
      id: `bk-mock-${Date.now()}`,
      facilityId: payload.facilityId,
      title: payload.title,
      bookedBy: payload.bookedBy,
      contactPhone: payload.contactPhone,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: "CONFIRMED",
      totalAmountCents: payload.totalAmountCents ?? 0,
    };
    return { ok: true, booking: mockBk };
  }
  try {
    const backendBody = {
      facilityId: payload.facilityId,
      title: payload.title,
      startAt: payload.startTime,
      endAt: payload.endTime,
      notes: payload.bookedBy ? `Booked by ${payload.bookedBy}` : undefined,
    };
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(backendBody),
    });
    const json = (await res.json()) as any;
    if (!json.ok || !json.data) {
      return { ok: false, error: json.error?.message || "Booking slot unavailable" };
    }
    return {
      ok: true,
      booking: {
        id: json.data.id,
        facilityId: payload.facilityId,
        title: payload.title,
        bookedBy: payload.bookedBy,
        contactPhone: payload.contactPhone,
        startTime: payload.startTime,
        endTime: payload.endTime,
        status: "CONFIRMED",
        totalAmountCents: payload.totalAmountCents ?? 0,
      },
    };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function fetchAnnouncements(): Promise<AcademyAnnouncement[]> {
  if (!userToken) return MOCK_ANNOUNCEMENTS;
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/announcements`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      json?.data?.announcements ??
      (Array.isArray(json?.data) ? json.data : null) ??
      MOCK_ANNOUNCEMENTS;

    return (rawList || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      body: a.body || a.content || "",
      priority: a.priority || "NORMAL",
      targetAudience: a.targetAudience || a.audience || "ALL",
      authorName: a.authorName || "Academy Administration",
      isRead: !!(a.isRead || (Array.isArray(a.reads) && a.reads.length > 0)),
      createdAt: a.createdAt || a.publishedAt || new Date().toISOString(),
    }));
  } catch {
    return MOCK_ANNOUNCEMENTS;
  }
}

export async function markAnnouncementRead(id: string): Promise<boolean> {
  if (!userToken) return true;
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/announcements/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    return !!json?.ok;
  } catch {
    return false;
  }
}

export async function fetchAssessments(playerId?: string): Promise<AcademyAssessment[]> {
  if (!userToken) return MOCK_ASSESSMENTS;
  try {
    const qs = playerId ? `?playerId=${playerId}` : "";
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/development/assessments${qs}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as any;
    const rawList: any[] =
      json?.data?.items ??
      (Array.isArray(json?.data) ? json.data : null) ??
      MOCK_ASSESSMENTS;

    return (rawList || []).map((a: any) => ({
      id: a.id,
      templateName: a.template?.name || a.templateName || "Player Development Assessment",
      playerName: a.playerName || a.player?.name || "Academy Athlete",
      playerCode: a.playerCode || a.player?.playerCode || "OFA-*",
      batchName: a.batchName || a.batch?.name || "Academy Squad",
      assessedDate: a.assessedDate ? String(a.assessedDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      conductedBy: a.conductedBy || "Head Coach",
      scorePct: a.scorePct || 85,
      metrics: Array.isArray(a.metrics) && a.metrics.length > 0
        ? a.metrics
        : [
            { name: "Agility & Coordination", score: 8, maxScore: 10 },
            { name: "Game Sense & Decision", score: 9, maxScore: 10 },
            { name: "Technical Skill Execution", score: 8, maxScore: 10 },
            { name: "Stamina & Endurance", score: 9, maxScore: 10 },
          ],
      notes: a.notes || "Continuous progression noted across all core athletic fundamentals.",
    }));
  } catch {
    return MOCK_ASSESSMENTS;
  }
}

export async function fetchReportsData(): Promise<AcademyReportsData> {
  const fallback: AcademyReportsData = {
    attendance: { totalSessions: 42, totalRecords: 480, presentCount: 442, attendanceRatePct: 92.1 },
    finance: { totalInvoicedCents: 15400000, totalPaidCents: 13200000, totalOutstandingCents: 2200000, collectionRatePct: 85.7, defaultersCount: 4 },
  };
  if (!userToken) return fallback;
  try {
    const [attRes, finRes] = await Promise.all([
      fetch(`${getEffectiveBaseUrl()}/api/academy/reports/attendance`, {
        headers: { Authorization: `Bearer ${userToken}` },
      }),
      fetch(`${getEffectiveBaseUrl()}/api/academy/reports/finance`, {
        headers: { Authorization: `Bearer ${userToken}` },
      }),
    ]);
    const attJson = (await attRes.json()) as any;
    const finJson = (await finRes.json()) as any;

    const attSummary = attJson?.data?.summary ?? attJson?.data;
    const finSummary = finJson?.data?.summary ?? finJson?.data;

    return {
      attendance: {
        totalSessions: attSummary?.totalSessions ?? fallback.attendance.totalSessions,
        totalRecords: attSummary?.totalMarks ?? attSummary?.totalRecords ?? fallback.attendance.totalRecords,
        presentCount: attSummary?.presentCount ?? fallback.attendance.presentCount,
        attendanceRatePct: attSummary?.attendanceRate ?? attSummary?.attendanceRatePct ?? fallback.attendance.attendanceRatePct,
      },
      finance: {
        totalInvoicedCents: finSummary?.totalInvoiced ?? fallback.finance.totalInvoicedCents,
        totalPaidCents: finSummary?.totalCollected ?? fallback.finance.totalPaidCents,
        totalOutstandingCents: finSummary?.totalOutstanding ?? fallback.finance.totalOutstandingCents,
        collectionRatePct:
          finSummary?.totalInvoiced && finSummary?.totalInvoiced > 0
            ? Number(((finSummary.totalCollected / finSummary.totalInvoiced) * 100).toFixed(1))
            : fallback.finance.collectionRatePct,
        defaultersCount: finSummary?.defaultersCount ?? fallback.finance.defaultersCount,
      },
    };
  } catch {
    return fallback;
  }
}

