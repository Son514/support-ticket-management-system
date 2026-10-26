import { describe, expect, it } from "vitest";

import {
  accountSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "./account-schema";

describe("accountSchema", () => {
  it("accepts valid registration input", () => {
    const result = accountSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "longenough",
      confirmPassword: "longenough",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes name and email", () => {
    const result = accountSchema.parse({
      name: "  Jane Doe  ",
      email: "  JANE@Example.COM ",
      password: "longenough",
      confirmPassword: "longenough",
    });

    expect(result.name).toBe("Jane Doe");
    expect(result.email).toBe("jane@example.com");
  });

  it("requires every field", () => {
    const result = accountSchema.safeParse({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      name: ["Please enter your full name."],
      email: ["Please enter your email address."],
      password: ["Password must be at least 8 characters long."],
      confirmPassword: ["Please confirm your password."],
    });
  });

  it("rejects a short password, invalid email and mismatch", () => {
    const result = accountSchema.safeParse({
      name: "Jane",
      email: "not-an-email",
      password: "short",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      email: ["Please enter a valid email address."],
      password: ["Password must be at least 8 characters long."],
      confirmPassword: ["Passwords do not match."],
    });
  });
});

describe("loginSchema", () => {
  it("normalizes the email and requires a password", () => {
    expect(loginSchema.parse({ email: " A@B.CO ", password: "x" })).toEqual({
      email: "a@b.co",
      password: "x",
    });

    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(
      false,
    );
  });
});

describe("requestPasswordResetSchema", () => {
  it("validates and normalizes the email", () => {
    expect(requestPasswordResetSchema.parse({ email: " A@B.CO " })).toEqual({
      email: "a@b.co",
    });
    expect(requestPasswordResetSchema.safeParse({ email: "nope" }).success).toBe(
      false,
    );
  });
});

describe("resetPasswordSchema", () => {
  it("requires a token and matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "longenough",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      token: ["This reset link is invalid or has expired."],
      confirmPassword: ["Passwords do not match."],
    });
  });

  it("accepts a valid reset payload", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "token",
        password: "longenough",
        confirmPassword: "longenough",
      }).success,
    ).toBe(true);
  });
});
