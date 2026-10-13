import { prisma } from "./prisma";
import { getEffectiveSpreadsheetId, getGoogleSheetsClient } from "./ai";

// ─── Standard Header Definitions ──────────────────────────────────────────────

export const ADMISSIONS_HEADERS = [
  "Player ID",
  "Full Name",
  "Mobile Number",
  "Date of Birth",
  "Age",
  "Gender",
  "Venue",
  "Primary Sport",
  "Joining Date",
  "Start Time",
  "End Time",
  "Status",
  "Guardian Name",
  "Guardian Phone",
  "Address",
  "Admission Fee (₹)",
  "Monthly Fee (₹)",
  "Coaching Type",
  "Age Segment",
  "Training Group",
  "ID Card No",
  "Photo URL",
  "Created At",
];

export const BOOKINGS_HEADERS = [
  "Booking ID",
  "Facility / Venue",
  "Customer Name",
  "Mobile No",
  "Title",
  "Date",
  "Start Time",
  "End Time",
  "Consumables",
  "Total Amount (₹)",
  "Status",
  "Notes",
  "Logged At",
];

export const PAYMENTS_HEADERS = [
  "Payment ID",
  "Receipt No",
  "Player ID",
  "Payer Name",
  "Amount (₹)",
  "Payment Method",
  "Reference / UPI ID",
  "Invoice Period",
  "Date",
  "Status",
  "Notes",
  "Logged At",
];

export const ATTENDANCE_HEADERS = [
  "Attendance ID",
  "Date",
  "Session / Batch",
  "Sport",
  "Player ID",
  "Player Name",
  "Status",
  "Notes",
  "Marked By",
  "Logged At",
];

export const INVENTORY_HEADERS = [
  "Allocation ID",
  "Item Name",
  "Category",
  "Event Type",
  "Quantity",
  "Size",
  "Jersey Number",
  "Allocated To Player",
  "Notes",
  "Recorded At",
];

// In-memory cache for known tabs per spreadsheet
const tabCache = new Map<string, Set<string>>();

/**
 * Resolves the effective Google Sheets client and spreadsheet ID for a tenant.
 */
export async function getSheetConnection(tenantId?: string) {
  let spreadsheetId: string | null = null;

  if (tenantId) {
    try {
      const conn = await prisma.sheetConnection.findFirst({ where: { tenantId } });
      if (conn?.spreadsheetId) {
        spreadsheetId = getEffectiveSpreadsheetId(conn.spreadsheetId);
      }
    } catch {
      // Fallback to env
    }
  }

  if (!spreadsheetId) {
    spreadsheetId = getEffectiveSpreadsheetId();
  }

  if (!spreadsheetId) {
    return null;
  }

  const sheets = await getGoogleSheetsClient();
  if (!sheets) {
    return null;
  }

  return { sheets, spreadsheetId };
}

/**
 * Ensures a sheet tab exists and that all required headers are present in Row 1.
 */
