import { createHash, randomBytes } from "node:crypto";
import { Temporal } from "temporal-polyfill";

import { hashPassword } from "@/lib/password";
import { db } from "@/prisma/db";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(
  accountId: number,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordResetToken(token);

  await db.orm.public.PasswordResetToken.where({ accountId }).deleteAll();

  await db.orm.public.PasswordResetToken.create({
    tokenHash,
    accountId,
    expiresAt: Temporal.Now.instant().add({ milliseconds: TOKEN_TTL_MS }),
  });

  return token;
}

export async function resetAccountPassword(
  token: string,
  password: string,
): Promise<boolean> {
  const tokenHash = hashPasswordResetToken(token);
  const record = await db.orm.public.PasswordResetToken.where({
    tokenHash,
  }).first();

  if (!record) {
    return false;
  }

  if (Temporal.Instant.compare(record.expiresAt, Temporal.Now.instant()) <= 0) {
    await db.orm.public.PasswordResetToken.where({ id: record.id }).delete();
    return false;
  }

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    const account = await tx.orm.public.Account.where({ id: record.accountId })
      .select("id", "authVersion")
      .first();

    if (!account) {
      throw new Error("Account no longer exists.");
    }

    await tx.orm.public.Account.where({ id: account.id }).update({
      password: passwordHash,
      authVersion: account.authVersion + 1,
    });

    await tx.orm.public.PasswordResetToken.where({
      accountId: account.id,
    }).deleteAll();
  });

  return true;
}
