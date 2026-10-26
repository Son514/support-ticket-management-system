import { z } from "zod";

export const TICKET_CATEGORIES = [
  "technical",
  "billing",
  "account",
  "general",
] as const;

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const MAX_ATTACHMENTS = 5;

export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const ACCEPTED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
] as const;

type AttachmentKind = "png" | "jpeg" | "pdf";

const ATTACHMENT_KIND_BY_TYPE: Record<string, AttachmentKind> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "application/pdf": "pdf",
};

const ATTACHMENT_KIND_BY_EXTENSION: Record<string, AttachmentKind> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  pdf: "pdf",
};

const ATTACHMENT_SIGNATURES: Record<AttachmentKind, readonly number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
};

const ATTACHMENT_CONTENT_TYPES: Record<AttachmentKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

function attachmentKind(file: File): AttachmentKind | null {
  const byType = ATTACHMENT_KIND_BY_TYPE[file.type];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExtension = ATTACHMENT_KIND_BY_EXTENSION[extension];

  if (byType && byExtension && byType !== byExtension) {
    return null;
  }

  return byType ?? byExtension ?? null;
}

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  technical: "Technical",
  billing: "Billing",
  account: "Account",
  general: "General",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const ticketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters long.")
    .max(120, "Title must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters long.")
    .max(5000, "Description must be 5000 characters or fewer."),
  category: z.enum(TICKET_CATEGORIES, { message: "Choose a category." }),
  priority: z.enum(TICKET_PRIORITIES, { message: "Choose a priority." }),
});

export type TicketInput = z.infer<typeof ticketSchema>;

export async function validateAttachment(file: File): Promise<string | null> {
  if (file.size === 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "Attachments must be 5 MB or smaller.";
  }

  const kind = attachmentKind(file);

  if (!kind) {
    return "Attachment must be a PNG, JPG, or PDF file.";
  }

  try {
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const signature = ATTACHMENT_SIGNATURES[kind];
    const matches = signature.every((byte, index) => header[index] === byte);

    if (!matches) {
      return "File contents are not a valid PNG, JPG, or PDF file.";
    }
  } catch {
    return "The selected file could not be read.";
  }

  return null;
}

export async function validateAttachments(files: File[]): Promise<{
  valid: File[];
  error: string | null;
}> {
  if (files.length > MAX_ATTACHMENTS) {
    return {
      valid: [],
      error: `You can attach up to ${MAX_ATTACHMENTS} files.`,
    };
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);

  if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) {
    return { valid: [], error: "Attachments must total 20 MB or less." };
  }

  const valid: File[] = [];

  for (const file of files) {
    const error = await validateAttachment(file);

    if (error) {
      return { valid, error: `${file.name}: ${error}` };
    }

    valid.push(file);
  }

  return { valid, error: null };
}

export function resolveAttachmentContentType(file: File): string {
  const kind = attachmentKind(file);
  return kind ? ATTACHMENT_CONTENT_TYPES[kind] : "application/octet-stream";
}