export async function ensureSheetTabWithHeaders(
  sheets: any,
  spreadsheetId: string,
  tabName: string,
  defaultHeaders: string[]
): Promise<string[]> {
  let cached = tabCache.get(spreadsheetId);
  if (!cached) {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    });
    const tabs = (meta.data.sheets ?? []).map(
      (s: { properties?: { title?: string | null } | null }) => s?.properties?.title ?? ""
    ).filter(Boolean);
    cached = new Set(tabs);
    tabCache.set(spreadsheetId, cached);
  }

  // 1. Create tab if missing
  if (!cached.has(tabName)) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: tabName },
              },
            },
          ],
        },
      });
      cached.add(tabName);
      console.log(`[sheets-sync] 📑 Created tab "${tabName}" in spreadsheet`);
    } catch (err: any) {
      if (!err?.message?.includes("already exists")) {
        console.error(`[sheets-sync] Failed to create tab "${tabName}":`, err?.message);
      }
      cached.add(tabName);
    }
  }

  // 2. Read existing headers
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!1:1`,
  });

  const existingHeaders: string[] = (headerRes.data.values?.[0] as string[]) || [];

  if (existingHeaders.length === 0) {
    // Write full default header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [defaultHeaders] },
    });
    return defaultHeaders;
  }

  // Check if any default headers are missing
  const missingHeaders = defaultHeaders.filter(
    (dh) => !existingHeaders.some((eh) => eh.trim().toLowerCase() === dh.trim().toLowerCase())
  );

  if (missingHeaders.length > 0) {
    const mergedHeaders = [...existingHeaders, ...missingHeaders];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!1:1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [mergedHeaders] },
    });
    return mergedHeaders;
  }

  return existingHeaders;
}

/**
 * Upserts a row in a Google Sheet tab:
 * If a row with matching primary key exists, updates in place; otherwise appends.
 */
export async function upsertRowByColumn(
  sheets: any,
  spreadsheetId: string,
  tabName: string,
  primaryKeyHeader: string,
  primaryKeyValue: string,
  rowData: Record<string, any>,
  defaultHeaders: string[]
): Promise<boolean> {
  if (!primaryKeyValue) return false;

  const headers = await ensureSheetTabWithHeaders(sheets, spreadsheetId, tabName, defaultHeaders);

  // Find index of the primary key header in the header row
  const pkColIdx = headers.findIndex(
    (h) => h.trim().toLowerCase() === primaryKeyHeader.trim().toLowerCase()
  );
  const targetColIdx = pkColIdx >= 0 ? pkColIdx : 0;

  // Convert column index to A1 notation column letter (e.g. 0 -> A, 1 -> B)
  const colLetter = String.fromCharCode(65 + (targetColIdx % 26));

  // Fetch the primary key column to locate existing rows
  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!${colLetter}:${colLetter}`,
  });

  const colValues = (colRes.data.values ?? []) as string[][];
  let existingRowIndex = -1; // 1-indexed for Sheets A1 notation

  const normTargetVal = primaryKeyValue.trim().toLowerCase();
  for (let r = 1; r < colValues.length; r++) { // skip row 0 (header)
    const cellVal = colValues[r]?.[0];
    if (cellVal && String(cellVal).trim().toLowerCase() === normTargetVal) {
      existingRowIndex = r + 1; // 1-based row number
      break;
    }
  }

  // Prepare row values according to header ordering
  const rowValues = headers.map((header) => {
    // 1. Direct match
    if (rowData[header] !== undefined && rowData[header] !== null) {
      return String(rowData[header]);
    }

    // 2. Case-insensitive / normalized match
    const hNorm = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    const foundKey = Object.keys(rowData).find((k) => {
      const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      return kNorm === hNorm || kNorm.includes(hNorm) || hNorm.includes(kNorm);
    });

    if (foundKey && rowData[foundKey] !== undefined && rowData[foundKey] !== null) {
      return String(rowData[foundKey]);
    }

    return "";
  });

  if (existingRowIndex > 1) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A${existingRowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    console.log(`[sheets-sync] 🔄 Updated row in "${tabName}" at line ${existingRowIndex} (${primaryKeyValue})`);
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tabName}'!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    console.log(`[sheets-sync] ➕ Appended row into "${tabName}" (${primaryKeyValue})`);
  }

  return true;
}

// ─── Entity Sync Implementations ──────────────────────────────────────────────

/**
 * Synchronizes an AcademyPlayer admission record to the "Admissions" tab.
 */
