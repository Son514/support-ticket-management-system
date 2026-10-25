"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  accountSchema,
  loginSchema,
  type AccountField,
  type LoginField,
} from "@/lib/account-schema";
import { destinationForRole } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { db } from "@/prisma/db";

export type RegisterState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<AccountField, string>>;
};

export type LoginState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<LoginField, string>>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrors<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, string>> {
  const flattened = z.flattenError(error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const errors: Partial<Record<Field, string>> = {};

  for (const [field, messages] of Object.entries(flattened)) {
    const message = messages?.[0];

    if (message) {
      errors[field as Field] = message;
    }
  }

  return errors;
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
    return {
      status: "error",
      errors: fieldErrors<AccountField>(parsed.error),
    };
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

  redirect("/login");
}

export async function loginAccount(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors<LoginField>(parsed.error),
    };
  }

  const { email, password } = parsed.data;
  const invalidCredentials: LoginState = {
    status: "error",
    message: "Invalid email or password.",
  };

  let accountId: number | null = null;
  let accountRole = "customer";

  try {
    const account = await db.orm.public.Account.where({ email }).first();

    if (!account) {
      // Keep the response time comparable to a real verification attempt.
      await hashPassword(password);
      return invalidCredentials;
    }

    const passwordMatches = await verifyPassword(password, account.password);

    if (!passwordMatches) {
      return invalidCredentials;
    }

    accountId = account.id;
    accountRole = account.role;
  } catch (error) {
    console.error("Failed to look up account", error);

    return {
      status: "error",
      message: "Could not sign you in. Please try again.",
    };
  }

  if (accountId === null) {
    return invalidCredentials;
  }

  try {
    await createSession(accountId);
  } catch (error) {
    console.error("Failed to create session", error);

    return {
      status: "error",
      message: "Sign in is currently unavailable. Please try again later.",
    };
  }

  redirect(destinationForRole(accountRole));
}
