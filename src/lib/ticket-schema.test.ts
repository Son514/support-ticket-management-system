import { describe, expect, it } from "vitest";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_TOTAL_ATTACHMENT_BYTES,
  resolveAttachmentContentType,
  ticketSchema,
  validateAttachment,
  validateAttachments,
} from "./ticket-schema";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];

function fileWith(
  name: string,
  type: string,
  bytes: number[] = [],
  size = bytes.length,
): File {
  return {
    name,
    type,
    size,
    lastModified: 1,
    slice: () => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer }),
  } as unknown as File;
}

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
  it("accepts valid PNG, JPEG and PDF files", async () => {
    await expect(
      validateAttachment(fileWith("screen.png", "image/png", PNG_HEADER)),
    ).resolves.toBeNull();
    await expect(
      validateAttachment(fileWith("photo.jpg", "image/jpeg", JPEG_HEADER)),
    ).resolves.toBeNull();
    await expect(
      validateAttachment(fileWith("ticket.pdf", "application/pdf", PDF_HEADER)),
    ).resolves.toBeNull();
  });

  it("falls back to the extension when the MIME type is missing", async () => {
    await expect(
      validateAttachment(fileWith("ticket.pdf", "", PDF_HEADER)),
    ).resolves.toBeNull();
  });

  it("rejects WEBP and unsupported files", async () => {
    await expect(
      validateAttachment(fileWith("photo.webp", "image/webp", [0x52, 0x49])),
    ).resolves.toBe("Attachment must be a PNG, JPG, or PDF file.");
    await expect(
      validateAttachment(
        fileWith("payload.exe", "application/x-msdownload", [0x4d, 0x5a]),
      ),
    ).resolves.toBe("Attachment must be a PNG, JPG, or PDF file.");
  });

  it("rejects a file whose contents do not match its type", async () => {
    await expect(
      validateAttachment(
        fileWith("fake.png", "image/png", JPEG_HEADER),
      ),
    ).resolves.toBe("File contents are not a valid PNG, JPG, or PDF file.");
  });

  it("rejects a mismatched extension and MIME type", async () => {
    await expect(
      validateAttachment(
        fileWith("mismatch.png", "application/pdf", PNG_HEADER),
      ),
    ).resolves.toBe("Attachment must be a PNG, JPG, or PDF file.");
  });

  it("rejects empty files", async () => {
    await expect(
      validateAttachment(fileWith("empty.png", "image/png")),
    ).resolves.toBe("The selected file is empty.");
  });

  it("rejects files larger than 5 MB", async () => {
    await expect(
      validateAttachment(
        fileWith("large.pdf", "application/pdf", PDF_HEADER, MAX_ATTACHMENT_BYTES + 1),
      ),
    ).resolves.toBe("Attachments must be 5 MB or smaller.");
  });
});

describe("validateAttachments", () => {
  it("accepts an empty selection", async () => {
    await expect(validateAttachments([])).resolves.toEqual({
      valid: [],
      error: null,
    });
  });

  it("rejects more than five files", async () => {
    const files = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, index) =>
      fileWith(`file-${index}.png`, "image/png", PNG_HEADER),
    );

    const result = await validateAttachments(files);

    expect(result.valid).toEqual([]);
    expect(result.error).toBe("You can attach up to 5 files.");
  });

  it("rejects more than 20 MB in total", async () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      fileWith(
        `file-${index}.pdf`,
        "application/pdf",
        PDF_HEADER,
        MAX_ATTACHMENT_BYTES,
      ),
    );

    const result = await validateAttachments(files);

    expect(result.valid).toEqual([]);
    expect(result.error).toBe("Attachments must total 20 MB or less.");
    expect(MAX_TOTAL_ATTACHMENT_BYTES).toBe(20 * 1024 * 1024);
  });

  it("returns the valid subset and the first error", async () => {
    const good = fileWith("screen.png", "image/png", PNG_HEADER);
    const bad = fileWith(
      "payload.exe",
      "application/x-msdownload",
      [0x4d, 0x5a],
    );

    const result = await validateAttachments([good, bad]);

    expect(result.valid).toEqual([good]);
    expect(result.error).toBe(
      "payload.exe: Attachment must be a PNG, JPG, or PDF file.",
    );
  });
});

describe("resolveAttachmentContentType", () => {
  it("derives the content type from the extension when missing", () => {
    expect(resolveAttachmentContentType(fileWith("ticket.pdf", ""))).toBe(
      "application/pdf",
    );
  });
});
