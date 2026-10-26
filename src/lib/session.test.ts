import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  cookies: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { createSession, destroySession, getSession } from "./session";

describe("session cookies", () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.cookieSet.mockReset();
    mocks.cookieDelete.mockReset();

    mocks.cookies.mockImplementation(async () => ({
      get: (name: string) => {
        const value = mocks.store.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: (name: string, value: string, options: unknown) => {
        mocks.store.set(name, value);
        mocks.cookieSet(name, value, options);
      },
      delete: (name: string) => {
        mocks.store.delete(name);
        mocks.cookieDelete(name);
      },
    }));

    vi.stubEnv("AUTH_SECRET", "test-secret-value");
    vi.stubEnv("NODE_ENV", "test");
  });

  it("writes a signed, httpOnly cookie", async () => {
    await createSession(7, 2);

    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);

    const [name, token, options] = mocks.cookieSet.mock.calls[0];

    expect(name).toBe("auth_session");
    expect(token.split(".")).toHaveLength(2);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });
    expect(options.expires.getTime()).toBeGreaterThan(Date.now());
  });

  it("round-trips the account id and version", async () => {
    await createSession(7, 2);

    await expect(getSession()).resolves.toEqual({ accountId: 7, version: 2 });
  });

  it("rejects a tampered signature", async () => {
    await createSession(7, 2);

    const token = mocks.store.get("auth_session");
    expect(token).toBeDefined();

    if (token) {
      const last = token.at(-1);
      mocks.store.set(
        "auth_session",
        token.slice(0, -1) + (last === "A" ? "B" : "A"),
      );
    }

    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects missing and malformed cookies", async () => {
    await expect(getSession()).resolves.toBeNull();

    mocks.store.set("auth_session", "not-a-token");
    await expect(getSession()).resolves.toBeNull();

    mocks.store.set("auth_session", "payload.signature");
    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects an expired cookie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    await createSession(7, 2);

    vi.setSystemTime(new Date("2026-01-09T00:00:00Z"));

    await expect(getSession()).resolves.toBeNull();
  });

  it("deletes the cookie on sign out", async () => {
    await createSession(7, 2);
    await destroySession();

    expect(mocks.cookieDelete).toHaveBeenCalledWith("auth_session");
    await expect(getSession()).resolves.toBeNull();
  });
});
