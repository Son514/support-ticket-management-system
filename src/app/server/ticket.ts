"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { fieldErrors } from "@/lib/field-errors";
import {
  resolveAttachmentContentType,
  ticketSchema,
  validateAttachments,
  type TicketPriority,
  type TicketCategory,
} from "@/lib/ticket-schema";
import { db } from "@/prisma/db";

export type TicketField =
  | "title"
  | "description"
  | "category"
  | "priority"
  | "attachments";

export type CreateTicketState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<TicketField, string>>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createTicket(
  _previousState: CreateTicketState,
  formData: FormData,
): Promise<CreateTicketState> {
  const account = await requireRole("customer");

  const parsed = ticketSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    category: text(formData, "category"),
    priority: text(formData, "priority"),
  });

  const errors: Partial<Record<TicketField, string>> = parsed.success
    ? {}
    : fieldErrors<TicketField>(parsed.error);

  const entries = formData.getAll("attachments");
  const attachments = entries.filter(
    (entry): entry is File => entry instanceof File,
  );
  const { valid: validAttachments, error: attachmentsError } =
    await validateAttachments(attachments);

  if (attachmentsError) {
    errors.attachments = attachmentsError;
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { status: "error", errors };
  }

  const { title, description } = parsed.data;
  const category = parsed.data.category as TicketCategory;
  const priority = parsed.data.priority as TicketPriority;

  try {
    await db.transaction(async (tx) => {
      const ticket = await tx.orm.public.Ticket.select("id").create({
        title,
        description,
        category,
        priority,
        status: "open",
        accountId: account.id,
      });

      for (const attachment of validAttachments) {
        const data = new Uint8Array(await attachment.arrayBuffer());

        await tx.orm.public.TicketAttachment.create({
          ticketId: ticket.id,
          fileName: attachment.name,
          contentType: resolveAttachmentContentType(attachment),
          size: attachment.size,
          data,
        });
      }
    });
  } catch (error) {
    console.error("Failed to create ticket", error);

    return {
      status: "error",
      message: "Could not create your ticket. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function listTicketsForAccount(
  accountId: number,
  category?: TicketCategory,
) {
  const where = category ? { accountId, category } : { accountId };

  return db.orm.public.Ticket.where(where)
    .select(
      "id",
      "title",
      "description",
      "category",
      "priority",
      "status",
      "createdAt",
    )
    .orderBy((ticket) => ticket.createdAt.desc())
    .all();
}
