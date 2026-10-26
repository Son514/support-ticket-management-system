import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountWhere: vi.fn(),
  accountSelect: vi.fn(),
  accountFirst: vi.fn(),
  createToken: vi.fn(),
  buildUrl: vi.fn(),
  sendEmail: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/prisma/db", () => ({
  db: {
    orm: {
      public: {
        Account: {
          where: mocks.accountWhere,
          select: mocks.accountSelect,
        },
      },
    },
  },
}));
vi.mock("@/lib/password-reset", () => ({
  createPasswordResetToken: mocks.createToken,
  resetAccountPassword: mocks.resetPassword,
}));
vi.mock("@/lib/email", () => ({
  buildPasswordResetUrl: mocks.buildUrl,
  sendPasswordResetEmail: mocks.sendEmail,
}));

import { requestPasswordReset, resetPassword } from "./password-reset";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

const genericMessage =
  "If an account exists for that email, we've sent a password reset link.";

describe("requestPasswordReset", () => {
  beforeEach(() => {
    mocks.accountWhere.mockReset();
    mocks.accountWhere.mockReturnValue({ select: mocks.accountSelect });
    mocks.accountSelect.mockReset();
    mocks.accountSelect.mockReturnValue({ first: mocks.accountFirst });
    mocks.accountFirst.mockReset();
    mocks.accountFirst.mockResolvedValue(null);
    mocks.createToken.mockReset();
    mocks.createToken.mockResolvedValue("raw-token");
    mocks.buildUrl.mockReset();
    mocks.buildUrl.mockReturnValue("https://example.com/reset-password?token=raw");
    mocks.sendEmail.mockReset();
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it("returns a field error for an invalid email", async () => {
    const state = await requestPasswordReset(
      { status: "idle" },
      formData({ email: "nope" }),
    );

    expect(state.errors?.email).toBe("Please enter a valid email address.");
    expect(mocks.accountFirst).not.toHaveBeenCalled();
  });

  it("returns the same message and sends nothing for an unknown email", async () => {
    const state = await requestPasswordReset(
      { status: "idle" },
      formData({ email: "missing@example.com" }),
    );

    expect(state).toEqual({ status: "success", message: genericMessage });
    expect(mocks.createToken).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("creates a token and sends one email for a known account", async () => {
    mocks.accountFirst.mockResolvedValue({
      id: 4,
      name: "Jane",
      email: "jane@example.com",
    });

    const state = await requestPasswordReset(
      { status: "idle" },
      formData({ email: "jane@example.com" }),
    );

    expect(state).toEqual({ status: "success", message: genericMessage });
    expect(mocks.createToken).toHaveBeenCalledWith(4);
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: "jane@example.com",
      name: "Jane",
      resetUrl: "https://example.com/reset-password?token=raw",
    });
  });

  it("stays generic when the email cannot be sent", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.accountFirst.mockResolvedValue({
      id: 4,
      name: "Jane",
      email: "jane@example.com",
    });
    mocks.sendEmail.mockRejectedValue(new Error("SMTP unavailable"));

    const state = await requestPasswordReset(
      { status: "idle" },
      formData({ email: "jane@example.com" }),
    );

    expect(state).toEqual({ status: "success", message: genericMessage });
    expect(error).toHaveBeenCalled();
  });

  it("stays generic when the lookup fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.accountFirst.mockRejectedValue(new Error("connection failed"));

    const state = await requestPasswordReset(
      { status: "idle" },
      formData({ email: "jane@example.com" }),
    );

    expect(state).toEqual({ status: "success", message: genericMessage });
    expect(error).toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    mocks.resetPassword.mockReset();
    mocks.resetPassword.mockResolvedValue(true);
  });

  it("returns field errors for an invalid payload", async () => {
    const state = await resetPassword(
      { status: "idle" },
      formData({ token: "", password: "longenough", confirmPassword: "nope" }),
    );

    expect(state.errors).toMatchObject({
      token: "This reset link is invalid or has expired.",
      confirmPassword: "Passwords do not match.",
    });
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired token", async () => {
    mocks.resetPassword.mockResolvedValue(false);

    const state = await resetPassword(
      { status: "idle" },
      formData({
        token: "expired",
        password: "longenough",
        confirmPassword: "longenough",
      }),
    );

    expect(state.message).toBe("This reset link is invalid or has expired.");
  });

  it("updates the password", async () => {
    const state = await resetPassword(
      { status: "idle" },
      formData({
        token: "valid",
        password: "longenough",
        confirmPassword: "longenough",
      }),
    );

    expect(state).toEqual({ status: "success" });
    expect(mocks.resetPassword).toHaveBeenCalledWith("valid", "longenough");
  });

  it("returns a generic message when the reset fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.resetPassword.mockRejectedValue(new Error("database down"));

    const state = await resetPassword(
      { status: "idle" },
      formData({
        token: "valid",
        password: "longenough",
        confirmPassword: "longenough",
      }),
    );

    expect(state.message).toBe(
      "Could not reset your password. Please try again.",
    );
    expect(error).toHaveBeenCalled();
  });
});
