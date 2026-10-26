import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a salted scrypt hash", async () => {
    const stored = await hashPassword("correct horse battery staple");

    expect(stored).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("uses a different salt for each hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");

    expect(first).not.toBe(second);
  });

  it("verifies the correct password", async () => {
    const stored = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(
      true,
    );
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false);
  });

  it("rejects malformed stored values", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
    await expect(verifyPassword("anything", "nope")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt:aa:bb")).resolves.toBe(false);
  });
});
