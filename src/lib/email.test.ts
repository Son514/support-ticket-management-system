import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({ createTransport: mocks.createTransport }));

import { buildPasswordResetUrl, sendPasswordResetEmail } from "./email";

describe("buildPasswordResetUrl", () => {
  it("builds the link from APP_URL", () => {
    vi.stubEnv("APP_URL", "https://support.example.com");

    expect(buildPasswordResetUrl("abc123")).toBe(
      "https://support.example.com/reset-password?token=abc123",
    );
  });

  it("falls back to localhost outside production", () => {
    expect(buildPasswordResetUrl("abc123")).toBe(
      "http://localhost:3000/reset-password?token=abc123",
    );
  });

  it("throws in production when APP_URL is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", undefined as never);

    expect(() => buildPasswordResetUrl("abc123")).toThrow("APP_URL is not set");
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    mocks.sendMail.mockReset();
    mocks.sendMail.mockResolvedValue({ messageId: "test" });
    mocks.createTransport.mockReset();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });

    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    vi.stubEnv("EMAIL_FROM", "");
  });

  it("logs the link instead of sending when SMTP is not configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await sendPasswordResetEmail({
      to: "user@example.com",
      name: "Jane",
      resetUrl: "http://localhost:3000/reset-password?token=abc",
    });

    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining(
        "[password-reset] Reset link for user@example.com: http://localhost:3000/reset-password?token=abc",
      ),
    );
  });

  it("sends through SMTP with escaped HTML", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "sender@example.com");
    vi.stubEnv("SMTP_PASSWORD", "app-password");
    vi.stubEnv("EMAIL_FROM", "Support <sender@example.com>");

    await sendPasswordResetEmail({
      to: "user@example.com",
      name: "<Jane & Co>",
      resetUrl: "https://example.com/reset-password?token=a&b=1",
    });

    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "sender@example.com", pass: "app-password" },
      connectionTimeout: 10_000,
    });

    const message = mocks.sendMail.mock.calls[0][0];

    expect(message).toMatchObject({
      from: "Support <sender@example.com>",
      to: "user@example.com",
      subject: "Reset your password",
    });
    expect(message.html).toContain("&lt;Jane &amp; Co&gt;");
    expect(message.html).toContain(
      "https://example.com/reset-password?token=a&amp;b=1",
    );
    expect(message.text).toContain(
      "https://example.com/reset-password?token=a&b=1",
    );
  });

  it("throws in production when SMTP is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      sendPasswordResetEmail({
        to: "user@example.com",
        name: "Jane",
        resetUrl: "https://example.com/reset-password?token=abc",
      }),
    ).rejects.toThrow("Email is not configured");
  });
});
