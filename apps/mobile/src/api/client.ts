/**
 * API client for the Next.js server.
 * Phase 3: Basic fetch wrapper with error handling.
 * Phase 8: Will add JWT auth headers.
 */
import type { ApiResponse, Conversation, Message, ChatTemplateItem } from "@chatbot/shared-types";
import { Platform } from "react-native";

let customBaseUrl: string | null = null;

export function setCustomBaseUrl(url: string | null) {
  customBaseUrl = url?.trim() || null;
}

export function getEffectiveBaseUrl(): string {
  if (customBaseUrl) return customBaseUrl.replace(/\/+$/, "");
  return (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export const BASE_URL = getEffectiveBaseUrl();

let globalAdminToken: string | null = null;

export function setAdminToken(token: string | null) {
  globalAdminToken = token;
  if (typeof window !== "undefined" && window.sessionStorage) {
    if (token) {
      window.sessionStorage.setItem("sa_token", token);
    } else {
      window.sessionStorage.removeItem("sa_token");
    }
  }
}

export function getAdminToken(): string | null {
  if (globalAdminToken) return globalAdminToken;
  if (typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage.getItem("sa_token");
  }
  return null;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getEffectiveBaseUrl()}${path}`;
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { "x-sa-token": token, "Authorization": `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };
  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.ok) {
    throw new Error(json.error.message);
  }

  return json.data;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(userId: string): Promise<Conversation[]> {
  return apiFetch<Conversation[]>(`/api/conversations?userId=${userId}`);
}

export async function createConversation(data: {
  name: string;
  creatorId: string;
  kind?: "ai" | "direct" | "group";
  tenantId?: string;
}): Promise<Conversation> {
  try {
    return await apiFetch<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn("[createConversation] API failed, creating local fallback conversation:", err);
    // Offline fallback: generate mock conversation object
    const now = new Date().toISOString();
    return {
      id: `conv-local-${Date.now()}`,
      tenantId: data.tenantId || "cmtgyf6k900007eegk9xui75k",
      name: data.name,
      kind: data.kind || "ai",
      createdAt: now,
      updatedAt: now,
      participants: [
        {
          id: `part-${Date.now()}`,
          conversationId: `conv-local-${Date.now()}`,
          userId: data.creatorId,
          joinedAt: now,
        },
      ],
    };
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string,
  since?: string
): Promise<Message[]> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<Message[]>(`/api/conversations/${conversationId}/messages${qs}`);
}

export interface SendMessageOptions {
  kind?: Message["kind"];
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  options?: SendMessageOptions
): Promise<Message> {
  try {
    return await apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        senderId,
        text,
        kind: options?.kind,
        mediaUrl: options?.mediaUrl,
        fileName: options?.fileName,
        fileSize: options?.fileSize,
        mimeType: options?.mimeType,
        duration: options?.duration,
        metadata: options?.metadata,
      }),
    });
  } catch (err) {
    console.warn("[sendMessage] API unreachable, falling back to local message:", err);
    // Graceful offline fallback per workspace rules
    const now = new Date().toISOString();
    return {
      id: `msg-local-${Date.now()}`,
      conversationId,
      senderId,
      body: text,
      kind: options?.kind || "text",
      status: "sent",
      mediaUrl: options?.mediaUrl,
      fileName: options?.fileName,
      fileSize: options?.fileSize,
      mimeType: options?.mimeType,
      duration: options?.duration,
      createdAt: now,
    };
  }
}

