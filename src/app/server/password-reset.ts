"use server";

import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  type RequestPasswordResetField,
  type ResetPasswordField,
} from "@/lib/account-schema";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "@/lib/email";
import { fieldErrors } from "@/lib/field-errors";
import {
  createPasswordResetToken,
  resetAccountPassword,
} from "@/lib/password-reset";
import { db } from "@/prisma/db";

const GENERIC_REQUEST_MESSAGE =
  "If an account exists for that email, we've sent a password reset link.";

const INVALID_TOKEN_MESSAGE = "This reset link is invalid or has expired.";

export type RequestPasswordResetState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<RequestPasswordResetField, string>>;
};

export type ResetPasswordState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<ResetPasswordField, string>>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function requestPasswordReset(
  _previousState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: text(formData, "email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors<RequestPasswordResetField>(parsed.error),
    };
  }

  try {
    const account = await db.orm.public.Account.where({
      email: parsed.data.email,
    })
      .select("id", "name", "email")
      .first();

    if (account) {
      const token = await createPasswordResetToken(account.id);
      const resetUrl = buildPasswordResetUrl(token);

      try {
        await sendPasswordResetEmail({
          to: account.email,
          name: account.name,
          resetUrl,
        });
      } catch (error) {
        console.error("Failed to send password reset email", error);
      }
    }
  } catch (error) {
    console.error("Failed to request password reset", error);
  }

  return { status: "success", message: GENERIC_REQUEST_MESSAGE };
}

export async function resetPassword(
  _previousState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: text(formData, "token"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors<ResetPasswordField>(parsed.error),
    };
  }

  try {
    const updated = await resetAccountPassword(
      parsed.data.token,
      parsed.data.password,
    );

    if (!updated) {
      return { status: "error", message: INVALID_TOKEN_MESSAGE };
    }

    return { status: "success" };
  } catch (error) {
    console.error("Failed to reset password", error);

    return {
      status: "error",
      message: "Could not reset your password. Please try again.",
    };
  }
}
