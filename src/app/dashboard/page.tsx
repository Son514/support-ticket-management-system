import Link from "next/link";
import { PlusIcon, TicketIcon } from "lucide-react";

import { listTicketsForAccount } from "@/app/server/ticket";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type TicketPriority,
} from "@/lib/ticket-schema";

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

export default async function Page() {
  const account = await requireRole("customer");
  const tickets = await listTicketsForAccount(account.id);

  return (
    <DashboardShell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">My Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Track the requests you&apos;ve submitted to our support team.
          </p>
        </div>
        <Link href="/dashboard/tickets/new" className={buttonVariants()}>
          <PlusIcon />
          Submit a ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <TicketIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="font-medium">No tickets yet</h2>
              <p className="text-sm text-muted-foreground">
                When you submit a ticket, it will show up here.
              </p>
            </div>
            <Link
              href="/dashboard/tickets/new"
              className={buttonVariants({ variant: "outline" })}
            >
              Create your first ticket
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-medium leading-snug">
                        {ticket.title}
                      </h2>
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{TICKET_CATEGORY_LABELS[ticket.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>Opened {formatDate(ticket.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
