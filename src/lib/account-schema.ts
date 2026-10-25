import { z } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const accountSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Please enter your full name.")
      .max(100, "Name must be 100 characters or fewer."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Please enter your email address.")
      .max(254, "Email must be 254 characters or fewer.")
      .refine(
        (value) => value === "" || EMAIL_PATTERN.test(value),
        "Please enter a valid email address.",
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .max(128, "Password must be 128 characters or fewer."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .superRefine((values, ctx) => {
    if (values.confirmPassword && values.confirmPassword !== values.password) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export type AccountInput = z.infer<typeof accountSchema>;

export type AccountField = keyof AccountInput;
