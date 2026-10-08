import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET  /api/customers            — list/search customers
 * POST /api/customers            — create customer
 * PUT  /api/customers            — update customer (body must include id)
 * DELETE /api/customers?id=...  — delete customer
 *
 * NOTE: In-memory store for demo. Swap with Prisma CustomerProfile
 * model once added to schema (always scope by tenantId).
 */

interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  sport: string;
  membershipType: string;
  membershipStatus: string;
  joinDate: string;
  expiryDate: string | null;
  totalBookings: number;
  lastBooking: string | null;
  age: number | null;
  gender: string | null;
  coach: string | null;
  emergencyContact: string | null;
  notes: string | null;
  loginId: string;
  role: "CUSTOMER" | "EMPLOYEE";
  createdBy: string;
}

// Shared in-memory store (dev-friendly; replace with DB in production)
const customerStore: CustomerProfile[] = [];

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const sport = searchParams.get("sport") || "";
    const status = searchParams.get("status") || "";
    const membershipType = searchParams.get("membershipType") || "";

    let list = [...customerStore];
    if (search) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.phone.includes(search) ||
          c.loginId.toLowerCase().includes(search)
      );
    }
    if (sport) list = list.filter((c) => c.sport === sport);
    if (status) list = list.filter((c) => c.membershipStatus === status);
    if (membershipType) list = list.filter((c) => c.membershipType === membershipType);

    return NextResponse.json({ ok: true, data: list });
  } catch (err) {
    console.error("[GET /api/customers]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch customers" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CustomerProfile;
    if (!body.name || !body.loginId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "name and loginId are required" } },
        { status: 400 }
      );
    }
    const customer: CustomerProfile = {
      ...body,
      id: body.id || `cust-${Date.now()}`,
      totalBookings: body.totalBookings ?? 0,
      lastBooking: body.lastBooking ?? null,
      createdBy: body.createdBy || "web-admin",
    };
    customerStore.push(customer);
    return NextResponse.json({ ok: true, data: customer }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/customers]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to create customer" } },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CustomerProfile;
    if (!body.id) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_ID", message: "id is required for update" } },
        { status: 400 }
      );
    }
    const idx = customerStore.findIndex((c) => c.id === body.id);
    if (idx === -1) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Customer not found" } },
        { status: 404 }
      );
    }
    customerStore[idx] = { ...customerStore[idx], ...body };
    return NextResponse.json({ ok: true, data: customerStore[idx] });
  } catch (err) {
    console.error("[PUT /api/customers]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to update customer" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_ID", message: "id query param is required" } },
        { status: 400 }
      );
    }
    const idx = customerStore.findIndex((c) => c.id === id);
    if (idx !== -1) customerStore.splice(idx, 1);
    return NextResponse.json({ ok: true, data: { deleted: id } });
  } catch (err) {
    console.error("[DELETE /api/customers]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete customer" } },
      { status: 500 }
    );
  }
}
