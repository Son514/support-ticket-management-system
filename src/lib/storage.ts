import { randomUUID } from "node:crypto";

import service from "../../service.ts";

type StorageConfig = {
  url: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const REQUIRED_ENV = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

function storageConfig(): StorageConfig {
  try {
    const deps = service.load() as { attachments?: StorageConfig };

    if (deps.attachments) {
      return deps.attachments;
    }
  } catch {
    // Not running inside a Composer service; fall back to env for direct dev.
  }

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Attachment storage is not configured (missing ${missing.join(", ")}).`,
    );
  }

  return {
    url: process.env.S3_ENDPOINT!,
    bucket: process.env.S3_BUCKET!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  };
}

function s3(): Bun.S3Client {
  if (typeof Bun === "undefined" || !Bun.S3Client) {
    throw new Error(
      "Attachment storage requires the Bun runtime with Bun.S3Client available.",
    );
  }

  const config = storageConfig();

  return new Bun.S3Client({
    endpoint: config.url,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: process.env.S3_REGION ?? "us-east-1",
  });
}

export function buildAttachmentStorageKey(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const safeExtension = /^[a-z0-9]{1,10}$/.test(extension)
    ? `.${extension}`
    : "";

  return `tickets/${randomUUID()}${safeExtension}`;
}

export async function uploadAttachment(
  key: string,
  data: Uint8Array,
): Promise<void> {
  await s3().write(key, data);
}

export async function deleteAttachments(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  const client = s3();

  await Promise.all(
    keys.map(async (key) => {
      try {
        await client.delete(key);
      } catch (error) {
        console.error(`Failed to delete attachment object ${key}`, error);
      }
    }),
  );
}

export function attachmentFile(key: string) {
  return s3().file(key);
}
