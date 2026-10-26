import { claimTicket, listAgentQueue } from "@/app/server/ticket";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type TicketPriority,
} from "@/lib/ticket-schema";

type AgentTicket = Awaited<
  ReturnType<typeof listAgentQueue>
>["unassigned"][number];

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function priorityVariant(
  priority: TicketPriority,
): "default" | "secondary" | "outline" | "destructive" {
  switch (priority) {
    case "urgent":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function TicketCard({
  ticket,
  canClaim,
}: {
  ticket: AgentTicket;
  canClaim: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="font-medium leading-snug">
              <Link
                href={`/agent/tickets/${ticket.id}`}
                className="underline-offset-4 hover:underline"
              >
                {ticket.title}
              </Link>
            </h3>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {ticket.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={priorityVariant(ticket.priority)}>
              {TICKET_PRIORITY_LABELS[ticket.priority]}
            </Badge>
            <Badge variant="outline">
              {TICKET_STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{TICKET_CATEGORY_LABELS[ticket.category]}</span>
            <span aria-hidden="true">·</span>
            <span>
              {ticket.account
                ? `${ticket.account.name} (${ticket.account.email})`
                : "Unknown requester"}
            </span>
            <span aria-hidden="true">·</span>
            <span>Opened {formatDate(ticket.createdAt)}</span>
          </div>
          {canClaim ? (
            <form action={claimTicket}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Button type="submit" size="sm">
                Claim ticket
              </Button>
            </form>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AgentDashboardPage() {
  const agent = await requireRole("agent");
  const { unassigned, assigned } = await listAgentQueue(agent.id);

  return (
    <DashboardShell breadcrumbs={[{ label: "Agent queue" }]}>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">Ticket queue</h1>
          <p className="text-sm text-muted-foreground">
            Unassigned tickets and tickets currently assigned to you.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {unassigned.length} unassigned · {assigned.length} assigned to you
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Unassigned</h2>
          <Badge variant="secondary">{unassigned.length}</Badge>
        </div>
        {unassigned.length === 0 ? (
          <Card size="sm">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No unassigned tickets right now.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {unassigned.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard ticket={ticket} canClaim />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Assigned to you</h2>
          <Badge variant="secondary">{assigned.length}</Badge>
        </div>
        {assigned.length === 0 ? (
          <Card size="sm">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nothing is assigned to you right now.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {assigned.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard ticket={ticket} canClaim={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}
