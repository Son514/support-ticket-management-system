"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { accountSchema, type AccountField } from "@/lib/account-schema";
import { hashPassword } from "@/lib/password";
import { db } from "@/prisma/db";

export type RegisterState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<AccountField, string>>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "sqlState" in error &&
    (error as { sqlState?: unknown }).sqlState === "23505"
  );
}

export async function registerAccount(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = accountSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    const errors: Partial<Record<AccountField, string>> = {};

    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];

      if (message) {
        errors[field as AccountField] = message;
      }
    }

    return { status: "error", errors };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.orm.public.Account.where({ email }).first();

  if (existing) {
    return {
      status: "error",
      errors: { email: "An account with this email already exists." },
    };
  }

  const passwordHash = await hashPassword(password);

  try {
    await db.orm.public.Account.select("id").create({
      name,
      email,
      password: passwordHash,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        errors: { email: "An account with this email already exists." },
      };
    }

    console.error("Failed to register account", error);

    return {
      status: "error",
      message: "Could not create your account. Please try again.",
    };
  }

  redirect("/");
}
