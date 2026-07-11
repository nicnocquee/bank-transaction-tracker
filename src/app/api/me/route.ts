import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

/**
 * Returns the authenticated session user (for client checks / e2e).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.user.id, email: session.user.email },
  });
}
