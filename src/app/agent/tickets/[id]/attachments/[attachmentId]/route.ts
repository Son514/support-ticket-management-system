import { agentCanViewTicket, getTicketAttachment } from "@/app/server/ticket";
import { getCurrentAccount } from "@/lib/auth";

function notFound(): Response {
  return new Response(null, { status: 404 });
}

function contentDisposition(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; attachmentId: string }>;
  },
) {
  const account = await getCurrentAccount();

  if (!account || account.role !== "agent") {
    return notFound();
  }

  const { id, attachmentId } = await params;
  const ticketId = Number(id);
  const parsedAttachmentId = Number(attachmentId);

  if (
    !Number.isInteger(ticketId) ||
    ticketId <= 0 ||
    !Number.isInteger(parsedAttachmentId) ||
    parsedAttachmentId <= 0
  ) {
    return notFound();
  }

  if (!(await agentCanViewTicket(account.id, ticketId))) {
    return notFound();
  }

  const attachment = await getTicketAttachment(ticketId, parsedAttachmentId);

  if (!attachment) {
    return notFound();
  }

  const bytes = Uint8Array.from(attachment.data);

  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": contentDisposition(attachment.fileName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
