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

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

const ACCEPTED_ATTACHMENT_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "pdf"];

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

export function validateAttachment(file: File): string | null {
  if (file.size === 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "Attachment must be 10 MB or smaller.";
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const hasAcceptedType = (
    ACCEPTED_ATTACHMENT_TYPES as readonly string[]
  ).includes(file.type);

  if (!hasAcceptedType && !ACCEPTED_ATTACHMENT_EXTENSIONS.includes(extension)) {
    return "Attachment must be a PNG, JPG, WEBP, or PDF file.";
  }

  return null;
}
