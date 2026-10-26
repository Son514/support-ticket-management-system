function contentDisposition(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function attachmentResponse(attachment: {
  fileName: string;
  contentType: string;
  size: number;
  data: Uint8Array;
}): Response {
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
