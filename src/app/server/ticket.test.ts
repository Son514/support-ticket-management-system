import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireRole: vi.fn(),
  ticketWhere: vi.fn(),
  ticketSelect: vi.fn(),
  ticketOrderBy: vi.fn(),
  ticketInclude: vi.fn(),
  ticketAll: vi.fn(),
  ticketFirst: vi.fn(),
  ticketUpdate: vi.fn(),
  attachmentWhere: vi.fn(),
  attachmentSelect: vi.fn(),
  attachmentOrderBy: vi.fn(),
  attachmentAll: vi.fn(),
  attachmentFirst: vi.fn(),
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
          include: mocks.ticketInclude,
        },
        TicketAttachment: {
          where: mocks.attachmentWhere,
        },
      },
    },
    transaction: mocks.transaction,
  },
}));

import {
  agentCanViewTicket,
  claimTicket,
  createTicket,
  getAgentTicket,
  getTicketAttachment,
  getTicketById,
  listAgentQueue,
  listAllTickets,
  listTicketAttachments,
  listTicketsForAccount,
  ticketExists,
} from "./ticket";

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
    mocks.ticketSelect.mockReturnValue({
      orderBy: mocks.ticketOrderBy,
      include: mocks.ticketInclude,
    });
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

describe("listAgentQueue", () => {
  beforeEach(() => {
    mocks.ticketWhere.mockReset();
    mocks.ticketSelect.mockReset();
    mocks.ticketInclude.mockReset();
    mocks.ticketAll.mockReset();

    mocks.ticketWhere.mockReturnValue({ select: mocks.ticketSelect });
    mocks.ticketSelect.mockReturnValue({ include: mocks.ticketInclude });
    mocks.ticketInclude.mockReturnValue({ all: mocks.ticketAll });
    mocks.ticketAll.mockResolvedValue([]);
  });

  it("splits unassigned and own tickets, sorted by priority", async () => {
    mocks.ticketAll.mockResolvedValue([
      { id: 1, assigneeId: null, priority: "low", createdAt: "2026-01-01" },
      { id: 2, assigneeId: 7, priority: "urgent", createdAt: "2026-01-02" },
      { id: 3, assigneeId: 7, priority: "high", createdAt: "2026-01-03" },
      { id: 4, assigneeId: null, priority: "urgent", createdAt: "2026-01-04" },
      { id: 5, assigneeId: 8, priority: "urgent", createdAt: "2026-01-05" },
    ]);

    const result = await listAgentQueue(7);

    expect(result.unassigned.map((ticket) => ticket.id)).toEqual([4, 1]);
    expect(result.assigned.map((ticket) => ticket.id)).toEqual([2, 3]);
    expect(mocks.ticketInclude).toHaveBeenCalledWith(
      "account",
      expect.any(Function),
    );
  });
});