export async function syncPlayerAdmissionToSheet(
  playerOrId: string | any,
  tenantId?: string,
  extra?: Record<string, any>
): Promise<boolean> {
  try {
    const conn = await getSheetConnection(tenantId);
    if (!conn) {
      console.log("[sheets-sync] Skipping player admission sync: No Google Sheet configured or credentials missing");
      return false;
    }

    let player = playerOrId;
    if (typeof playerOrId === "string") {
      player = await prisma.academyPlayer.findUnique({
        where: { id: playerOrId },
        include: { sports: { include: { sport: true } } },
      });
    }

    if (!player) return false;

    const sportsList = player.sports
      ? player.sports.map((s: any) => s.sport?.name || s.name).filter(Boolean).join(", ")
      : extra?.primarySportName || extra?.sport || "General Sport";

    const dobStr = player.dateOfBirth
      ? (player.dateOfBirth instanceof Date ? player.dateOfBirth.toISOString().slice(0, 10) : String(player.dateOfBirth).slice(0, 10))
      : "";

    const joiningStr = player.joiningDate
      ? (player.joiningDate instanceof Date ? player.joiningDate.toISOString().slice(0, 10) : String(player.joiningDate).slice(0, 10))
      : new Date().toISOString().slice(0, 10);

    const nowStr = player.createdAt
      ? (player.createdAt instanceof Date ? player.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : String(player.createdAt))
      : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const rowData: Record<string, any> = {
      "Player ID": player.playerCode || player.id,
      "Full Name": player.name || player.fullName,
      "Mobile Number": player.guardianPhone || extra?.mobileNumber || "",
      "Date of Birth": dobStr,
      "Age": extra?.age ?? "",
      "Gender": extra?.gender ?? "Male",
      "Venue": extra?.venue ?? "OFA-1",
      "Primary Sport": sportsList,
      "Joining Date": joiningStr,
      "Start Time": player.startTime || extra?.startTime || "",
      "End Time": player.endTime || extra?.endTime || "",
      "Status": player.status || "ACTIVE",
      "Guardian Name": player.guardianName || "",
      "Guardian Phone": player.guardianPhone || "",
      "Address": player.address || "",
      "Admission Fee (₹)": extra?.admissionFee ?? "",
      "Monthly Fee (₹)": extra?.monthlyFee ?? "",
      "Coaching Type": extra?.coachingType ?? "",
      "Age Segment": extra?.ageSegment ?? "",
      "Training Group": extra?.trainingGroup ?? "",
      "ID Card No": extra?.idCardNumber ?? "",
      "Photo URL": player.photoKey || extra?.photoUrl || "",
      "Created At": nowStr,
    };

    return await upsertRowByColumn(
      conn.sheets,
      conn.spreadsheetId,
      "Admissions",
      "Player ID",
      player.playerCode || player.id,
      rowData,
      ADMISSIONS_HEADERS
    );
  } catch (err) {
    console.error("[sheets-sync] Error syncing player admission to Google Sheet:", err);
    return false;
  }
}

/**
 * Synchronizes an AcademyBooking record to the "Bookings" tab.
 */
export async function syncBookingToSheet(
  bookingOrId: string | any,
  tenantId?: string,
  extra?: Record<string, any>
): Promise<boolean> {
  try {
    const conn = await getSheetConnection(tenantId);
    if (!conn) {
      console.log("[sheets-sync] Skipping booking sync: No Google Sheet configured or credentials missing");
      return false;
    }

    let booking = bookingOrId;
    if (typeof bookingOrId === "string") {
      booking = await prisma.academyBooking.findUnique({
        where: { id: bookingOrId },
        include: { facility: true },
      });
    }

    if (!booking) return false;

    const startAt = booking.startAt instanceof Date ? booking.startAt : new Date(booking.startAt);
    const endAt = booking.endAt instanceof Date ? booking.endAt : new Date(booking.endAt);

    const dateStr = !isNaN(startAt.getTime()) ? startAt.toISOString().slice(0, 10) : "";
    const startTimeStr = !isNaN(startAt.getTime()) ? startAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
    const endTimeStr = !isNaN(endAt.getTime()) ? endAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
    const loggedAtStr = booking.createdAt
      ? (booking.createdAt instanceof Date ? booking.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : String(booking.createdAt))
      : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const totalAmount = extra?.totalAmountCents
      ? Math.round(Number(extra.totalAmountCents) / 100)
      : (extra?.totalAmount ?? "");

    const customerName = extra?.bookedBy || extra?.customerName || booking.title?.split(" - ")?.[0] || "Customer";
    const phone = extra?.contactPhone || extra?.phone || "";

    const rowData: Record<string, any> = {
      "Booking ID": booking.id,
      "Facility / Venue": booking.facility?.name || extra?.facilityName || "Court",
      "Customer Name": customerName,
      "Mobile No": phone,
      "Title": booking.title || `${customerName} - Court`,
      "Date": dateStr,
      "Start Time": startTimeStr,
      "End Time": endTimeStr,
      "Time": `${startTimeStr} - ${endTimeStr}`,
      "Court": booking.facility?.name || "Court",
      "Consumables": extra?.consumablesSummary || extra?.consumables || "",
      "Amount": totalAmount ? `₹${totalAmount}` : "",
      "Total Amount (₹)": totalAmount ? `₹${totalAmount}` : "",
      "Status": booking.status || "CONFIRMED",
      "Notes": booking.notes || "",
      "Details": booking.notes || booking.title || "",
      "Logged At": loggedAtStr,
      "Raw Message": `[Booking] ${booking.title || "Facility Reservation"}`,
    };

    return await upsertRowByColumn(
      conn.sheets,
      conn.spreadsheetId,
      "Bookings",
      "Booking ID",
      booking.id,
      rowData,
      BOOKINGS_HEADERS
    );
  } catch (err) {
    console.error("[sheets-sync] Error syncing booking to Google Sheet:", err);
    return false;
  }
}

