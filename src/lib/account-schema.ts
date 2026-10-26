import { z } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Please enter your email address.")
  .max(254, "Email must be 254 characters or fewer.")
  .refine(
    (value) => value === "" || EMAIL_PATTERN.test(value),
    "Please enter a valid email address.",
  );

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(128, "Password must be 128 characters or fewer.");

const confirmPasswordField = z
  .string()
  .min(1, "Please confirm your password.");

function checkPasswordsMatch(
  values: { password: string; confirmPassword: string },
  ctx: z.RefinementCtx,
) {
  if (values.confirmPassword && values.confirmPassword !== values.password) {
    ctx.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    });
  }
}

export const accountSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Please enter your full name.")
      .max(100, "Name must be 100 characters or fewer."),
    email: emailField,
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .superRefine(checkPasswordsMatch);

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Please enter your password."),
});

export const requestPasswordResetSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is invalid or has expired."),
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .superRefine(checkPasswordsMatch);

export type AccountInput = z.infer<typeof accountSchema>;

export type AccountField = keyof AccountInput;

export type LoginInput = z.infer<typeof loginSchema>;

export type LoginField = keyof LoginInput;

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;

export type RequestPasswordResetField = keyof RequestPasswordResetInput;

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type ResetPasswordField = keyof ResetPasswordInput;