describe("claimTicket", () => {
  beforeEach(() => {
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    mocks.revalidatePath.mockReset();
    mocks.requireRole.mockReset();
    mocks.requireRole.mockResolvedValue(account);
    mocks.ticketWhere.mockReset();
    mocks.ticketWhere.mockReturnValue({ update: mocks.ticketUpdate });
    mocks.ticketUpdate.mockReset();
    mocks.ticketUpdate.mockResolvedValue({ id: 5 });
  });

  it("assigns the ticket to the agent and marks it in progress", async () => {
    await expect(
      claimTicket(formData({ ticketId: "5" })),
    ).rejects.toThrow("REDIRECT:/agent");

    expect(mocks.requireRole).toHaveBeenCalledWith("agent");
    expect(mocks.ticketUpdate).toHaveBeenCalledWith({
      assigneeId: 7,
      status: "in_progress",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/agent");
  });

  it("redirects without updating for an invalid ticket id", async () => {
    await expect(
      claimTicket(formData({ ticketId: "not-a-number" })),
    ).rejects.toThrow("REDIRECT:/agent");

    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
  });

  it("stops when the agent role check redirects", async () => {
    mocks.requireRole.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(
      claimTicket(formData({ ticketId: "5" })),
    ).rejects.toThrow("REDIRECT:/login");

    expect(mocks.ticketUpdate).not.toHaveBeenCalled();
  });
});

describe("agent ticket detail queries", () => {
  beforeEach(() => {
    mocks.ticketWhere.mockReset();
    mocks.ticketSelect.mockReset();
    mocks.ticketInclude.mockReset();
    mocks.ticketFirst.mockReset();
    mocks.attachmentWhere.mockReset();
    mocks.attachmentSelect.mockReset();
    mocks.attachmentOrderBy.mockReset();
    mocks.attachmentAll.mockReset();
    mocks.attachmentFirst.mockReset();

    mocks.ticketWhere.mockReturnValue({ select: mocks.ticketSelect });
    mocks.ticketSelect.mockReturnValue({
      orderBy: mocks.ticketOrderBy,
      include: mocks.ticketInclude,
      first: mocks.ticketFirst,
    });
    mocks.ticketInclude.mockReturnValue({
      all: mocks.ticketAll,
      first: mocks.ticketFirst,
      include: mocks.ticketInclude,
    });

    mocks.attachmentWhere.mockReturnValue({
      select: mocks.attachmentSelect,
    });
    mocks.attachmentSelect.mockReturnValue({
      orderBy: mocks.attachmentOrderBy,
      first: mocks.attachmentFirst,
    });
    mocks.attachmentOrderBy.mockReturnValue({ all: mocks.attachmentAll });
    mocks.attachmentAll.mockResolvedValue([]);
    mocks.attachmentFirst.mockResolvedValue(null);
  });

  it("reports whether the agent can view a ticket", async () => {
    mocks.ticketFirst.mockResolvedValue({ id: 5 });
    await expect(agentCanViewTicket(7, 5)).resolves.toBe(true);

    mocks.ticketFirst.mockResolvedValue(null);
    await expect(agentCanViewTicket(7, 5)).resolves.toBe(false);
  });

  it("loads a visible ticket with the requester only", async () => {
    const row = {
      id: 5,
      title: "Cannot log in",
      account: { name: "Jane", email: "jane@example.com" },
    };
    mocks.ticketFirst.mockResolvedValue(row);

    await expect(getAgentTicket(7, 5)).resolves.toEqual(row);

    expect(mocks.ticketInclude).toHaveBeenCalledWith(
      "account",
      expect.any(Function),
    );
    expect(mocks.ticketInclude).toHaveBeenCalledWith(
      "assignee",
      expect.any(Function),
    );
  });

  it("returns null for an invisible ticket", async () => {
    mocks.ticketFirst.mockResolvedValue(null);

    await expect(getAgentTicket(7, 5)).resolves.toBeNull();
  });

  it("lists attachment metadata without the data blob", async () => {
    const rows = [{ id: 1, fileName: "screen.png", size: 8 }];
    mocks.attachmentAll.mockResolvedValue(rows);

    await expect(listTicketAttachments(5)).resolves.toEqual(rows);

    expect(mocks.attachmentWhere).toHaveBeenCalledWith({ ticketId: 5 });
    expect(mocks.attachmentSelect).toHaveBeenCalledWith(
      "id",
      "fileName",
      "contentType",
      "size",
    );
  });

  it("loads one attachment including its data for download", async () => {
    const row = {
      id: 2,
      fileName: "screen.png",
      contentType: "image/png",
      size: 8,
      data: new Uint8Array([1, 2, 3]),
    };
    mocks.attachmentFirst.mockResolvedValue(row);

    await expect(getTicketAttachment(5, 2)).resolves.toEqual(row);

    expect(mocks.attachmentWhere).toHaveBeenCalledWith({
      id: 2,
      ticketId: 5,
    });
    expect(mocks.attachmentSelect).toHaveBeenCalledWith(
      "id",
      "fileName",
      "contentType",
      "size",
      "data",
    );
  });
});

describe("listAllTickets", () => {
  beforeEach(() => {
    mocks.ticketWhere.mockReset();
    mocks.ticketSelect.mockReset();
    mocks.ticketInclude.mockReset();
    mocks.ticketOrderBy.mockReset();
    mocks.ticketAll.mockReset();

    mocks.ticketWhere.mockReturnValue({ select: mocks.ticketSelect });
    mocks.ticketSelect.mockReturnValue({
      orderBy: mocks.ticketOrderBy,
      include: mocks.ticketInclude,
    });
    mocks.ticketInclude.mockReturnValue({
      include: mocks.ticketInclude,
      orderBy: mocks.ticketOrderBy,
      all: mocks.ticketAll,
    });
    mocks.ticketOrderBy.mockReturnValue({ all: mocks.ticketAll });
    mocks.ticketAll.mockResolvedValue([]);
  });

  it("lists every ticket with requester and assignee", async () => {
    const rows = [{ id: 1, title: "Cannot log in" }];
    mocks.ticketAll.mockResolvedValue(rows);

    await expect(listAllTickets()).resolves.toEqual(rows);

    expect(mocks.ticketWhere).not.toHaveBeenCalled();
    expect(mocks.ticketSelect).toHaveBeenCalledWith(
      "id",
      "title",
      "category",
      "priority",
      "status",
      "createdAt",
      "assigneeId",
    );
    expect(mocks.ticketInclude).toHaveBeenCalledWith(
      "account",
      expect.any(Function),
    );
    expect(mocks.ticketInclude).toHaveBeenCalledWith(
      "assignee",
      expect.any(Function),
    );
    expect(mocks.ticketOrderBy).toHaveBeenCalledTimes(1);
  });

  it("filters by status when provided", async () => {
    await listAllTickets("open");

    expect(mocks.ticketWhere).toHaveBeenCalledWith({ status: "open" });
  });
});

describe("admin ticket detail queries", () => {
  beforeEach(() => {
    mocks.ticketWhere.mockReset();
    mocks.ticketSelect.mockReset();
    mocks.ticketInclude.mockReset();
    mocks.ticketFirst.mockReset();

    mocks.ticketWhere.mockReturnValue({ select: mocks.ticketSelect });
    mocks.ticketSelect.mockReturnValue({
      include: mocks.ticketInclude,
      first: mocks.ticketFirst,
    });
    mocks.ticketInclude.mockReturnValue({
      include: mocks.ticketInclude,
      first: mocks.ticketFirst,
    });
  });

  it("loads any ticket with requester and assignee", async () => {
    const row = {
      id: 5,
      title: "Cannot log in",
      account: { name: "Jane", email: "jane@example.com" },
      assignee: { name: "Mark", email: "mark@example.com" },
    };
    mocks.ticketFirst.mockResolvedValue(row);

    await expect(getTicketById(5)).resolves.toEqual(row);

    expect(mocks.ticketWhere).toHaveBeenCalledWith({ id: 5 });
    expect(mocks.ticketInclude).toHaveBeenCalledWith(
      "account",
      expect.any(Function),
    );
    expect(mocks.ticketInclude).toHaveBeenCalledWith(
      "assignee",
      expect.any(Function),
    );
  });

  it("returns null for a missing ticket", async () => {
    mocks.ticketFirst.mockResolvedValue(null);

    await expect(getTicketById(5)).resolves.toBeNull();
  });

  it("reports whether a ticket exists", async () => {
    mocks.ticketFirst.mockResolvedValue({ id: 5 });
    await expect(ticketExists(5)).resolves.toBe(true);

    mocks.ticketFirst.mockResolvedValue(null);
    await expect(ticketExists(5)).resolves.toBe(false);
  });
});
