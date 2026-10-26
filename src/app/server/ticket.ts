"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { fieldErrors } from "@/lib/field-errors";
import {
  ticketSchema,
  validateAttachment,
  type TicketPriority,
  type TicketCategory,
} from "@/lib/ticket-schema";
import { db } from "@/prisma/db";

export type TicketField =
  | "title"
  | "description"
  | "category"
  | "priority"
  | "attachment";

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

  const entry = formData.get("attachment");
  const attachment =
    entry instanceof File && entry.size > 0 ? entry : null;

  if (attachment) {
    const attachmentError = validateAttachment(attachment);

    if (attachmentError) {
      errors.attachment = attachmentError;
    }
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

      if (attachment) {
        const data = new Uint8Array(await attachment.arrayBuffer());

        await tx.orm.public.TicketAttachment.create({
          ticketId: ticket.id,
          fileName: attachment.name,
          contentType: attachment.type || "application/octet-stream",
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

export async function listTicketsForAccount(accountId: number) {
  return db.orm.public.Ticket.where({ accountId })
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
