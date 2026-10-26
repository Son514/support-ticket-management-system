import Link from "next/link";
import {
  ArrowLeftIcon,
  DownloadIcon,
  PaperclipIcon,
} from "lucide-react";

import type { getTicketById, listTicketAttachments } from "@/app/server/ticket";
import { claimTicket } from "@/app/server/ticket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type TicketPriority,
} from "@/lib/ticket-schema";

type TicketDetail = NonNullable<
  Awaited<ReturnType<typeof getTicketById>>
>;
type TicketAttachment = Awaited<
  ReturnType<typeof listTicketAttachments>
>[number];

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export function TicketDetail({
  ticket,
  attachments,
  viewerRole,
  backHref,
  backLabel,
  attachmentBasePath,
  canClaim,
}: {
  ticket: TicketDetail;
  attachments: TicketAttachment[];
  viewerRole: "agent" | "admin";
  backHref: string;
  backLabel: string;
  attachmentBasePath: string;
  canClaim: boolean;
}) {
  const assignment =
    viewerRole === "admin"
      ? ticket.assignee
        ? `${ticket.assignee.name} (${ticket.assignee.email})`
        : "Unassigned"
      : ticket.assigneeId === null
        ? "Unassigned"
        : "Assigned to you";

  return (
    <>
      <div className="pt-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {backLabel}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={priorityVariant(ticket.priority)}>
              {TICKET_PRIORITY_LABELS[ticket.priority]}
            </Badge>
            <Badge variant="outline">
              {TICKET_STATUS_LABELS[ticket.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {TICKET_CATEGORY_LABELS[ticket.category]}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{ticket.title}</h1>
        </div>

        {canClaim ? (
          <form action={claimTicket}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <Button type="submit">Claim ticket</Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-medium">Description</h2>
            <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
              {ticket.description}
            </p>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card size="sm">
            <CardContent className="space-y-3 text-sm">
              <h2 className="font-medium">Details</h2>
              <dl className="grid gap-2">
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">Requester</dt>
                  <dd>
                    {ticket.account
                      ? `${ticket.account.name} (${ticket.account.email})`
                      : "Unknown requester"}
                  </dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">Assignee</dt>
                  <dd>{assignment}</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">Opened</dt>
                  <dd>{formatDate(ticket.createdAt)}</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">
                    Last updated
                  </dt>
                  <dd>{formatDate(ticket.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="space-y-3 text-sm">
              <h2 className="font-medium">
                Attachments{" "}
                {attachments.length > 0 ? `(${attachments.length})` : ""}
              </h2>
              {attachments.length === 0 ? (
                <p className="text-muted-foreground">No attachments.</p>
              ) : (
                <ul className="grid gap-2">
                  {attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{attachment.fileName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </span>
                      </span>
                      <a
                        href={`${attachmentBasePath}/${ticket.id}/attachments/${attachment.id}`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs underline underline-offset-4 hover:text-foreground"
                      >
                        <DownloadIcon className="size-3.5" />
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
