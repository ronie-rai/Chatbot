/**
 * Unit Tests — apps/mobile/src/academy/api.ts
 *
 * Tests the normalization logic, mock-fallback pattern, and all exported
 * async functions.  Network calls are mocked via jest.spyOn(global, "fetch").
 */

import {
  setAcademyToken,
  getAcademyToken,
  fetchAcademyProfile,
  fetchPlayers,
  admitPlayer,
  fetchSports,
  fetchBatches,
  fetchSessions,
  fetchSessionAttendance,
  markAttendance,
  fetchInvoices,
  recordPayment,
  fetchFacilities,
  fetchBookings,
  createBooking,
  fetchAnnouncements,
  markAnnouncementRead,
  fetchAssessments,
  fetchReportsData,
  normalizeToYyyyMmDd,
  uploadPhoto,
  MOCK_ACTIVE_PROFILE,
} from "../academy/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetch(body: unknown) {
  return jest.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

beforeEach(() => {
  jest.restoreAllMocks();
  setAcademyToken(null);
});

// ─── Token helpers ────────────────────────────────────────────────────────────

describe("setAcademyToken / getAcademyToken", () => {
  test("returns null initially", () => {
    expect(getAcademyToken()).toBeNull();
  });

  test("stores and returns a token", () => {
    setAcademyToken("jwt-abc-123");
    expect(getAcademyToken()).toBe("jwt-abc-123");
  });
});

// ─── fetchAcademyProfile ──────────────────────────────────────────────────────

describe("fetchAcademyProfile", () => {
  test("returns MOCK_ACTIVE_PROFILE when no token is set", async () => {
    const profile = await fetchAcademyProfile();
    expect(profile).toEqual(MOCK_ACTIVE_PROFILE);
  });

  test("returns MOCK_ACTIVE_PROFILE when API returns enabled:false", async () => {
    setAcademyToken("tok");
    mockFetch({ ok: true, data: { enabled: false } });
    const profile = await fetchAcademyProfile();
    expect(profile).toEqual(MOCK_ACTIVE_PROFILE);
  });

  test("returns server profile when API is healthy", async () => {
    setAcademyToken("tok");
    const serverProfile = { ...MOCK_ACTIVE_PROFILE, role: "COACH" as const };
    mockFetch({ ok: true, data: serverProfile });
    const profile = await fetchAcademyProfile();
    expect(profile).toEqual(serverProfile);
  });

  test("falls back to mock on network failure", async () => {
    setAcademyToken("tok");
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("offline"));
    const profile = await fetchAcademyProfile();
    expect(profile).toEqual(MOCK_ACTIVE_PROFILE);
  });
});

// ─── fetchPlayers ─────────────────────────────────────────────────────────────

describe("fetchPlayers", () => {
  test("returns mock players when no token", async () => {
    const result = await fetchPlayers();
    expect(Array.isArray(result.players)).toBe(true);
    expect(result.players.length).toBeGreaterThan(0);
    result.players.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.fullName).toBeTruthy();
      expect(p.status).toBeTruthy();
    });
  });

  test("normalises {data:{items:[]}} shape", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: {
        items: [
          {
            id: "srv-001",
            playerCode: "OFA-SRV1",
            name: "Server Player",
            dateOfBirth: "2013-01-01",
            gender: "MALE",
            status: "ACTIVE",
            guardianName: "Guardian",
            guardianPhone: "+91 99999 00000",
          },
        ],
        total: 1,
      },
    });
    const result = await fetchPlayers();
    expect(result.players).toHaveLength(1);
    expect(result.players[0].fullName).toBe("Server Player");
    expect(result.total).toBe(1);
  });

  test("normalises flat {data:[]} shape", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "srv-002",
          playerCode: "OFA-SRV2",
          fullName: "Flat Array Player",
          dateOfBirth: "2014-05-10",
          gender: "FEMALE",
          status: "ACTIVE",
          guardianName: "G2",
          guardianPhone: "+91 88888 11111",
        },
      ],
    });
    const result = await fetchPlayers();
    expect(result.players[0].fullName).toBe("Flat Array Player");
  });

  test("falls back to mock on fetch error", async () => {
    setAcademyToken("tok");
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network error"));
    const result = await fetchPlayers();
    expect(result.players.length).toBeGreaterThan(0);
  });
});