/**
 * Synchronizes an AcademyPayment record to the "Payments" tab.
 */
export async function syncPaymentToSheet(
  paymentOrId: string | any,
  tenantId?: string,
  extra?: Record<string, any>
): Promise<boolean> {
  try {
    const conn = await getSheetConnection(tenantId);
    if (!conn) {
      console.log("[sheets-sync] Skipping payment sync: No Google Sheet configured or credentials missing");
      return false;
    }

    let payment = paymentOrId;
    if (typeof paymentOrId === "string") {
      payment = await prisma.academyPayment.findUnique({
        where: { id: paymentOrId },
        include: {
          player: true,
          allocations: { include: { invoice: true } },
          receipts: true,
        },
      });
    }

    if (!payment) return false;

    const receiptNo = payment.receipts?.[0]?.id || extra?.receiptNumber || payment.reference || `RCP-${payment.id.slice(0, 6)}`;
    const paidAtDate = payment.paidAt instanceof Date ? payment.paidAt : new Date(payment.paidAt || Date.now());
    const paidDateStr = !isNaN(paidAtDate.getTime()) ? paidAtDate.toISOString().slice(0, 10) : "";
    const loggedAtStr = payment.createdAt
      ? (payment.createdAt instanceof Date ? payment.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : String(payment.createdAt))
      : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const invoicePeriods = (payment.allocations || [])
      .map((a: any) => a.invoice?.period)
      .filter(Boolean)
      .join(", ");

    const payerName = payment.player?.name || extra?.playerName || "Member";
    const playerCode = payment.player?.playerCode || extra?.playerCode || "";
    const amountVal = Number(payment.amount || extra?.amount || 0);

    const rowData: Record<string, any> = {
      "Payment ID": payment.id,
      "Receipt No": receiptNo,
      "Player ID": playerCode,
      "Payer Name": payerName,
      "Mobile No": payment.player?.guardianPhone || extra?.mobile || "",
      "Amount": `₹${amountVal}`,
      "Amount (₹)": `₹${amountVal}`,
      "Payment Method": payment.method || "CASH",
      "Purpose": invoicePeriods || "Academy Fee",
      "Reference / UPI ID": payment.reference || "",
      "Invoice Period": invoicePeriods || "General Fee",
      "Date": paidDateStr,
      "Status": "CONFIRMED",
      "Notes": payment.notes || "",
      "Details": `${payment.method} Payment of ₹${amountVal} for ${payerName}`,
      "Logged At": loggedAtStr,
      "Raw Message": `[Payment Recorded] Receipt: ${receiptNo}`,
    };

    return await upsertRowByColumn(
      conn.sheets,
      conn.spreadsheetId,
      "Payments",
      "Payment ID",
      payment.id,
      rowData,
      PAYMENTS_HEADERS
    );
  } catch (err) {
    console.error("[sheets-sync] Error syncing payment to Google Sheet:", err);
    return false;
  }
}

/**
 * Synchronizes attendance records to the "Attendance" tab.
 */
export async function syncAttendanceRecordsToSheet(
  records: any[],
  tenantId?: string,
  extra?: { sessionName?: string; sportName?: string; date?: string; markedBy?: string }
): Promise<boolean> {
  try {
    const conn = await getSheetConnection(tenantId);
    if (!conn) return false;

    const loggedAtStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const dateStr = extra?.date || new Date().toISOString().slice(0, 10);

    for (const rec of records) {
      const rowData: Record<string, any> = {
        "Attendance ID": rec.id || `att-${Date.now()}-${rec.playerId}`,
        "Date": dateStr,
        "Session / Batch": extra?.sessionName || rec.session?.batch?.name || "Regular Batch",
        "Sport": extra?.sportName || "Athletics",
        "Player ID": rec.player?.playerCode || rec.playerId,
        "Player Name": rec.player?.name || "Player",
        "Status": rec.status || "PRESENT",
        "Notes": rec.notes || "",
        "Marked By": extra?.markedBy || "Coach",
        "Logged At": loggedAtStr,
      };

      await upsertRowByColumn(
        conn.sheets,
        conn.spreadsheetId,
        "Attendance",
        "Attendance ID",
        rowData["Attendance ID"],
        rowData,
        ATTENDANCE_HEADERS
      );
    }

    return true;
  } catch (err) {
    console.error("[sheets-sync] Error syncing attendance to Google Sheet:", err);
    return false;
  }
}

