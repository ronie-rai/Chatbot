/**
 * Academy RBAC — pure, dependency-free permission model.
 * Backend routes call `can()` / `resolvePermissions()`; the mobile app only
 * receives the resolved list from /api/academy/me and uses it to shape navigation.
 * Hiding UI is never the security boundary — every route re-checks here.
 */

export const ACADEMY_ROLES = [
  "OWNER",
  "MANAGER",
  "COACH",
  "ACCOUNTS",
  "RECEPTION",
  "GUARDIAN",
] as const;
export type AcademyRoleName = (typeof ACADEMY_ROLES)[number];

export const ACADEMY_RESOURCES = [
  "players",
  "sports",
  "batches",
  "attendance",
  "growth",
  "fees",
  "invoices",
  "payments",
  "facilities",
  "bookings",
  "jerseys",
  "announcements",
  "notifications",
  "reports",
  "forms",
  "users",
  "permissions",
  "settings",
  "audit",
  "portal",
] as const;
export type AcademyResource = (typeof ACADEMY_RESOURCES)[number];

export const ACADEMY_ACTIONS = [
  "view",
  "create",
  "edit",
  "archive",
  "approve",
  "export",
] as const;
export type AcademyAction = (typeof ACADEMY_ACTIONS)[number];

export type PermissionKey = `${AcademyResource}:${AcademyAction}`;
type Matrix = Partial<Record<AcademyResource, readonly AcademyAction[]>>;

const ALL: readonly AcademyAction[] = ACADEMY_ACTIONS;
const VCE: readonly AcademyAction[] = ["view", "create", "edit"];
const V: readonly AcademyAction[] = ["view"];

const OPERATIONS: Matrix = {
  players: ALL,
  sports: ALL,
  batches: ALL,
  attendance: ALL,
  growth: ALL,
  facilities: ALL,
  bookings: ALL,
  jerseys: ALL,
  announcements: ALL,
  notifications: ALL,
  reports: ALL,
  forms: ALL,
};

/** Built-in defaults. Owners can revoke/grant per tenant via AcademyRolePermission. */
export const DEFAULT_PERMISSIONS: Record<AcademyRoleName, Matrix> = {
  OWNER: Object.fromEntries(ACADEMY_RESOURCES.map((r) => [r, ALL])) as Matrix,
  MANAGER: {
    ...OPERATIONS,
    fees: V,
    invoices: V,
    payments: V,
    users: V,
    settings: V,
    audit: V,
  },
  COACH: {
    players: V,
    sports: V,
    batches: V,
    attendance: VCE,
    growth: VCE,
    facilities: V,
    bookings: V,
    announcements: ["view", "create"],
    notifications: V,
  },
  ACCOUNTS: {
    players: V,
    sports: V,
    fees: ["view", "create", "edit", "export"],
    invoices: ["view", "create", "edit", "approve", "export"],
    payments: ["view", "create", "edit", "approve", "export"],
    reports: ["view", "export"],
    notifications: V,
  },
  RECEPTION: {
    players: VCE,
    sports: V,
    batches: V,
    facilities: V,
    bookings: ["view", "create", "edit", "archive"],
    jerseys: VCE,
    announcements: V,
    notifications: V,
  },
  GUARDIAN: {
    portal: V,
    notifications: V,
  },
};

export interface PermissionOverride {
  resource: string;
  action: string;
  granted: boolean;
}

export function isAcademyRole(value: unknown): value is AcademyRoleName {
  return typeof value === "string" && (ACADEMY_ROLES as readonly string[]).includes(value);
}

/**
 * Resolve the effective permission set for a role.
 * OWNER is never reduced by overrides so a tenant can't lock itself out.
 */
export function resolvePermissions(
  role: AcademyRoleName,
  overrides: readonly PermissionOverride[] = []
): Set<PermissionKey> {
  const set = new Set<PermissionKey>();
  const matrix = DEFAULT_PERMISSIONS[role];
  for (const resource of Object.keys(matrix) as AcademyResource[]) {
    for (const action of matrix[resource] ?? []) {
      set.add(`${resource}:${action}`);
    }
  }
  if (role === "OWNER") return set;

  for (const o of overrides) {
    const known =
      (ACADEMY_RESOURCES as readonly string[]).includes(o.resource) &&
      (ACADEMY_ACTIONS as readonly string[]).includes(o.action);
    if (!known) continue;
    const key = `${o.resource}:${o.action}` as PermissionKey;
    if (o.granted) set.add(key);
    else set.delete(key);
  }
  return set;
}

export function can(
  permissions: ReadonlySet<PermissionKey>,
  resource: AcademyResource,
  action: AcademyAction
): boolean {
  return permissions.has(`${resource}:${action}`);
}

/**
 * Roles an actor may assign. Only OWNER can create other OWNERs.
 */
export function canAssignRole(actorRole: AcademyRoleName, targetRole: AcademyRoleName): boolean {
  if (targetRole === "OWNER") return actorRole === "OWNER";
  return true;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface AcademyNavModule {
  id: string;
  group: "Home" | "Players" | "Sports Operations" | "Finance" | "Facilities" | "Inventory" | "Administration" | "My Family";
  title: string;
  /** Permission required to see this module. */
  requires: PermissionKey;
  /** Phase in which the module's screens ship (for honest "coming soon" labelling). */
  phase: 1 | 2 | 3 | 4 | 5 | 6;
}

export const NAV_MODULES: readonly AcademyNavModule[] = [
  { id: "players", group: "Players", title: "Players", requires: "players:view", phase: 2 },
  { id: "sports", group: "Sports Operations", title: "Sports Master", requires: "sports:view", phase: 2 },
  { id: "batches", group: "Sports Operations", title: "Batches & Schedules", requires: "batches:view", phase: 2 },
  { id: "attendance", group: "Sports Operations", title: "Attendance", requires: "attendance:view", phase: 2 },
  { id: "growth", group: "Sports Operations", title: "Growth Tracking", requires: "growth:view", phase: 4 },
  { id: "fees", group: "Finance", title: "Fee Plans", requires: "fees:view", phase: 3 },
  { id: "invoices", group: "Finance", title: "Invoices", requires: "invoices:view", phase: 3 },
  { id: "payments", group: "Finance", title: "Payments", requires: "payments:view", phase: 3 },
  { id: "facilities", group: "Facilities", title: "Courts & Turfs", requires: "facilities:view", phase: 3 },
  { id: "bookings", group: "Facilities", title: "Bookings", requires: "bookings:view", phase: 3 },
  { id: "jerseys", group: "Inventory", title: "Jerseys & Kits", requires: "jerseys:view", phase: 4 },
  { id: "announcements", group: "Home", title: "Announcements", requires: "announcements:view", phase: 5 },
  { id: "reports", group: "Administration", title: "Reports", requires: "reports:view", phase: 6 },
  { id: "forms", group: "Administration", title: "Custom Forms", requires: "forms:view", phase: 2 },
  { id: "users", group: "Administration", title: "Team & Roles", requires: "users:view", phase: 1 },
  { id: "audit", group: "Administration", title: "Audit Log", requires: "audit:view", phase: 1 },
  { id: "portal", group: "My Family", title: "My Children", requires: "portal:view", phase: 5 },
];

export function buildNavigation(permissions: ReadonlySet<PermissionKey>): AcademyNavModule[] {
  return NAV_MODULES.filter((m) => permissions.has(m.requires));
}
