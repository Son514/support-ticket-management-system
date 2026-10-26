import { agentCanViewTicket, getTicketAttachment } from "@/app/server/ticket";
import { getCurrentAccount } from "@/lib/auth";
import { attachmentResponse } from "@/lib/attachment-response";
import { attachmentFile } from "@/lib/storage";

function notFound(): Response {
  return new Response(null, { status: 404 });
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

  const file = attachmentFile(attachment.storageKey);

  if (!(await file.exists())) {
    return notFound();
  }

  return attachmentResponse(attachment, file.stream() as BodyInit);
}
