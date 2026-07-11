import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { prisma } from "@/lib/db/prisma";
import { testImapConnection } from "@/lib/email/imap-sync";

const bodySchema = z
  .object({
    host: z.string().min(1).optional(),
    port: z.number().int().optional(),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    tls: z.boolean().optional(),
  })
  .optional();

/**
 * Tests IMAP credentials (request body or saved connection).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let host = parsed.data?.host;
  let port = parsed.data?.port ?? 993;
  let username = parsed.data?.username;
  let password = parsed.data?.password;
  let tls = parsed.data?.tls ?? true;

  if (!host || !username || !password) {
    const saved = await prisma.imapConnection.findUnique({
      where: { userId: session.user.id },
    });
    if (!saved) {
      return NextResponse.json(
        { error: "No IMAP connection configured" },
        { status: 400 },
      );
    }
    host = host ?? saved.host;
    port = parsed.data?.port ?? saved.port;
    username = username ?? saved.username;
    password = password ?? decryptSecret(saved.passwordEncrypted);
    tls = parsed.data?.tls ?? saved.tls;
  }

  const result = await testImapConnection({
    host,
    port,
    username,
    password,
    tls,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