// ─── admitPlayer ──────────────────────────────────────────────────────────────

describe("admitPlayer", () => {
  test("returns mock player without token", async () => {
    const res = await admitPlayer({
      fullName: "Rohit Player",
      dateOfBirth: "2010-05-15",
      gender: "MALE",
      primarySportId: "sp-1",
      guardianName: "Parent",
      guardianPhone: "+91 99999 11111",
    });
    expect(res.ok).toBe(true);
    expect(res.player?.fullName).toBe("Rohit Player");
    expect(res.player?.playerCode).toMatch(/^OFA-/);
  });

  test("sends joiningDate and normalizes response when API is live", async () => {
    setAcademyToken("tok");
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          data: { id: "p-srv-1", playerCode: "OFA-000042" },
        }),
    } as unknown as Response);

    const res = await admitPlayer({
      fullName: "Rohit Player",
      dateOfBirth: "2010-05-15",
      gender: "MALE",
      primarySportId: "sp-1",
      guardianName: "Parent",
      guardianPhone: "+91 99999 11111",
    });

    expect(res.ok).toBe(true);
    expect(res.player?.playerCode).toBe("OFA-000042");
    expect(fetchSpy).toHaveBeenCalled();
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.joiningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sentBody.name).toBe("Rohit Player");
  });

  test("returns error message when API rejects with error", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: false,
      error: { message: "One or more selected sports are invalid or inactive" },
    });
    const res = await admitPlayer({
      fullName: "Rohit Player",
      dateOfBirth: "2010-05-15",
      gender: "MALE",
      primarySportId: "sp-invalid",
      guardianName: "Parent",
      guardianPhone: "+91 99999 11111",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("One or more selected sports are invalid or inactive");
  });

  test("sends complete 4-section admission payload to server", async () => {
    setAcademyToken("tok");
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          data: { id: "p-adv-1", playerCode: "OFA-000088" },
        }),
    } as unknown as Response);

    const fullPayload = {
      fullName: "Naman Agarwal",
      email: "client@email.com",
      mobileNumber: "9535682835",
      dateOfBirth: "2002-10-12",
      age: 24,
      gender: "Male",
      address: "123 Sports Street, Sector 5, Bangalore",
      venue: "OFA Sports Foundation - 3 (Biju Patnaik Indoor)",
      primarySportId: "sp-basket",
      primarySportName: "BASKETBALL",
      admissionDate: "2026-10-12",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      sessionsPerWeek: "Any / Not specified",
      monthlyFee: 3500,
      admissionFee: 1000,
      coachingType: "Group Coaching",
      ageSegment: "Adults (19+)",
      trainingGroup: "Advanced Batch",
      guardianName: "Ramesh Agarwal",
      guardianPhone: "9887766554",
      idCardNumber: "1234-5678-9012",
      copyStatus: "Approved",
      temporaryPassword: "Welcome@123",
      photoUrl: "player-photo-uploaded.jpg",
    };

    const res = await admitPlayer(fullPayload);

    expect(res.ok).toBe(true);
    expect(res.player?.playerCode).toBe("OFA-000088");
    expect(fetchSpy).toHaveBeenCalled();
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.name).toBe("Naman Agarwal");
    expect(sentBody.email).toBe("client@email.com");
    expect(sentBody.mobileNumber).toBe("9535682835");
    expect(sentBody.age).toBe(24);
    expect(sentBody.gender).toBe("Male");
    expect(sentBody.venue).toBe("OFA Sports Foundation - 3 (Biju Patnaik Indoor)");
    expect(sentBody.monthlyFee).toBe(3500);
    expect(sentBody.admissionFee).toBe(1000);
    expect(sentBody.coachingType).toBe("Group Coaching");
    expect(sentBody.guardianName).toBe("Ramesh Agarwal");
    expect(sentBody.guardianPhone).toBe("9887766554");
    expect(sentBody.temporaryPassword).toBe("Welcome@123");
  });
});

// ─── fetchSports ──────────────────────────────────────────────────────────────

