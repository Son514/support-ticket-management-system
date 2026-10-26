import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

let transport: Transporter | null = null;

function getTransport(): Transporter {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error(
      "Email is not configured: SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required.",
    );
  }

  const port = Number(process.env.SMTP_PORT ?? 465);

  transport ??= nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
  });

  return transport;
}

export function buildPasswordResetUrl(token: string): string {
  const baseUrl =
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production" ? null : "http://localhost:3000");

  if (!baseUrl) {
    throw new Error(
      "APP_URL is not set. It is required to build password reset links.",
    );
  }

  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);

  return url.toString();
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const from = process.env.EMAIL_FROM;

  if (
    !from ||
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email is not configured: EMAIL_FROM, SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required.",
      );
    }

    console.info(`[password-reset] Reset link for ${to}: ${resetUrl}`);
    return;
  }

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  await getTransport().sendMail({
    from,
    to,
    subject: "Reset your password",
    text: [
      `Hi ${name},`,
      "",
      "We received a request to reset your password.",
      `Open this link to choose a new one (valid for 1 hour): ${resetUrl}`,
      "",
      "If you didn't request this, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hi ${safeName},</p>`,
      "<p>We received a request to reset your password.</p>",
      `<p><a href="${safeUrl}">Reset your password</a> (valid for 1 hour).</p>`,
      "<p>If you didn't request this, you can ignore this email.</p>",
    ].join(""),
  });
}