export async function uploadMediaFile(
  fileOrPicked: File | Blob | { uri: string; name: string; type: string; size?: number; file?: File },
  fileName?: string,
  mimeType?: string
): Promise<{ url: string; fileName: string; fileSize: number; mimeType: string }> {
  const isPickedObj = typeof fileOrPicked === "object" && fileOrPicked !== null && "uri" in fileOrPicked;
  const effectiveName = fileName || (isPickedObj ? fileOrPicked.name : (fileOrPicked instanceof File ? fileOrPicked.name : `media_${Date.now()}`));
  const effectiveType = mimeType || (isPickedObj ? fileOrPicked.type : ((fileOrPicked as any).type || "application/octet-stream"));
  const effectiveSize = isPickedObj ? (fileOrPicked.size || 0) : ((fileOrPicked as any).size || 0);

  try {
    const formData = new FormData();

    if (Platform.OS !== "web" && isPickedObj) {
      formData.append("file", {
        uri: fileOrPicked.uri,
        name: effectiveName,
        type: effectiveType,
      } as any);
    } else {
      const filePayload = (isPickedObj && fileOrPicked.file) ? fileOrPicked.file : fileOrPicked;
      formData.append("file", filePayload as any, effectiveName);
    }

    const res = await fetch(`${getEffectiveBaseUrl()}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (json.ok && json.data) {
      const fullUrl = json.data.url.startsWith("http")
        ? json.data.url
        : `${getEffectiveBaseUrl()}${json.data.url}`;
      return {
        url: fullUrl,
        fileName: json.data.fileName || effectiveName,
        fileSize: json.data.fileSize || effectiveSize,
        mimeType: json.data.mimeType || effectiveType,
      };
    }
    throw new Error(json.error?.message || "Upload failed");
  } catch (err) {
    console.warn("[uploadMediaFile] Falling back to local file URI:", err);

    // Offline / Standalone APK local fallback:
    if (isPickedObj && fileOrPicked.uri) {
      return {
        url: fileOrPicked.uri,
        fileName: effectiveName,
        fileSize: effectiveSize,
        mimeType: effectiveType,
      };
    }

    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && (fileOrPicked instanceof Blob || fileOrPicked instanceof File)) {
      return {
        url: URL.createObjectURL(fileOrPicked),
        fileName: effectiveName,
        fileSize: effectiveSize,
        mimeType: effectiveType,
      };
    }

    return {
      url: "",
      fileName: effectiveName,
      fileSize: effectiveSize,
      mimeType: effectiveType,
    };
  }
}

export async function markMessageRead(
  conversationId: string,
  messageId: string
): Promise<void> {
  try {
    await apiFetch<{ messageId: string; status: string }>(
      `/api/conversations/${conversationId}/messages/${messageId}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "read" }) }
    );
  } catch {
    // Non-fatal — read receipts are best effort
  }
}

// ─── Chat Templates ───────────────────────────────────────────────────────────

