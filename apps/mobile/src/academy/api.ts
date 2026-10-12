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

export type AcademyProfile =
  | { enabled: false }
  | {
      enabled: true;
      role: AcademyRole;
      user: { id: string; name: string } | null;
      permissions: string[];
      navigation: AcademyNavModule[];
    };

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

// ─── API Client Methods ───────────────────────────────────────────────────────

export async function fetchAcademyProfile(): Promise<AcademyProfile> {
  if (!userToken) return { enabled: false };
  try {
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as ApiEnvelope<AcademyProfile>;
    if (!json.ok || !json.data) return { enabled: false };
    return json.data;
  } catch {
    return { enabled: false };
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
    if (params?.search) qs.set("search", params.search);
    if (params?.sportId) qs.set("sportId", params.sportId);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));

    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/players?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const json = (await res.json()) as ApiEnvelope<{ players: AcademyPlayer[]; total: number }>;
    if (!json.ok || !json.data) return { players: MOCK_PLAYERS, total: MOCK_PLAYERS.length };
    return json.data;
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
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/players`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiEnvelope<AcademyPlayer>;
    if (!json.ok || !json.data) {
      return { ok: false, error: json.error?.message || "Failed to admit player" };
    }
    return { ok: true, player: json.data };
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
    const json = (await res.json()) as ApiEnvelope<{ sports: AcademySport[] }>;
    if (!json.ok || !json.data) return MOCK_SPORTS;
    return json.data.sports;
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
    const json = (await res.json()) as ApiEnvelope<{ batches: AcademyBatch[] }>;
    if (!json.ok || !json.data) return MOCK_BATCHES;
    return json.data.batches;
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
    const json = (await res.json()) as ApiEnvelope<{ sessions: AcademySession[] }>;
    if (!json.ok || !json.data) return [];
    return json.data.sessions;
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
    const json = (await res.json()) as ApiEnvelope<{ attendance: AcademyAttendanceRecord[] }>;
    if (!json.ok || !json.data) return [];
    return json.data.attendance;
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
    const json = (await res.json()) as ApiEnvelope<{ count: number }>;
    if (!json.ok) return { ok: false, error: json.error?.message || "Failed to record attendance" };
    return { ok: true, count: json.data?.count };
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
    const json = (await res.json()) as ApiEnvelope<{ invoices: AcademyInvoice[] }>;
    if (!json.ok || !json.data) return MOCK_INVOICES;
    return json.data.invoices;
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
    const json = (await res.json()) as ApiEnvelope<{ receiptNumber: string }>;
    if (!json.ok || !json.data) {
      return { ok: false, error: json.error?.message || "Payment recording failed" };
    }
    return { ok: true, receiptNumber: json.data.receiptNumber };
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
    const json = (await res.json()) as ApiEnvelope<{ facilities: AcademyFacility[] }>;
    if (!json.ok || !json.data) return MOCK_FACILITIES;
    return json.data.facilities;
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
    const json = (await res.json()) as ApiEnvelope<{ bookings: AcademyBooking[] }>;
    if (!json.ok || !json.data) return MOCK_BOOKINGS;
    return json.data.bookings;
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
    const res = await fetch(`${getEffectiveBaseUrl()}/api/academy/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiEnvelope<AcademyBooking>;
    if (!json.ok || !json.data) {
      return { ok: false, error: json.error?.message || "Booking slot unavailable" };
    }
    return { ok: true, booking: json.data };
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
    const json = (await res.json()) as ApiEnvelope<{ announcements: AcademyAnnouncement[] }>;
    if (!json.ok || !json.data) return MOCK_ANNOUNCEMENTS;
    return json.data.announcements;
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
    const json = (await res.json()) as ApiEnvelope<{ success: boolean }>;
    return !!json.ok;
  } catch {
    return false;
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
    const attJson = (await attRes.json()) as ApiEnvelope<AcademyReportsData["attendance"]>;
    const finJson = (await finRes.json()) as ApiEnvelope<AcademyReportsData["finance"] & { defaulters?: unknown[] }>;

    return {
      attendance: attJson.data ?? fallback.attendance,
      finance: {
        totalInvoicedCents: finJson.data?.totalInvoicedCents ?? fallback.finance.totalInvoicedCents,
        totalPaidCents: finJson.data?.totalPaidCents ?? fallback.finance.totalPaidCents,
        totalOutstandingCents: finJson.data?.totalOutstandingCents ?? fallback.finance.totalOutstandingCents,
        collectionRatePct: finJson.data?.collectionRatePct ?? fallback.finance.collectionRatePct,
        defaultersCount: finJson.data?.defaulters?.length ?? fallback.finance.defaultersCount,
      },
    };
  } catch {
    return fallback;
  }
}
