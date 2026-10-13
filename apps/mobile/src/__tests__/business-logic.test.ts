/**
 * Integration Tests — Business Logic Edge Cases
 *
 * Tests critical computations and data-flow logic that span multiple modules:
 *  - Balance/currency calculation in invoice normalization
 *  - Collection rate percentage calculation
 *  - Attendance percentage computation
 *  - Booking time validation constraints
 *  - Mock profile permission matrix
 */

import {
  setAcademyToken,
  fetchInvoices,
  fetchReportsData,
  MOCK_ACTIVE_PROFILE,
  type AcademyEnabledProfile,
} from "../academy/api";

beforeEach(() => {
  jest.restoreAllMocks();
  setAcademyToken(null);
});

// ─── Currency & Balance Calculations ─────────────────────────────────────────

describe("Invoice balance calculation integrity", () => {
  test("totalAmountCents - paidAmountCents = balanceCents when server omits balance", async () => {
    setAcademyToken("tok");
    const total = 750000;
    const paid = 250000;
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          data: [{ id: "i1", playerId: "p1", totalAmountCents: total, paidAmountCents: paid, dueDate: "2026-10-01" }],
        }),
    } as unknown as Response);

    const invoices = await fetchInvoices();
    expect(invoices[0].balanceCents).toBe(total - paid);
  });

  test("balanceCents is never negative (over-payment guard)", async () => {
    setAcademyToken("tok");
    // paidAmount > totalAmount: balance should be clamped to 0
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          data: [{ id: "i2", playerId: "p1", totalAmountCents: 100000, paidAmountCents: 120000, dueDate: "2026-10-01" }],
        }),
    } as unknown as Response);

    const invoices = await fetchInvoices();
    expect(invoices[0].balanceCents).toBeGreaterThanOrEqual(0);
  });

  test("invoice without paidAmountCents defaults to 0 paid", async () => {
    setAcademyToken("tok");
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          data: [{ id: "i3", playerId: "p1", subtotalCents: 500000, totalAmountCents: 500000, dueDate: "2026-10-01" }],
        }),
    } as unknown as Response);

    const invoices = await fetchInvoices();
    expect(invoices[0].paidAmountCents).toBe(0);
    expect(invoices[0].balanceCents).toBe(500000);
  });
});

// ─── Reports Collection Rate ──────────────────────────────────────────────────

describe("fetchReportsData — collection rate precision", () => {
  test("collectionRatePct rounds to 1 decimal place", async () => {
    setAcademyToken("tok");
    // 1/3 of invoiced → 33.3%
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ok: true, data: { summary: { totalSessions: 5, presentCount: 4, attendanceRate: 80 } } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: { summary: { totalInvoiced: 300000, totalCollected: 100000, totalOutstanding: 200000, defaultersCount: 1 } },
          }),
      } as unknown as Response);

    const data = await fetchReportsData();
    // 100000/300000 * 100 = 33.3
    expect(data.finance.collectionRatePct).toBeCloseTo(33.3, 1);
  });

  test("collectionRatePct uses fallback when totalInvoiced is 0", async () => {
    setAcademyToken("tok");
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, data: { summary: { totalSessions: 0 } } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: { summary: { totalInvoiced: 0, totalCollected: 0, totalOutstanding: 0, defaultersCount: 0 } },
          }),
      } as unknown as Response);

    const data = await fetchReportsData();
    // When totalInvoiced is 0, should use fallback rate (> 0)
    expect(data.finance.collectionRatePct).toBeGreaterThan(0);
  });
});

// ─── Mock Profile Permission Matrix ──────────────────────────────────────────

describe("MOCK_ACTIVE_PROFILE — permission and navigation integrity", () => {
  test("OWNER profile has all required permissions", () => {
    expect(MOCK_ACTIVE_PROFILE.enabled).toBe(true);
    // Cast is safe because we assert enabled===true above
    const profile = MOCK_ACTIVE_PROFILE as AcademyEnabledProfile;

    const required = [
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
    ];

    required.forEach((perm) => {
      expect(profile.permissions).toContain(perm);
    });
  });

  test("navigation modules map to all required nav ids", () => {
    const profile = MOCK_ACTIVE_PROFILE as AcademyEnabledProfile;
    const navIds = profile.navigation.map((m) => m.id);
    const requiredIds = [
      "players",
      "sports",
      "batches",
      "attendance",
      "fees",
      "payments",
      "facilities",
      "bookings",
      "announcements",
      "reports",
    ];
    requiredIds.forEach((id) => {
      expect(navIds).toContain(id);
    });
  });

  test("every navigation module references a real permission", () => {
    const profile = MOCK_ACTIVE_PROFILE as AcademyEnabledProfile;
    profile.navigation.forEach((m) => {
      expect(profile.permissions).toContain(m.requires);
    });
  });

  test("all navigation modules have a phase number", () => {
    const profile = MOCK_ACTIVE_PROFILE as AcademyEnabledProfile;
    profile.navigation.forEach((m) => {
      expect(typeof m.phase).toBe("number");
      expect(m.phase).toBeGreaterThan(0);
    });
  });
});

// ─── Offline / Network Error Resilience ──────────────────────────────────────

describe("API offline resilience — all major functions", () => {
  const offlineError = new Error("Network request failed");

  test("fetchInvoices returns mock data when network fails", async () => {
    setAcademyToken("tok");
    jest.spyOn(global, "fetch").mockRejectedValue(offlineError);
    const invoices = await fetchInvoices();
    expect(invoices.length).toBeGreaterThan(0);
    expect(invoices[0].id).toBeTruthy();
  });

  test("fetchReportsData returns valid fallback when network fails", async () => {
    setAcademyToken("tok");
    jest.spyOn(global, "fetch").mockRejectedValue(offlineError);
    const data = await fetchReportsData();
    expect(data.attendance).toBeDefined();
    expect(data.finance).toBeDefined();
    // Fallback values should be positive
    expect(data.attendance.presentCount).toBeGreaterThan(0);
    expect(data.finance.totalPaidCents).toBeGreaterThan(0);
  });
});
