import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireRole: vi.fn(),
  ticketWhere: vi.fn(),
  ticketSelect: vi.fn(),
  ticketOrderBy: vi.fn(),
  ticketAll: vi.fn(),
  transaction: vi.fn(),
  txTicketCreate: vi.fn(),
  txAttachmentCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/prisma/db", () => ({
  db: {
    orm: {
      public: {
        Ticket: {
          where: mocks.ticketWhere,
          select: mocks.ticketSelect,
        },
      },
    },
    transaction: mocks.transaction,
  },
}));

import { createTicket, listTicketsForAccount } from "./ticket";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

const validTicket = {
  title: "Cannot log in",
  description:
    "I enter my email and password but the page reloads without signing in.",
  category: "technical",
  priority: "high",
};

const account = { id: 7, name: "Jane", email: "jane@example.com" };

describe("createTicket", () => {
  beforeEach(() => {
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    mocks.revalidatePath.mockReset();
    mocks.requireRole.mockReset();
    mocks.requireRole.mockResolvedValue(account);
    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          orm: {
            public: {
              Ticket: {
                select: () => ({ create: mocks.txTicketCreate }),
              },
              TicketAttachment: { create: mocks.txAttachmentCreate },
            },
          },
        }),
    );
    mocks.txTicketCreate.mockReset();
    mocks.txTicketCreate.mockResolvedValue({ id: 42 });
    mocks.txAttachmentCreate.mockReset();
    mocks.txAttachmentCreate.mockResolvedValue({});
  });

  it("stops when the customer role check redirects", async () => {
    mocks.requireRole.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(
      createTicket({ status: "idle" }, formData(validTicket)),
    ).rejects.toThrow("REDIRECT:/login");

    expect(mocks.requireRole).toHaveBeenCalledWith("customer");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns field errors without writing anything", async () => {
    const state = await createTicket(
      { status: "idle" },
      formData({ title: "Hi", description: "Short", category: "", priority: "" }),
    );

    expect(state.status).toBe("error");
    expect(state.errors).toMatchObject({
      title: "Title must be at least 5 characters long.",
      description: "Description must be at least 20 characters long.",
      category: "Choose a category.",
      priority: "Choose a priority.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an unsupported attachment without writing anything", async () => {
    const data = formData(validTicket);
    data.append(
      "attachments",
      new File(["payload"], "payload.exe", {
        type: "application/x-msdownload",
      }),
    );

    const state = await createTicket({ status: "idle" }, data);

    expect(state.errors?.attachments).toBe(
      "payload.exe: Attachment must be a PNG, JPG, or PDF file.",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a ticket without an attachment", async () => {
    await expect(
      createTicket({ status: "idle" }, formData(validTicket)),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.txTicketCreate).toHaveBeenCalledWith({
      title: validTicket.title,
      description: validTicket.description,
      category: "technical",
      priority: "high",
      status: "open",
      accountId: 7,
    });
    expect(mocks.txAttachmentCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("stores multiple attachments with the ticket", async () => {
    const data = formData(validTicket);
    const png = new File(
      [
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ],
      "screen.png",
      { type: "image/png" },
    );
    const pdf = new File([new TextEncoder().encode("%PDF-1.4")], "ticket.pdf", {
      type: "application/pdf",
    });
    data.append("attachments", png);
    data.append("attachments", pdf);

    await expect(createTicket({ status: "idle" }, data)).rejects.toThrow(
      "REDIRECT:/dashboard",
    );

    expect(mocks.txAttachmentCreate).toHaveBeenCalledTimes(2);

    const payloads = mocks.txAttachmentCreate.mock.calls.map(
      (call) => call[0],
    );

    expect(payloads[0]).toMatchObject({
      ticketId: 42,
      fileName: "screen.png",
      contentType: "image/png",
      size: 8,
    });
    expect(payloads[0].data).toBeInstanceOf(Uint8Array);
    expect(payloads[1]).toMatchObject({
      ticketId: 42,
      fileName: "ticket.pdf",
      contentType: "application/pdf",
      size: 8,
    });
  });

  it("returns a generic message when the insert fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.transaction.mockRejectedValue(new Error("database down"));

    const state = await createTicket(
      { status: "idle" },
      formData(validTicket),
    );

    expect(state.message).toBe(
      "Could not create your ticket. Please try again.",
    );
    expect(error).toHaveBeenCalled();
  });
});

describe("listTicketsForAccount", () => {
  beforeEach(() => {
    mocks.ticketWhere.mockReset();
    mocks.ticketSelect.mockReset();
    mocks.ticketOrderBy.mockReset();
    mocks.ticketAll.mockReset();

    mocks.ticketWhere.mockReturnValue({ select: mocks.ticketSelect });
    mocks.ticketSelect.mockReturnValue({ orderBy: mocks.ticketOrderBy });
    mocks.ticketOrderBy.mockReturnValue({ all: mocks.ticketAll });
    mocks.ticketAll.mockResolvedValue([]);
  });

  it("filters by account and selects only safe fields", async () => {
    const rows = [{ id: 1, title: "Cannot log in" }];
    mocks.ticketAll.mockResolvedValue(rows);

    await expect(listTicketsForAccount(7)).resolves.toEqual(rows);

    expect(mocks.ticketWhere).toHaveBeenCalledWith({ accountId: 7 });
    expect(mocks.ticketSelect).toHaveBeenCalledWith(
      "id",
      "title",
      "description",
      "category",
      "priority",
      "status",
      "createdAt",
    );
    expect(mocks.ticketOrderBy).toHaveBeenCalledTimes(1);
  });

  it("adds the category filter when provided", async () => {
    mocks.ticketAll.mockResolvedValue([]);

    await listTicketsForAccount(7, "billing");

    expect(mocks.ticketWhere).toHaveBeenCalledWith({
      accountId: 7,
      category: "billing",
    });
  });
});
