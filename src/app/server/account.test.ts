import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  destroySession: vi.fn(),
  accountWhere: vi.fn(),
  accountSelect: vi.fn(),
  accountFirst: vi.fn(),
  accountCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/password", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/lib/session", () => ({
  createSession: mocks.createSession,
  destroySession: mocks.destroySession,
}));
vi.mock("@/prisma/db", () => ({
  db: {
    orm: {
      public: {
        Account: {
          where: mocks.accountWhere,
          select: mocks.accountSelect,
        },
      },
    },
  },
}));

import { loginAccount, logoutAccount, registerAccount } from "./account";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

const validRegistration = {
  name: "Jane Doe",
  email: "jane@example.com",
  password: "longenough",
  confirmPassword: "longenough",
};

const validLogin = {
  email: "jane@example.com",
  password: "longenough",
};

const account = {
  id: 7,
  email: "jane@example.com",
  password: "stored-hash",
  role: "customer",
  authVersion: 3,
};

describe("registerAccount", () => {
  beforeEach(() => {
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    mocks.hashPassword.mockReset();
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.accountWhere.mockReset();
    mocks.accountWhere.mockReturnValue({ first: mocks.accountFirst });
    mocks.accountSelect.mockReset();
    mocks.accountSelect.mockReturnValue({ create: mocks.accountCreate });
    mocks.accountFirst.mockReset();
    mocks.accountFirst.mockResolvedValue(null);
    mocks.accountCreate.mockReset();
    mocks.accountCreate.mockResolvedValue({ id: 1 });
  });

  it("returns field errors without touching the database", async () => {
    const state = await registerAccount(
      { status: "idle" },
      formData({
        name: "",
        email: "nope",
        password: "short",
        confirmPassword: "different",
      }),
    );

    expect(state.status).toBe("error");
    expect(state.errors).toMatchObject({
      name: "Please enter your full name.",
      email: "Please enter a valid email address.",
      password: "Password must be at least 8 characters long.",
      confirmPassword: "Passwords do not match.",
    });
    expect(mocks.accountFirst).not.toHaveBeenCalled();
  });

  it("rejects an email that already has an account", async () => {
    mocks.accountFirst.mockResolvedValue({ id: 1 });

    const state = await registerAccount(
      { status: "idle" },
      formData(validRegistration),
    );

    expect(state.errors?.email).toBe(
      "An account with this email already exists.",
    );
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  it("creates the account with a hashed password and redirects to login", async () => {
    await expect(
      registerAccount({ status: "idle" }, formData(validRegistration)),
    ).rejects.toThrow("REDIRECT:/login");

    expect(mocks.hashPassword).toHaveBeenCalledWith("longenough");
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "hashed-password",
    });
  });

  it("maps a unique-constraint race to the email error", async () => {
    mocks.accountCreate.mockRejectedValue({ sqlState: "23505" });

    const state = await registerAccount(
      { status: "idle" },
      formData(validRegistration),
    );

    expect(state.errors?.email).toBe(
      "An account with this email already exists.",
    );
  });

  it("returns a generic message for unexpected failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.accountCreate.mockRejectedValue(new Error("database down"));

    const state = await registerAccount(
      { status: "idle" },
      formData(validRegistration),
    );

    expect(state.message).toBe(
      "Could not create your account. Please try again.",
    );
    expect(error).toHaveBeenCalled();
  });
});

describe("loginAccount", () => {
  beforeEach(() => {
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    mocks.hashPassword.mockReset();
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.verifyPassword.mockReset();
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.createSession.mockReset();
    mocks.createSession.mockResolvedValue(undefined);
    mocks.accountWhere.mockReset();
    mocks.accountWhere.mockReturnValue({ first: mocks.accountFirst });
    mocks.accountFirst.mockReset();
    mocks.accountFirst.mockResolvedValue(account);
  });

  it("returns field errors for invalid input", async () => {
    const state = await loginAccount(
      { status: "idle" },
      formData({ email: "nope", password: "" }),
    );

    expect(state.errors).toMatchObject({
      email: "Please enter a valid email address.",
      password: "Please enter your password.",
    });
    expect(mocks.accountFirst).not.toHaveBeenCalled();
  });

  it("uses a generic message and dummy hash for an unknown email", async () => {
    mocks.accountFirst.mockResolvedValue(null);

    const state = await loginAccount(
      { status: "idle" },
      formData(validLogin),
    );

    expect(state.message).toBe("Invalid email or password.");
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.hashPassword).toHaveBeenCalledWith("longenough");
  });

  it("uses the same generic message for a wrong password", async () => {
    mocks.verifyPassword.mockResolvedValue(false);

    const state = await loginAccount(
      { status: "idle" },
      formData(validLogin),
    );

    expect(state.message).toBe("Invalid email or password.");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["customer", "/dashboard"],
    ["agent", "/agent"],
    ["admin", "/admin"],
  ])("creates a session and redirects %s to %s", async (role, destination) => {
    mocks.accountFirst.mockResolvedValue({ ...account, role });

    await expect(
      loginAccount({ status: "idle" }, formData(validLogin)),
    ).rejects.toThrow(`REDIRECT:${destination}`);

    expect(mocks.createSession).toHaveBeenCalledWith(7, 3);
  });

  it("reports when the session cannot be created", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createSession.mockRejectedValue(new Error("AUTH_SECRET missing"));

    const state = await loginAccount(
      { status: "idle" },
      formData(validLogin),
    );

    expect(state.message).toBe(
      "Sign in is currently unavailable. Please try again later.",
    );
    expect(error).toHaveBeenCalled();
  });

  it("returns a generic message when the lookup fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.accountFirst.mockRejectedValue(new Error("connection failed"));

    const state = await loginAccount(
      { status: "idle" },
      formData(validLogin),
    );

    expect(state.message).toBe("Could not sign you in. Please try again.");
    expect(error).toHaveBeenCalled();
  });
});

describe("logoutAccount", () => {
  it("destroys the session and redirects to login", async () => {
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    mocks.destroySession.mockReset();
    mocks.destroySession.mockResolvedValue(undefined);

    await expect(logoutAccount()).rejects.toThrow("REDIRECT:/login");

    expect(mocks.destroySession).toHaveBeenCalledTimes(1);
  });
});