describe("fetchSports", () => {
  test("returns mock sports without token", async () => {
    const sports = await fetchSports();
    expect(sports.every((s) => s.id && s.name)).toBe(true);
  });

  test("normalises defaultBillingMethod alias", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "sport-srv",
          name: "Tennis",
          category: "RACKET",
          defaultBillingMethod: "SESSION_PACK",
          active: true,
        },
      ],
    });
    const sports = await fetchSports();
    expect(sports[0].billingMethod).toBe("SESSION_PACK");
    expect(sports[0].isActive).toBe(true);
  });
});

// ─── fetchBatches ─────────────────────────────────────────────────────────────

describe("fetchBatches", () => {
  test("returns mock batches without token", async () => {
    const batches = await fetchBatches();
    expect(batches.every((b) => b.id && b.name)).toBe(true);
  });

  test("normalises coachUserId to headCoachId", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: {
        items: [
          { id: "batch-srv", name: "Batch A", sportId: "s1", capacity: 10, coachUserId: "coach-xyz" },
        ],
      },
    });
    const batches = await fetchBatches();
    expect(batches[0].headCoachId).toBe("coach-xyz");
  });
});

// ─── fetchSessions ────────────────────────────────────────────────────────────

describe("fetchSessions", () => {
  test("returns mock session without token", async () => {
    const sessions = await fetchSessions("batch-badm-adv");
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].batchId).toBe("batch-badm-adv");
  });

  test("returns empty array when server gives empty list", async () => {
    setAcademyToken("tok");
    mockFetch({ ok: true, data: { items: [] } });
    const sessions = await fetchSessions("b1");
    expect(sessions).toEqual([]);
  });

  test("normalises date+startTime fields to ISO scheduledStart", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "sess-srv",
          batchId: "b1",
          date: "2026-10-15",
          startTime: "09:00",
          endTime: "11:00",
          status: "SCHEDULED",
        },
      ],
    });
    const sessions = await fetchSessions("b1");
    expect(sessions[0].scheduledStart).toContain("2026-10-15");
  });
});

// ─── fetchSessionAttendance ───────────────────────────────────────────────────

describe("fetchSessionAttendance", () => {
  test("returns default PRESENT records without token", async () => {
    const records = await fetchSessionAttendance("sess-001");
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].status).toBe("PRESENT");
    expect(records[0].sessionId).toBe("sess-001");
  });

  test("normalises player.name to player.fullName", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "att-srv-1",
          sessionId: "sess-x",
          playerId: "p-1",
          status: "PRESENT",
          player: { id: "p-1", name: "John Doe", playerCode: "OFA-999", gender: "MALE", status: "ACTIVE" },
        },
      ],
    });
    const records = await fetchSessionAttendance("sess-x");
    expect(records[0].player?.fullName).toBe("John Doe");
  });
});

// ─── markAttendance ───────────────────────────────────────────────────────────

describe("markAttendance", () => {
  test("returns ok:true offline (no token)", async () => {
    const res = await markAttendance({
      sessionId: "s1",
      records: [{ playerId: "p1", status: "PRESENT" }],
      opId: "op-test",
    });
    expect(res.ok).toBe(true);
  });

  test("propagates server error message", async () => {
    setAcademyToken("tok");
    mockFetch({ ok: false, error: { code: "CONFLICT", message: "Duplicate submission" } });
    const res = await markAttendance({
      sessionId: "s1",
      records: [{ playerId: "p1", status: "ABSENT" }],
      opId: "op-test-err",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Duplicate submission");
  });
});

// ─── fetchInvoices ────────────────────────────────────────────────────────────

describe("fetchInvoices", () => {
  test("returns mock invoices without token", async () => {
    const invoices = await fetchInvoices();
    expect(invoices.every((i) => i.id && i.invoiceNumber)).toBe(true);
  });

  test("calculates balanceCents when server omits it", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "inv-srv",
          invoiceNumber: "INV-SRV-001",
          playerId: "p1",
          status: "ISSUED",
          subtotalCents: 600000,
          totalAmountCents: 600000,
          paidAmountCents: 100000,
          // balanceCents intentionally missing — should be computed
        },
      ],
    });
    const invoices = await fetchInvoices();
    expect(invoices[0].balanceCents).toBe(500000);
  });

  test("status inferred as PAID when balance is 0", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "inv-paid",
          playerId: "p1",
          subtotalCents: 300000,
          totalAmountCents: 300000,
          paidAmountCents: 300000,
          balanceCents: 0,
          dueDate: "2026-10-01",
        },
      ],
    });
    const invoices = await fetchInvoices();
    expect(invoices[0].status).toBe("PAID");
  });
});

