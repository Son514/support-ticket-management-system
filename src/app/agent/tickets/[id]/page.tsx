import { notFound } from "next/navigation";

import {
  getAgentTicket,
  listTicketAttachments,
} from "@/app/server/ticket";
import { DashboardShell } from "@/components/dashboard-shell";
import { TicketDetail } from "@/components/ticket-detail";
import { requireRole } from "@/lib/auth";

export default async function AgentTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const agent = await requireRole("agent");
  const { id } = await params;
  const ticketId = Number(id);

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    notFound();
  }

  const ticket = await getAgentTicket(agent.id, ticketId);

  if (!ticket) {
    notFound();
  }

  const attachments = await listTicketAttachments(ticket.id);

  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Agent queue", href: "/agent" },
        { label: `Ticket #${ticket.id}` },
      ]}
    >
      <TicketDetail
        ticket={ticket}
        attachments={attachments}
        viewerRole="agent"
        backHref="/agent"
        backLabel="Back to queue"
        attachmentBasePath="/agent/tickets"
        canClaim={ticket.assigneeId === null}
      />
    </DashboardShell>
  );
}
