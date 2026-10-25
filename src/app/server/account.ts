"use server";

import { redirect } from "next/navigation";

import { hashPassword } from "@/lib/password";
import { db } from "@/prisma/db";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterField = "name" | "email" | "password" | "confirmPassword";

export type RegisterState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<RegisterField, string>>;
  values?: { name?: string; email?: string };
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
  const name = text(formData, "name").trim();
  const email = text(formData, "email").trim().toLowerCase();
  const password = text(formData, "password");
  const confirmPassword = text(formData, "confirmPassword");

  const errors: Partial<Record<RegisterField, string>> = {};

  if (!name) {
    errors.name = "Please enter your full name.";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  if (!email) {
    errors.email = "Please enter your email address.";
  } else if (email.length > 254) {
    errors.email = "Email must be 254 characters or fewer.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!password) {
    errors.password = "Please enter a password.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  } else if (password.length > 128) {
    errors.password = "Password must be 128 characters or fewer.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  const values = { name, email };

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  const existing = await db.orm.public.Account.where({ email }).first();

  if (existing) {
    return {
      status: "error",
      errors: { email: "An account with this email already exists." },
      values,
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
        values,
      };
    }

    console.error("Failed to register account", error);

    return {
      status: "error",
      message: "Could not create your account. Please try again.",
      values,
    };
  }

  redirect("/");
}