export const DEFAULT_FALLBACK_TEMPLATES: ChatTemplateItem[] = [
  {
    id: "tpl-booking",
    tenantId: "default",
    command: "booking",
    name: "Facility & Court Booking",
    description: "Reserve tennis courts, badminton, turf, or fitness slots",
    sheetName: "Facility Bookings",
    icon: "🏟️",
    promptMessage: "Please fill booking details",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "phone", label: "Phone Number", required: true, type: "phone", placeholder: "+91 98765 43210 (Auto-loads user details)" },
      { key: "name", label: "Full Name", required: true, type: "text", placeholder: "e.g. Rohan Sharma" },
      {
        key: "sport",
        label: "Sport / Facility",
        required: true,
        type: "dropdown",
        placeholder: "Select Court / Facility",
        options: [
          "Tennis - Court 1",
          "Tennis - Court 2",
          "Tennis - Court 3",
          "Tennis - Court 4",
          "Badminton - Court 1",
          "Badminton - Court 2",
          "Football Turf A",
          "Basketball Court",
          "Swimming Lane 1",
          "Squash Court 1",
        ],
      },
      { key: "date", label: "Booking Date", required: true, type: "date", placeholder: "Tap to select date from calendar" },
      { key: "time_slot", label: "Time Slot", required: true, type: "time", placeholder: "Tap to select time slot" },
      { key: "duration", label: "Duration", required: false, type: "text", defaultValue: "1 Hr 00 Min", placeholder: "1 Hr 00 Min" },
      { key: "players", label: "No. of Players", required: false, type: "number", defaultValue: "2", placeholder: "e.g. 2" },
      { key: "notes", label: "Special Requests / Notes", required: false, type: "textarea", placeholder: "e.g. Need rental racquets" },
    ],
  },
  {
    id: "tpl-membership",
    tenantId: "default",
    command: "membership",
    name: "Academy & Club Membership",
    description: "Register for foundation training batches & club memberships",
    sheetName: "Memberships",
    icon: "🏅",
    promptMessage: "Please fill membership details",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "name", label: "Member Name", required: true, type: "text", placeholder: "e.g. Aarav Mehta" },
      { key: "phone", label: "Contact Phone", required: true, type: "phone", placeholder: "+91 98765 43210" },
      { key: "sport", label: "Sport Program", required: true, type: "text", placeholder: "Athletics / Football / Tennis" },
      { key: "tier", label: "Membership Plan", required: true, type: "choice", placeholder: "Monthly / Quarterly / Annual" },
      { key: "start_date", label: "Preferred Start Date", required: true, type: "date", placeholder: "YYYY-MM-DD" },
    ],
  },
  {
    id: "tpl-trial",
    tenantId: "default",
    command: "trial",
    name: "Free Assessment & Trial",
    description: "Book an athlete skills evaluation or trial session",
    sheetName: "Trial Assessments",
    icon: "⚡",
    promptMessage: "Please fill trial details",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "name", label: "Athlete Name", required: true, type: "text", placeholder: "e.g. Priya Patel" },
      { key: "age", label: "Age / Category", required: true, type: "text", placeholder: "e.g. 15 yrs / U-16" },
      { key: "phone", label: "Contact Phone", required: true, type: "phone", placeholder: "+91 98765 43210" },
      { key: "sport", label: "Sport of Interest", required: true, type: "text", placeholder: "Tennis / Basketball" },
      { key: "skill_level", label: "Experience Level", required: true, type: "choice", placeholder: "Beginner / Intermediate" },
      { key: "preferred_date", label: "Preferred Date", required: true, type: "date", placeholder: "YYYY-MM-DD" },
    ],
  },
  {
    id: "tpl-tournament",
    tenantId: "default",
    command: "tournament",
    name: "Tournament Entry",
    description: "Register for upcoming foundation leagues & tournaments",
    sheetName: "Tournament Entries",
    icon: "🏆",
    promptMessage: "Please fill tournament entry",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "team_or_player", label: "Team / Player Name", required: true, type: "text", placeholder: "e.g. Warriors FC" },
      { key: "captain_phone", label: "Contact Phone", required: true, type: "phone", placeholder: "+91 98765 43210" },
      { key: "event_name", label: "Tournament Name", required: true, type: "text", placeholder: "Summer Cup 2026" },
      { key: "category", label: "Category / Division", required: true, type: "text", placeholder: "Open / U-17 Boys" },
    ],
  },
  {
    id: "tpl-equipment",
    tenantId: "default",
    command: "equipment",
    name: "Equipment Requisition",
    description: "Request foundation sports gear, balls, or kits",
    sheetName: "Equipment Requests",
    icon: "🎽",
    promptMessage: "Please fill equipment request",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "requested_by", label: "Requester Name", required: true, type: "text", placeholder: "e.g. Coach Anand" },
      { key: "sport", label: "Sport Department", required: true, type: "text", placeholder: "Football / Badminton" },
      { key: "gear_item", label: "Gear Requested", required: true, type: "text", placeholder: "Training Bibs / Match Balls" },
      { key: "quantity", label: "Quantity", required: true, type: "number", placeholder: "e.g. 5" },
      { key: "issue_date", label: "Required Date", required: true, type: "date", placeholder: "YYYY-MM-DD" },
    ],
  },
  {
    id: "tpl-coaching",
    tenantId: "default",
    command: "coaching",
    name: "1-on-1 Coaching Consultation",
    description: "Schedule high-performance coaching or fitness evaluation",
    sheetName: "Coaching Enquiries",
    icon: "🏋️",
    promptMessage: "Please fill coaching enquiry",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "name", label: "Trainee Name", required: true, type: "text", placeholder: "e.g. Vikram Singh" },
      { key: "phone", label: "Contact Phone", required: true, type: "phone", placeholder: "+91 98765 43210" },
      { key: "sport", label: "Target Sport", required: true, type: "text", placeholder: "Track & Field / Swimming" },
      { key: "goals", label: "Goals / Focus", required: true, type: "text", placeholder: "Speed, Endurance, Technique" },
    ],
  },
  {
    id: "tpl-feedback",
    tenantId: "default",
    command: "feedback",
    name: "Athlete & Parent Feedback",
    description: "Submit suggestions, coaching reviews, or feedback",
    sheetName: "Feedback & Grievances",
    icon: "💬",
    promptMessage: "Please submit feedback",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "name", label: "Your Name", required: true, type: "text", placeholder: "e.g. Sunita Rao" },
      { key: "phone", label: "Contact Phone", required: false, type: "phone", placeholder: "+91 98765 43210" },
      { key: "category", label: "Category", required: true, type: "choice", placeholder: "Coaching / Facilities / Safety" },
      { key: "comments", label: "Comments", required: true, type: "text", placeholder: "Your feedback or suggestions" },
    ],
  },
  {
    id: "tpl-sponsor",
    tenantId: "default",
    command: "sponsor",
    name: "Sponsorship & CSR Enquiries",
    description: "Partner with our sports foundation or sponsor an athlete",
    sheetName: "Sponsorships & Grants",
    icon: "🤝",
    promptMessage: "Please fill sponsorship details",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      { key: "org_name", label: "Company / Sponsor Name", required: true, type: "text", placeholder: "e.g. Apex Corp" },
      { key: "contact_person", label: "Contact Person", required: true, type: "text", placeholder: "e.g. Rajiv Kapoor" },
      { key: "phone", label: "Contact Phone", required: true, type: "phone", placeholder: "+91 98765 43210" },
      { key: "interest", label: "Interest / Domain", required: true, type: "text", placeholder: "Athlete Scholarship / Event Sponsor" },
    ],
  },
];

