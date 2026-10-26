"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type TicketStatus,
} from "@/lib/ticket-schema"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TicketStatusFilter({ value }: { value?: TicketStatus }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string | null) {
    const target =
      !next || next === "all" ? "/admin" : `/admin?status=${next}`

    startTransition(() => {
      router.replace(target, { scroll: false })
    })
  }

  return (
    <Select
      value={value ?? "all"}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-48" aria-label="Filter tickets by status">
        <SelectValue>
          {(selected: string | null) =>
            selected && selected !== "all"
              ? TICKET_STATUS_LABELS[selected as TicketStatus]
              : "All statuses"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {TICKET_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {TICKET_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