/**
 * Performs a full synchronization of all records currently in the PostgreSQL database
 * into the Google Sheet workbook.
 */
export async function syncAllDatabaseToSheet(tenantId?: string): Promise<{
  success: boolean;
  stats: {
    players: number;
    bookings: number;
    payments: number;
    submissions: number;
  };
  message: string;
}> {
  const stats = { players: 0, bookings: 0, payments: 0, submissions: 0 };
  const conn = await getSheetConnection(tenantId);

  if (!conn) {
    return {
      success: false,
      stats,
      message: "Google Sheets connection not configured or credentials file missing.",
    };
  }

  try {
    const whereTenant = tenantId ? { tenantId } : {};

    // 1. Sync all Players / Admissions
    const players = await prisma.academyPlayer.findMany({
      where: whereTenant,
      include: { sports: { include: { sport: true } } },
      orderBy: { createdAt: "asc" },
    });

    for (const player of players) {
      const ok = await syncPlayerAdmissionToSheet(player, tenantId);
      if (ok) stats.players++;
    }

    // 2. Sync all Bookings
    const bookings = await prisma.academyBooking.findMany({
      where: whereTenant,
      include: { facility: true },
      orderBy: { createdAt: "asc" },
    });

    for (const booking of bookings) {
      const ok = await syncBookingToSheet(booking, tenantId);
      if (ok) stats.bookings++;
    }

    // 3. Sync all Payments
    const payments = await prisma.academyPayment.findMany({
      where: whereTenant,
      include: {
        player: true,
        allocations: { include: { invoice: true } },
        receipts: true,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const payment of payments) {
      const ok = await syncPaymentToSheet(payment, tenantId);
      if (ok) stats.payments++;
    }

    // 4. Sync pending TemplateSubmissions
    const submissions = await prisma.templateSubmission.findMany({
      where: { ...whereTenant, syncedToSheet: false },
      orderBy: { createdAt: "asc" },
    });

    for (const sub of submissions) {
      try {
        const targetTab = sub.sheetName || "Feedback & Grievances";
        const formData = (sub.data as Record<string, any>) || {};
        const submissionRef = sub.submissionRef || sub.id;

        const defaultHeaders = [
          "Submission ID",
          "Timestamp",
          "User Name",
          "User Phone",
          ...Object.keys(formData),
          "Status",
          "Raw Message",
        ];

        const rowValues: Record<string, any> = {
          "Submission ID": submissionRef,
          "Timestamp": sub.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          "User Name": sub.userName || "Customer",
          "User Phone": sub.userPhone || "",
          ...formData,
          "Status": sub.status,
          "Raw Message": sub.rawMessage || "",
        };

        const ok = await upsertRowByColumn(
          conn.sheets,
          conn.spreadsheetId,
          targetTab,
          "Submission ID",
          submissionRef,
          rowValues,
          defaultHeaders
        );

        if (ok) {
          await prisma.templateSubmission.update({
            where: { id: sub.id },
            data: { syncedToSheet: true },
          }).catch(() => {});
          stats.submissions++;
        }
      } catch (subErr) {
        console.error(`[sheets-sync] Failed to sync submission ${sub.id}:`, subErr);
      }
    }

    const message = `Full sync completed: ${stats.players} player(s), ${stats.bookings} booking(s), ${stats.payments} payment(s), and ${stats.submissions} submission(s) synchronized to Google Sheet.`;
    console.log(`[sheets-sync] ✅ ${message}`);

    return {
      success: true,
      stats,
      message,
    };
  } catch (err: any) {
    console.error("[sheets-sync] Error during full sync:", err);
    return {
      success: false,
      stats,
      message: err?.message || "Sync failed",
    };
  }
}