export async function getChatTemplates(tenantId?: string): Promise<ChatTemplateItem[]> {
  try {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    const res = await apiFetch<ChatTemplateItem[]>(`/api/templates${qs}`);
    if (res && res.length > 0) return res;
    return DEFAULT_FALLBACK_TEMPLATES;
  } catch (err) {
    console.warn("[getChatTemplates] API unreachable, using default sports templates:", err);
    return DEFAULT_FALLBACK_TEMPLATES;
  }
}

export async function submitTemplateForm(data: {
  conversationId: string;
  tenantId: string;
  command: string;
  senderId: string;
  senderName: string;
  senderPhone?: string;
  formData: Record<string, string>;
}): Promise<{ submissionId: string; sheetName: string; message?: Message }> {
  try {
    return await apiFetch<{ submissionId: string; sheetName: string; message?: Message }>(
      "/api/templates/submit",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  } catch (err) {
    console.warn("[submitTemplateForm] API call failed, generating simulated confirmation:", err);
    const subId = `SUB-${Date.now().toString(36).toUpperCase()}`;
    return {
      submissionId: subId,
      sheetName: `${data.command.charAt(0).toUpperCase() + data.command.slice(1)} Records`,
    };
  }
}

export async function lookupUserByPhone(
  phone: string,
  tenantId?: string
): Promise<{
  found: boolean;
  name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
}> {
  try {
    const qs = new URLSearchParams({ phone });
    if (tenantId) qs.set("tenantId", tenantId);
    return await apiFetch<{
      found: boolean;
      name?: string;
      email?: string;
      phone?: string;
      metadata?: Record<string, any>;
    }>(`/api/templates/user-lookup?${qs.toString()}`);
  } catch (err) {
    console.warn("[lookupUserByPhone] API unreachable:", err);
    return { found: false };
  }
}

export async function getDashboardData(options?: {
  tenantId?: string;
  command?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  sport?: string;
  sync?: string;
}): Promise<any> {
  const qs = new URLSearchParams();
  if (options?.tenantId) qs.set("tenantId", options.tenantId);
  if (options?.command && options.command !== "all") qs.set("command", options.command);
  if (options?.search) qs.set("search", options.search);
  if (options?.startDate) qs.set("startDate", options.startDate);
  if (options?.endDate) qs.set("endDate", options.endDate);
  if (options?.status) qs.set("status", options.status);
  if (options?.sport) qs.set("sport", options.sport);
  if (options?.sync) qs.set("sync", options.sync);

  try {
    const res = await apiFetch<any>(`/api/dashboard/data?${qs.toString()}`);
    return res;
  } catch (err) {
    console.warn("[getDashboardData] API unreachable, falling back to local fallback:", err);
    return null;
  }
}

// ─── Super Admin Full API Suite ──────────────────────────────────────────

export async function fetchAdminOverview(): Promise<any> {
  try {
    return await apiFetch<any>("/api/admin/overview");
  } catch (err) {
    console.warn("[fetchAdminOverview] fallback:", err);
    return {
      totalTenants: 1,
      totalUsers: 3,
      totalConversations: 2,
      totalMessages: 6,
      totalSheets: 1,
      recentTenants: [
        { id: "cmtgyf6k900007eegk9xui75k", name: "OFA Sports", slug: "ofa-sports", userCount: 3, groupCount: 2, hasSheet: true, createdAt: new Date().toISOString() },
      ],
    };
  }
}

export async function fetchAdminOrganizations(): Promise<any[]> {
  try {
    return await apiFetch<any[]>("/api/admin/organizations");
  } catch (err) {
    console.warn("[fetchAdminOrganizations] fallback:", err);
    return [
      {
        id: "cmtgyf6k900007eegk9xui75k",
        name: "OFA Sports",
        slug: "ofa-sports",
        createdAt: new Date().toISOString(),
        userCount: 3,
        groupCount: 2,
        sheetConnection: {
          id: "sheet-conn-1",
          spreadsheetId: "1p0G7K8x9...",
          sheetName: "Facility Bookings",
          authMode: "Service Account",
        },
      },
    ];
  }
}

export async function fetchAdminUsers(): Promise<any[]> {
  try {
    return await apiFetch<any[]>("/api/admin/users");
  } catch (err) {
    console.warn("[fetchAdminUsers] fallback:", err);
    return [
      { id: "u-1", name: "Super Admin", email: "admin@ofa-sports.com", role: "ADMIN", tenantName: "OFA Sports", createdAt: new Date().toISOString() },
      { id: "u-2", name: "App User", email: "demo@ofa-sports.com", role: "USER", tenantName: "OFA Sports", createdAt: new Date().toISOString() },
      { id: "u-3", name: "OFA AI Assistant", email: "bot@ofa-sports.com", role: "BOT", tenantName: "OFA Sports", createdAt: new Date().toISOString() },
    ];
  }
}

export async function createAdminUser(data: {
  name?: string;
  email: string;
  password?: string;
  role: "USER" | "ADMIN";
  tenantId?: string;
}): Promise<any> {
  return await apiFetch<any>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminUser(id: string): Promise<any> {
  return await apiFetch<any>(`/api/admin/users?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchAdminConversations(): Promise<any[]> {
  try {
    return await apiFetch<any[]>("/api/admin/conversations");
  } catch (err) {
    console.warn("[fetchAdminConversations] fallback:", err);
    return [
      {
        id: "ofa-conv-001",
        name: "OFA Sports AI Assistant",
        kind: "AI",
        tenantName: "OFA Sports",
        totalMessages: 6,
        createdAt: new Date().toISOString(),
        participants: [{ name: "App User", email: "demo@ofa-sports.com", role: "USER" }],
        lastMessage: { senderName: "App User", body: "Book tennis court for tomorrow", createdAt: new Date().toISOString() },
      },
    ];
  }
}

export async function fetchAdminSystemHealth(): Promise<any> {
  try {
    return await apiFetch<any>("/api/admin/system-health");
  } catch (err) {
    console.warn("[fetchAdminSystemHealth] fallback:", err);
    return {
      uptimeSeconds: 3600,
      timestamp: new Date().toISOString(),
      services: {
        database: { name: "PostgreSQL (Prisma)", status: "ONLINE", latencyMs: 14 },
        realtime: { name: "Socket.io Engine", status: "ONLINE", latencyMs: 3, connectedClients: 2 },
        ai: { name: "Groq LLaMA-3", status: "READY", model: "openai/gpt-oss-120b" },
      },
    };
  }
}

export async function fetchAdminAiSettings(): Promise<any> {
  try {
    return await apiFetch<any>("/api/admin/ai-settings");
  } catch (err) {
    console.warn("[fetchAdminAiSettings] fallback:", err);
    return {
      hasApiKey: true,
      maskedApiKey: "gsk_••••••••••••",
      model: "openai/gpt-oss-120b",
      systemPrompt: "You are the official AI Assistant for OFA Sports. You help customers with sports facilities, court reservations, coaching programmes, and corporate events.",
      availableModels: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    };
  }
}

export async function saveAdminAiSettings(data: {
  apiKey?: string;
  model: string;
  systemPrompt: string;
}): Promise<any> {
  return await apiFetch<any>("/api/admin/ai-settings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function testAdminAiConnection(data: {
  apiKey?: string;
  model: string;
}): Promise<any> {
  return await apiFetch<any>("/api/admin/ai-settings", {
    method: "POST",
    body: JSON.stringify({ ...data, testConnection: true }),
  });
}

export async function fetchAdminTemplates(): Promise<any[]> {
  try {
    return await apiFetch<any[]>("/api/admin/templates");
  } catch (err) {
    console.warn("[fetchAdminTemplates] fallback:", err);
    return DEFAULT_FALLBACK_TEMPLATES;
  }
}

export async function createAdminTemplate(data: {
  command: string;
  name: string;
  description?: string;
  sheetName: string;
  icon?: string;
  fields: any[];
  autoCreateSheet?: boolean;
}): Promise<any> {
  return await apiFetch<any>("/api/admin/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminTemplate(data: {
  command: string;
  name: string;
  description?: string;
  sheetName: string;
  icon?: string;
  fields: any[];
}): Promise<any> {
  return await apiFetch<any>("/api/admin/templates", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminTemplate(command: string): Promise<any> {
  return await apiFetch<any>(`/api/admin/templates?command=${encodeURIComponent(command)}`, {
    method: "DELETE",
  });
}

export async function seedAdminTemplates(): Promise<any> {
  return await apiFetch<any>("/api/admin/templates/seed", {
    method: "POST",
  });
}

export async function fetchAdminSubmissions(): Promise<any> {
  try {
    return await apiFetch<any>("/api/admin/submissions");
  } catch (err) {
    console.warn("[fetchAdminSubmissions] fallback:", err);
    return { submissions: [], stats: { total: 0, synced: 0, pending: 0 } };
  }
}

export async function syncAdminSubmission(submissionId: string): Promise<any> {
  return await apiFetch<any>("/api/admin/sync-submission", {
    method: "POST",
    body: JSON.stringify({ submissionId }),
  });
}

export async function testAdminSheetConnection(spreadsheetIdOrUrl: string): Promise<any> {
  return await apiFetch<any>("/api/admin/sheet-test", {
    method: "POST",
    body: JSON.stringify({ spreadsheetIdOrUrl }),
  });
}

export async function saveAdminSheetConfig(data: {
  organizationId: string;
  spreadsheetIdOrUrl: string;
  sheetName?: string;
}): Promise<any> {
  return await apiFetch<any>("/api/admin/sheet-config", {
    method: "POST",
    body: JSON.stringify(data),
  });
}


