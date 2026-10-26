"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  type TicketCategory,
} from "@/lib/ticket-schema"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TicketCategoryFilter({
  value,
}: {
  value?: TicketCategory
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string | null) {
    const target =
      !next || next === "all"
        ? "/dashboard"
        : `/dashboard?category=${next}`

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
      <SelectTrigger
        className="w-52"
        aria-label="Filter tickets by category"
      >
        <SelectValue>
          {(selected: string | null) =>
            selected && selected !== "all"
              ? TICKET_CATEGORY_LABELS[selected as TicketCategory]
              : "All categories"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All categories</SelectItem>
        {TICKET_CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            {TICKET_CATEGORY_LABELS[category]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
