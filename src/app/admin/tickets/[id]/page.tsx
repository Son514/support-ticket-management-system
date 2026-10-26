import { notFound } from "next/navigation";

import {
  getTicketById,
  listTicketAttachments,
} from "@/app/server/ticket";
import { DashboardShell } from "@/components/dashboard-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireRole } from "@/lib/auth";

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const ticketId = Number(id);

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    notFound();
  }

  const ticket = await getTicketById(ticketId);

  if (!ticket) {
    notFound();
  }

  const attachments = await listTicketAttachments(ticket.id);

  return (
    <DashboardShell
      breadcrumbs={[
        { label: "All tickets", href: "/admin" },
        { label: `Ticket #${ticket.id}` },
      ]}
    >
      <TicketDetail
        ticket={ticket}
        attachments={attachments}
        viewerRole="admin"
        backHref="/admin"
        backLabel="Back to all tickets"
        attachmentBasePath="/admin/tickets"
        canClaim={false}
      />
    </DashboardShell>
  );
}
