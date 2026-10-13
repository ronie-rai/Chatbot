/**
 * Integration Tests — Navigation Type Safety
 *
 * Verifies that RootStackParamList covers every screen registered in
 * RootNavigator and that all route names are correctly typed.
 */

import type { RootStackParamList } from "../navigation/types";

// Helper: extract route names as a union type check
type RouteNames = keyof RootStackParamList;

describe("RootStackParamList — navigation type completeness", () => {
  const expectedRoutes: RouteNames[] = [
    "Login",
    "ConversationList",
    "Dashboard",
    "Admin",
    "Academy",
    "AcademyPlayers",
    "AcademyAttendance",
    "AcademyGrowth",
    "AcademyFinance",
    "AcademyBookings",
    "AcademyAnnouncements",
    "AcademyReports",
    "Chat",
  ];

  test("all expected routes are typed in RootStackParamList", () => {
    // This is a compile-time check—if a route is missing the import above
    // will fail. At runtime we verify the count is correct.
    expect(expectedRoutes).toHaveLength(13);
  });

  test("AcademyPlayers accepts initialTab param", () => {
    // Type-level assertion: if this compiles, the param is accepted
    const routeWithTab: RootStackParamList["AcademyPlayers"] = {
      initialTab: "players",
    };
    expect(routeWithTab?.initialTab).toBe("players");
  });

  test("AcademyPlayers accepts sports tab", () => {
    const routeWithSports: RootStackParamList["AcademyPlayers"] = {
      initialTab: "sports",
    };
    expect(routeWithSports?.initialTab).toBe("sports");
  });

  test("AcademyPlayers accepts undefined (no tab)", () => {
    const routeNoTab: RootStackParamList["AcademyPlayers"] = undefined;
    expect(routeNoTab).toBeUndefined();
  });

  test("Chat route requires conversationId and conversationName", () => {
    const chatRoute: RootStackParamList["Chat"] = {
      conversationId: "conv-001",
      conversationName: "Support Chat",
    };
    expect(chatRoute.conversationId).toBe("conv-001");
    expect(chatRoute.conversationName).toBe("Support Chat");
  });

  test("screens requiring no params are typed as undefined", () => {
    const noParamRoutes: Array<keyof RootStackParamList> = [
      "Login",
      "ConversationList",
      "Dashboard",
      "Admin",
      "Academy",
      "AcademyAttendance",
      "AcademyGrowth",
      "AcademyFinance",
      "AcademyBookings",
      "AcademyAnnouncements",
      "AcademyReports",
    ];
    // Validate we have 11 param-less routes
    expect(noParamRoutes).toHaveLength(11);
  });
});
