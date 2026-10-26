import { beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";

const mocks = vi.hoisted(() => {
  const tokenQuery = {
    first: vi.fn(),
    deleteAll: vi.fn(),
    delete: vi.fn(),
  };
  const accountFirst = vi.fn();
  const accountQuery = {
    select: vi.fn(() => ({ first: accountFirst })),
    update: vi.fn(),
  };
  const txTokenQuery = { deleteAll: vi.fn() };

  return {
    tokenQuery,
    tokenWhere: vi.fn(),
    tokenCreate: vi.fn(),
    accountFirst,
    accountQuery,
    txTokenQuery,
    tx: {
      orm: {
        public: {
          Account: { where: vi.fn(() => accountQuery) },
          PasswordResetToken: { where: vi.fn(() => txTokenQuery) },
        },
      },
    },
    transaction: vi.fn(),
  };
});

vi.mock("@/prisma/db", () => ({
  db: {
    orm: {
      public: {
        PasswordResetToken: {
          where: mocks.tokenWhere,
          create: mocks.tokenCreate,
        },
      },
    },
    transaction: mocks.transaction,
  },
}));

import {
  createPasswordResetToken,
  hashPasswordResetToken,
  resetAccountPassword,
} from "./password-reset";

describe("hashPasswordResetToken", () => {
  it("is a deterministic SHA-256 hex digest", () => {
    const hash = hashPasswordResetToken("token-value");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPasswordResetToken("token-value")).toBe(hash);
    expect(hashPasswordResetToken("other-value")).not.toBe(hash);
  });
});

describe("createPasswordResetToken", () => {
  beforeEach(() => {
    mocks.tokenWhere.mockReturnValue(mocks.tokenQuery);
    mocks.tokenQuery.deleteAll.mockResolvedValue(undefined);
    mocks.tokenCreate.mockResolvedValue({});
  });

  it("revokes old tokens and stores only the hash", async () => {
    const token = await createPasswordResetToken(5);

    expect(token).toHaveLength(43);
    expect(mocks.tokenQuery.deleteAll).toHaveBeenCalledTimes(1);
    expect(mocks.tokenCreate).toHaveBeenCalledTimes(1);

    const created = mocks.tokenCreate.mock.calls[0][0];

    expect(created.accountId).toBe(5);
    expect(created.tokenHash).toBe(hashPasswordResetToken(token));
    expect(
      Temporal.Instant.compare(created.expiresAt, Temporal.Now.instant()),
    ).toBeGreaterThan(0);
  });
});

describe("resetAccountPassword", () => {
  beforeEach(() => {
    mocks.tokenWhere.mockReturnValue(mocks.tokenQuery);
    mocks.tokenQuery.delete.mockResolvedValue(undefined);
    mocks.tokenQuery.deleteAll.mockResolvedValue(undefined);
    mocks.accountFirst.mockResolvedValue({ id: 3, authVersion: 4 });
    mocks.accountQuery.update.mockResolvedValue({});
    mocks.txTokenQuery.deleteAll.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(mocks.tx),
    );
  });

  it("returns false for an unknown token", async () => {
    mocks.tokenQuery.first.mockResolvedValue(null);

    await expect(resetAccountPassword("missing", "longenough")).resolves.toBe(
      false,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("deletes an expired token and returns false", async () => {
    mocks.tokenQuery.first.mockResolvedValue({
      id: 1,
      accountId: 3,
      expiresAt: Temporal.Now.instant().subtract({ hours: 2 }),
    });

    await expect(resetAccountPassword("expired", "longenough")).resolves.toBe(
      false,
    );
    expect(mocks.tokenQuery.delete).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("updates the password, bumps the auth version and clears tokens", async () => {
    mocks.tokenQuery.first.mockResolvedValue({
      id: 1,
      accountId: 3,
      expiresAt: Temporal.Now.instant().add({ hours: 1 }),
    });

    await expect(resetAccountPassword("valid", "longenough")).resolves.toBe(
      true,
    );

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.accountQuery.update).toHaveBeenCalledTimes(1);

    const update = mocks.accountQuery.update.mock.calls[0][0];

    expect(update.authVersion).toBe(5);
    expect(update.password).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(mocks.txTokenQuery.deleteAll).toHaveBeenCalledTimes(1);
  });
});
