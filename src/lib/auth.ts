import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";

export type AccountRole = "customer" | "agent" | "admin";

const ROLE_DESTINATIONS: Record<AccountRole, string> = {
  customer: "/dashboard",
  agent: "/agent",
  admin: "/admin",
};

export function destinationForRole(role: string): string {
  return ROLE_DESTINATIONS[role as AccountRole] ?? "/dashboard";
}

export async function getCurrentAccount() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return db.orm.public.Account
    .select("id", "name", "email", "role", "authVersion")
    .where({ id: session.accountId })
    .first()
    .then((account) => {
      if (!account || account.authVersion !== session.version) {
        return null;
      }

      return account;
    });
}

export async function requireRole(role: AccountRole) {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  if (account.role !== role) {
    redirect(destinationForRole(account.role));
  }

  return account;
}
