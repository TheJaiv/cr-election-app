import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/adminAuth";

/** Returns a 401 response when the admin cookie is missing or invalid. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const store = await cookies();
  if (!verifyAdminToken(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }
  return null;
}
