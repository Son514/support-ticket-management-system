import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldErrors } from "./field-errors";

const schema = z.object({
  email: z
    .string()
    .min(1, "Please enter your email address.")
    .max(5, "Email is too long."),
  name: z.string().min(1, "Please enter your full name."),
});

describe("fieldErrors", () => {
  it("returns the first message for each invalid field", () => {
    const result = schema.safeParse({ email: "", name: "" });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(fieldErrors<"email" | "name">(result.error)).toEqual({
        email: "Please enter your email address.",
        name: "Please enter your full name.",
      });
    }
  });

  it("ignores issues that are not attached to a field", () => {
    const error = new z.ZodError([
      { code: "custom", message: "Form-level problem", path: [] } as never,
    ]);

    expect(fieldErrors(error)).toEqual({});
  });
});
