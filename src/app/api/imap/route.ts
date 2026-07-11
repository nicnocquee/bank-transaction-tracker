import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/crypto/secret-box";

const imapSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(993),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(512),
  tls: z.boolean().default(true),
});

/**
 * Saves or updates the current user's IMAP connection (password encrypted at rest).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = imapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid IMAP settings" },
      { status: 400 },
    );
  }

  const passwordEncrypted = encryptSecret(parsed.data.password);
  const connection = await prisma.imapConnection.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username,
      passwordEncrypted,
      tls: parsed.data.tls,
      enabled: true,
    },
    update: {
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username,
      passwordEncrypted,
      tls: parsed.data.tls,
      enabled: true,
    },
    select: {
      id: true,
      host: true,
      port: true,
      username: true,
      tls: true,
      enabled: true,
      lastSyncedAt: true,
    },
  });

  return NextResponse.json({ connection });
}

/**
 * Returns the current user's IMAP connection metadata (never the password).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.imapConnection.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      host: true,
      port: true,
      username: true,
      tls: true,
      enabled: true,
      lastSyncedAt: true,
    },
  });

  return NextResponse.json({ connection });
}

/**
 * Deletes the current user's IMAP connection.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.imapConnection.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
