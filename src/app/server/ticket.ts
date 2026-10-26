"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, or } from "@prisma/orm-postgres/orm-client";

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

const PRIORITY_ORDER: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function listAgentQueue(agentId: number) {
  const tickets = await db.orm.public.Ticket.where((ticket) =>
    and(
      or(ticket.assigneeId.isNull(), ticket.assigneeId.eq(agentId)),
      ticket.status.in(["open", "in_progress"]),
    ),
  )
    .select(
      "id",
      "title",
      "description",
      "category",
      "priority",
      "status",
      "assigneeId",
      "createdAt",
    )
    .include("account", (account) => account.select("name", "email"))
    .all();

  const sorted = [...tickets].sort((left, right) => {
    const byPriority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];

    if (byPriority !== 0) {
      return byPriority;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  return {
    unassigned: sorted.filter((ticket) => ticket.assigneeId === null),
    assigned: sorted.filter((ticket) => ticket.assigneeId === agentId),
  };
}

export async function claimTicket(formData: FormData): Promise<void> {
  const agent = await requireRole("agent");
  const rawTicketId = formData.get("ticketId");
  const ticketId =
    typeof rawTicketId === "string" ? Number(rawTicketId) : Number.NaN;

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    redirect("/agent");
  }

  await db.orm.public.Ticket.where((ticket) =>
    and(
      ticket.id.eq(ticketId),
      ticket.assigneeId.isNull(),
      ticket.status.in(["open", "in_progress"]),
    ),
  ).update({ assigneeId: agent.id, status: "in_progress" });

  revalidatePath("/agent");
  redirect("/agent");
}

export async function agentCanViewTicket(
  agentId: number,
  ticketId: number,
): Promise<boolean> {
  const ticket = await db.orm.public.Ticket.where((ticket) =>
    and(
      ticket.id.eq(ticketId),
      or(
        ticket.assigneeId.eq(agentId),
        and(
          ticket.assigneeId.isNull(),
          ticket.status.in(["open", "in_progress"]),
        ),
      ),
    ),
  )
    .select("id")
    .first();

  return ticket !== null;
}

export async function getAgentTicket(agentId: number, ticketId: number) {
  return db.orm.public.Ticket.where((ticket) =>
    and(
      ticket.id.eq(ticketId),
      or(
        ticket.assigneeId.eq(agentId),
        and(
          ticket.assigneeId.isNull(),
          ticket.status.in(["open", "in_progress"]),
        ),
      ),
    ),
  )
    .select(
      "id",
      "title",
      "description",
      "category",
      "priority",
      "status",
      "assigneeId",
      "createdAt",
      "updatedAt",
    )
    .include("account", (account) => account.select("name", "email"))
    .first();
}

export async function listTicketAttachments(ticketId: number) {
  return db.orm.public.TicketAttachment.where({ ticketId })
    .select("id", "fileName", "contentType", "size")
    .orderBy((attachment) => attachment.id.asc())
    .all();
}

export async function getTicketAttachment(
  ticketId: number,
  attachmentId: number,
) {
  return db.orm.public.TicketAttachment.where({
    id: attachmentId,
    ticketId,
  })
    .select("id", "fileName", "contentType", "size", "data")
    .first();
}
