import { describe, expect, it, vi } from "vitest";

vi.mock("@/prisma/db", () => ({ db: {} }));

import { destinationForRole } from "./auth";

describe("destinationForRole", () => {
  it.each([
    ["customer", "/dashboard"],
    ["agent", "/agent"],
    ["admin", "/admin"],
  ])("sends %s to %s", (role, destination) => {
    expect(destinationForRole(role)).toBe(destination);
  });

  it("falls back to the customer dashboard for unknown roles", () => {
    expect(destinationForRole("superuser")).toBe("/dashboard");
  });
});
