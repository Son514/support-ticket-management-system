import Link from "next/link";
import { TicketIcon } from "lucide-react";

import { listAllTickets } from "@/app/server/ticket";
import { DashboardShell } from "@/components/dashboard-shell";
import { TicketStatusFilter } from "@/components/ticket-status-filter";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
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

function statusVariant(
  status: TicketStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "in_progress":
      return "default";
    case "resolved":
      return "secondary";
    default:
      return "outline";
  }
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const requested =
    typeof params.status === "string" ? params.status : undefined;
  const status = TICKET_STATUSES.includes(requested as TicketStatus)
    ? (requested as TicketStatus)
    : undefined;
  const tickets = await listAllTickets(status);

  return (
    <DashboardShell breadcrumbs={[{ label: "All tickets" }]}>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">All tickets</h1>
          <p className="text-sm text-muted-foreground">
            Every ticket across all customers and agents.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TicketStatusFilter value={status} />
      </div>

      {tickets.length === 0 ? (
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <TicketIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="font-medium">
                {status
                  ? `No ${TICKET_STATUS_LABELS[status]} tickets`
                  : "No tickets yet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {status
                  ? "No tickets match this status filter."
                  : "Tickets submitted by customers will appear here."}
              </p>
            </div>
            {status ? (
              <Link
                href="/admin"
                className={buttonVariants({ variant: "outline" })}
              >
                Clear filter
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card size="sm" className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="max-w-64">
                      <div className="grid gap-0.5">
                        <span className="truncate font-medium">
                          {ticket.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {TICKET_CATEGORY_LABELS[ticket.category]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.account ? (
                        <div className="grid gap-0.5">
                          <span className="truncate">{ticket.account.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {ticket.account.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ticket.assignee ? (
                        <div className="grid gap-0.5">
                          <span className="truncate">
                            {ticket.assignee.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {ticket.assignee.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(ticket.priority)}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(ticket.status)}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(ticket.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