// ─── recordPayment ────────────────────────────────────────────────────────────

describe("recordPayment", () => {
  test("returns mock receipt without token", async () => {
    const res = await recordPayment({ playerId: "p1", amountCents: 10000, paymentMethod: "CASH" });
    expect(res.ok).toBe(true);
    expect(res.receiptNumber).toMatch(/^RCP-MOCK-/);
  });

  test("returns server receipt and posts amount & method when API responds", async () => {
    setAcademyToken("tok");
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { receiptNumber: "RCP-SRV-2026" } }),
    } as unknown as Response);

    const res = await recordPayment({ playerId: "p1", amountCents: 50000, paymentMethod: "UPI" });
    expect(res.ok).toBe(true);
    expect(res.receiptNumber).toBe("RCP-SRV-2026");
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sentBody.amount).toBe(500);
    expect(sentBody.method).toBe("UPI");
    expect(sentBody.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── fetchFacilities ──────────────────────────────────────────────────────────

describe("fetchFacilities", () => {
  test("returns mock facilities without token", async () => {
    const facs = await fetchFacilities();
    expect(facs.length).toBeGreaterThan(0);
    expect(facs[0].courtCount).toBeGreaterThan(0);
  });

  test("normalises capacity field to courtCount", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [{ id: "fac-srv", name: "Arena 1", sportType: "Tennis", capacity: 4, active: true }],
    });
    const facs = await fetchFacilities();
    expect(facs[0].courtCount).toBe(4);
  });
});

// ─── fetchBookings ────────────────────────────────────────────────────────────

describe("fetchBookings", () => {
  test("returns mock bookings without token", async () => {
    const bookings = await fetchBookings();
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings[0].status).toBeTruthy();
  });

  test("normalises startAt field to startTime", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "bk-srv",
          facilityId: "fac-1",
          title: "Friendly Game",
          bookedBy: "Team A",
          startAt: "2026-10-14T10:00:00Z",
          endAt: "2026-10-14T12:00:00Z",
          status: "CONFIRMED",
          totalAmountCents: 200000,
        },
      ],
    });
    const bookings = await fetchBookings("fac-1");
    expect(bookings[0].startTime).toBe("2026-10-14T10:00:00Z");
  });
});

// ─── createBooking ────────────────────────────────────────────────────────────

describe("createBooking", () => {
  const payload = {
    facilityId: "fac-1",
    title: "Test Session",
    bookedBy: "Coach",
    startTime: "2026-10-15T10:00:00Z",
    endTime: "2026-10-15T12:00:00Z",
  };

  test("creates mock booking without token", async () => {
    const res = await createBooking(payload);
    expect(res.ok).toBe(true);
    expect(res.booking?.title).toBe("Test Session");
  });

  test("propagates booking conflict error from server", async () => {
    setAcademyToken("tok");
    mockFetch({ ok: false, error: { code: "CONFLICT", message: "Slot overlaps" } });
    const res = await createBooking(payload);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Slot overlaps");
  });
});

// ─── fetchAnnouncements ───────────────────────────────────────────────────────

describe("fetchAnnouncements", () => {
  test("returns mock announcements without token", async () => {
    const ann = await fetchAnnouncements();
    expect(ann.length).toBeGreaterThan(0);
    expect(ann[0].title).toBeTruthy();
  });

  test("normalises content field to body", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "ann-srv",
          title: "Server Notice",
          content: "Details here",
          priority: "HIGH",
          audience: "COACHES",
          createdAt: "2026-10-12T00:00:00Z",
        },
      ],
    });
    const ann = await fetchAnnouncements();
    expect(ann[0].body).toBe("Details here");
    expect(ann[0].targetAudience).toBe("COACHES");
  });

  test("marks isRead from reads array presence", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "ann-read",
          title: "Read Announcement",
          body: "Body",
          priority: "NORMAL",
          targetAudience: "ALL",
          reads: [{ userId: "u1" }],
          createdAt: "2026-10-12T00:00:00Z",
        },
      ],
    });
    const ann = await fetchAnnouncements();
    expect(ann[0].isRead).toBe(true);
  });
});

// ─── markAnnouncementRead ─────────────────────────────────────────────────────

