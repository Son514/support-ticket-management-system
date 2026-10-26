import { describe, expect, it } from "vitest";

import {
  ticketSchema,
  validateAttachment,
  MAX_ATTACHMENT_BYTES,
} from "./ticket-schema";

describe("ticketSchema", () => {
  const validTicket = {
    title: "Cannot log in",
    description:
      "I enter my email and password but the page reloads without signing in.",
    category: "technical",
    priority: "high",
  };

  it("accepts and trims valid input", () => {
    const parsed = ticketSchema.parse({
      ...validTicket,
      title: "  Cannot log in  ",
      description: `  ${validTicket.description}  `,
    });

    expect(parsed.title).toBe("Cannot log in");
    expect(parsed.description).toBe(validTicket.description);
  });

  it("rejects a short title and description", () => {
    const result = ticketSchema.safeParse({
      ...validTicket,
      title: "Help",
      description: "Broken",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      title: ["Title must be at least 5 characters long."],
      description: ["Description must be at least 20 characters long."],
    });
  });

  it("rejects values outside the enums", () => {
    const result = ticketSchema.safeParse({
      ...validTicket,
      category: "other",
      priority: "critical",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      category: ["Choose a category."],
      priority: ["Choose a priority."],
    });
  });

  it("requires category and priority", () => {
    const result = ticketSchema.safeParse({
      title: validTicket.title,
      description: validTicket.description,
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toMatchObject({
      category: ["Choose a category."],
      priority: ["Choose a priority."],
    });
  });
});

describe("validateAttachment", () => {
  function fakeFile(name: string, type: string, size: number): File {
    return { name, type, size } as File;
  }

  it("accepts PNG, JPEG, WEBP and PDF files", () => {
    expect(
      validateAttachment(fakeFile("screen.png", "image/png", 1024)),
    ).toBeNull();
    expect(
      validateAttachment(fakeFile("photo.jpg", "image/jpeg", 1024)),
    ).toBeNull();
    expect(
      validateAttachment(fakeFile("photo.webp", "image/webp", 1024)),
    ).toBeNull();
    expect(
      validateAttachment(fakeFile("ticket.pdf", "application/pdf", 1024)),
    ).toBeNull();
  });

  it("falls back to the extension when the MIME type is missing", () => {
    expect(validateAttachment(fakeFile("ticket.pdf", "", 1024))).toBeNull();
  });

  it("rejects unsupported files", () => {
    expect(
      validateAttachment(fakeFile("payload.exe", "application/x-msdownload", 10)),
    ).toBe("Attachment must be a PNG, JPG, WEBP, or PDF file.");
  });

  it("rejects empty files", () => {
    expect(validateAttachment(fakeFile("empty.png", "image/png", 0))).toBe(
      "The selected file is empty.",
    );
  });

  it("rejects files larger than 10 MB", () => {
    expect(
      validateAttachment(
        fakeFile("large.pdf", "application/pdf", MAX_ATTACHMENT_BYTES + 1),
      ),
    ).toBe("Attachment must be 10 MB or smaller.");
  });
});
