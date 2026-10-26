import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachmentFile,
  buildAttachmentStorageKey,
  deleteAttachments,
  uploadAttachment,
} from "./storage";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  file: vi.fn(),
}));

function stubStorageEnv(): void {
  vi.stubEnv("S3_ENDPOINT", "http://localhost:4302");
  vi.stubEnv("S3_BUCKET", "attachments");
  vi.stubEnv("S3_ACCESS_KEY_ID", "access-key");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret-key");
}

beforeEach(() => {
  stubStorageEnv();
  mocks.client.mockReset();
  mocks.write.mockReset();
  mocks.remove.mockReset();
  mocks.file.mockReset();
  mocks.write.mockResolvedValue(1);
  mocks.remove.mockResolvedValue(undefined);
  mocks.client.mockImplementation(function (this: unknown) {
    return {
      write: mocks.write,
      delete: mocks.remove,
      file: mocks.file,
    };
  });
  vi.stubGlobal("Bun", { S3Client: mocks.client });
});

describe("buildAttachmentStorageKey", () => {
  it("generates an unguessable key and keeps a safe extension", () => {
    expect(buildAttachmentStorageKey("Screen Shot.PNG")).toMatch(
      /^tickets\/[0-9a-f-]{36}\.png$/,
    );

    expect(buildAttachmentStorageKey("no-extension")).toMatch(
      /^tickets\/[0-9a-f-]{36}$/,
    );
  });
});

describe("attachment storage", () => {
  it("throws when storage is not configured", async () => {
    vi.stubEnv("S3_BUCKET", "");

    await expect(
      uploadAttachment("tickets/test.png", new Uint8Array([1])),
    ).rejects.toThrow("Attachment storage is not configured");
  });

  it("creates a client from the S3 env and uploads bytes", async () => {
    const data = new Uint8Array([1, 2, 3]);

    await uploadAttachment("tickets/test.png", data);

    expect(mocks.client).toHaveBeenCalledWith({
      endpoint: "http://localhost:4302",
      bucket: "attachments",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      region: "us-east-1",
    });
    expect(mocks.write).toHaveBeenCalledWith("tickets/test.png", data);
  });

  it("deletes every uploaded key", async () => {
    await deleteAttachments(["tickets/a.png", "tickets/b.pdf"]);

    expect(mocks.remove).toHaveBeenCalledTimes(2);
    expect(mocks.remove).toHaveBeenCalledWith("tickets/a.png");
    expect(mocks.remove).toHaveBeenCalledWith("tickets/b.pdf");
  });

  it("logs and continues when deleting one object fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.remove
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce(undefined);

    await deleteAttachments(["tickets/a.png", "tickets/b.pdf"]);

    expect(mocks.remove).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("opens an object for streaming", () => {
    const file = { name: "tickets/test.png" };
    mocks.file.mockReturnValue(file);

    expect(attachmentFile("tickets/test.png")).toBe(file);
    expect(mocks.file).toHaveBeenCalledWith("tickets/test.png");
  });
});