describe("markAnnouncementRead", () => {
  test("returns true without token (offline)", async () => {
    const ok = await markAnnouncementRead("ann-001");
    expect(ok).toBe(true);
  });

  test("returns server boolean result", async () => {
    setAcademyToken("tok");
    mockFetch({ ok: true });
    const ok = await markAnnouncementRead("ann-001");
    expect(ok).toBe(true);
  });
});

// ─── fetchAssessments ────────────────────────────────────────────────────────

describe("fetchAssessments", () => {
  test("returns mock assessments without token", async () => {
    const ass = await fetchAssessments();
    expect(ass.length).toBeGreaterThan(0);
    expect(ass[0].scorePct).toBeGreaterThan(0);
  });

  test("normalises template.name alias", async () => {
    setAcademyToken("tok");
    mockFetch({
      ok: true,
      data: [
        {
          id: "ass-srv",
          template: { name: "Agility Test" },
          playerName: "Player A",
          playerCode: "OFA-A",
          batchName: "Elite Batch",
          assessedDate: "2026-10-10",
          conductedBy: "Coach X",
          scorePct: 90,
          metrics: [{ name: "Speed", score: 9, maxScore: 10 }],
        },
      ],
    });
    const ass = await fetchAssessments();
    expect(ass[0].templateName).toBe("Agility Test");
  });
});

// ─── fetchReportsData ─────────────────────────────────────────────────────────

describe("fetchReportsData", () => {
  test("returns fallback data without token", async () => {
    const data = await fetchReportsData();
    expect(data.attendance.totalSessions).toBeGreaterThan(0);
    expect(data.finance.totalPaidCents).toBeGreaterThan(0);
    expect(data.finance.collectionRatePct).toBeGreaterThan(0);
  });

  test("calculates collectionRatePct from server totals", async () => {
    setAcademyToken("tok");
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              summary: {
                totalSessions: 10,
                totalMarks: 100,
                presentCount: 90,
                attendanceRate: 90.0,
              },
            },
          }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              summary: {
                totalInvoiced: 1000000,
                totalCollected: 800000,
                totalOutstanding: 200000,
                defaultersCount: 2,
              },
            },
          }),
      } as unknown as Response);

    const data = await fetchReportsData();
    expect(data.attendance.totalSessions).toBe(10);
    expect(data.finance.totalPaidCents).toBe(800000);
    expect(data.finance.collectionRatePct).toBeCloseTo(80, 1);
    expect(data.finance.defaultersCount).toBe(2);
  });

  test("falls back gracefully on partial failure", async () => {
    setAcademyToken("tok");
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));
    const data = await fetchReportsData();
    expect(data.attendance.attendanceRatePct).toBeGreaterThan(0);
  });
});

describe("normalizeToYyyyMmDd & uploadPhoto", () => {
  test("normalizes various date representations to YYYY-MM-DD", () => {
    expect(normalizeToYyyyMmDd("12-Oct-2026")).toBe("2026-10-12");
    expect(normalizeToYyyyMmDd("13/10/2026")).toBe("2026-10-13");
    expect(normalizeToYyyyMmDd("13-10-2026")).toBe("2026-10-13");
    expect(normalizeToYyyyMmDd("2026-10-13")).toBe("2026-10-13");
    expect(normalizeToYyyyMmDd("2026-10-13T10:00:00.000Z")).toBe("2026-10-13");
    expect(normalizeToYyyyMmDd(null, "2026-10-13")).toBe("2026-10-13");
  });

  test("uploadPhoto falls back to local uri when offline or token is null", async () => {
    setAcademyToken(null);
    const res = await uploadPhoto({ uri: "file:///local/photo.jpg" });
    expect(res.ok).toBe(true);
    expect(res.url).toBe("file:///local/photo.jpg");
  });

  test("uploadPhoto calls /api/upload and returns URL when live", async () => {
    setAcademyToken("tok");
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          data: { url: "/uploads/photo_123.jpg" },
        }),
    } as unknown as Response);

    const res = await uploadPhoto({
      uri: "file:///local/photo.jpg",
      base64: "base64data",
      name: "player.jpg",
    });
    expect(res.ok).toBe(true);
    expect(res.url).toContain("/uploads/photo_123.jpg");
  });
});

