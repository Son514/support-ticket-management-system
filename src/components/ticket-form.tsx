"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import Link from "next/link"
import { PaperclipIcon, XIcon } from "lucide-react"

import { createTicket, type CreateTicketState } from "@/app/server/ticket"
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  ticketSchema,
  validateAttachment,
  type TicketCategory,
  type TicketInput,
  type TicketPriority,
} from "@/lib/ticket-schema"
import { cn } from "cn"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const initialState: CreateTicketState = { status: "idle" }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TicketForm({ className }: { className?: string }) {
  const [state, formAction, isActionPending] = useActionState(
    createTicket,
    initialState
  )
  const [isTransitionPending, startTransition] = useTransition()
  const isPending = isActionPending || isTransitionPending
  const [attachment, setAttachment] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileTouched, setFileTouched] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)

  const serverAttachmentError = state.errors?.attachment ?? null
  const attachmentError =
    fileError ?? (fileTouched ? null : serverAttachmentError)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TicketInput>({
    resolver: zodResolver(ticketSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
    },
  })

  useEffect(() => {
    if (!state.errors) {
      return
    }

    for (const [field, message] of Object.entries(state.errors)) {
      if (!message) {
        continue
      }

      if (field === "attachment") {
        continue
      }

      setError(field as keyof TicketInput, { type: "server", message })
    }
  }, [state, setError])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    setFileTouched(true)
    setAttachment(file)
    setFileError(file ? validateAttachment(file) : null)
  }

  function removeAttachment() {
    setAttachment(null)
    setFileError(null)
    setFileTouched(true)
    setFileInputKey((key) => key + 1)
  }

  const onSubmit = handleSubmit((values) => {
    if (attachmentError) {
      return
    }

    const formData = new FormData()

    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value)
    }

    if (attachment) {
      formData.set("attachment", attachment)
    }

    startTransition(() => {
      formAction(formData)
    })
  })

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Card className="p-0">
        <CardContent className="p-6">
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">Submit a ticket</h1>
                <p className="text-sm text-muted-foreground">
                  Tell us what&apos;s going on and we&apos;ll get back to you as
                  soon as possible.
                </p>
              </div>

              <Field data-invalid={Boolean(errors.title)}>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input
                  id="title"
                  type="text"
                  placeholder="Brief summary of the issue"
                  maxLength={120}
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  {...register("title")}
                />
                <FieldError id="title-error">{errors.title?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  placeholder="What happened? Include any steps to reproduce the issue."
                  className="min-h-40"
                  maxLength={5000}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={
                    errors.description ? "description-error" : undefined
                  }
                  {...register("description")}
                />
                <FieldError id="description-error">
                  {errors.description?.message}
                </FieldError>
              </Field>

              <Field className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.category)}>
                  <FieldLabel htmlFor="category">Category</FieldLabel>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <Select
                        name={field.name}
                        value={field.value ?? null}
                        onValueChange={(value) => field.onChange(value ?? "")}
                      >
                        <SelectTrigger
                          id="category"
                          className="w-full"
                          aria-invalid={Boolean(errors.category)}
                          aria-describedby={
                            errors.category ? "category-error" : undefined
                          }
                          onBlur={field.onBlur}
                        >
                          <SelectValue>
                            {(value: string | null) =>
                              value
                                ? TICKET_CATEGORY_LABELS[
                                    value as TicketCategory
                                  ]
                                : "Choose a category"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {TICKET_CATEGORY_LABELS[category]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError id="category-error">
                    {errors.category?.message}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.priority)}>
                  <FieldLabel htmlFor="priority">Priority</FieldLabel>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <Select
                        name={field.name}
                        value={field.value ?? null}
                        onValueChange={(value) => field.onChange(value ?? "")}
                      >
                        <SelectTrigger
                          id="priority"
                          className="w-full"
                          aria-invalid={Boolean(errors.priority)}
                          aria-describedby={
                            errors.priority ? "priority-error" : undefined
                          }
                          onBlur={field.onBlur}
                        >
                          <SelectValue>
                            {(value: string | null) =>
                              value
                                ? TICKET_PRIORITY_LABELS[
                                    value as TicketPriority
                                  ]
                                : "Choose a priority"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {TICKET_PRIORITY_LABELS[priority]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError id="priority-error">
                    {errors.priority?.message}
                  </FieldError>
                </Field>
              </Field>

              <Field data-invalid={Boolean(attachmentError)}>
                <FieldLabel htmlFor="attachment">
                  Attachment (optional)
                </FieldLabel>
                <Input
                  key={fileInputKey}
                  id="attachment"
                  name="attachment"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  onChange={handleFileChange}
                  aria-invalid={Boolean(attachmentError)}
                  aria-describedby={
                    attachmentError ? "attachment-error" : "attachment-help"
                  }
                  className="file:mr-3 file:inline-flex file:h-7 file:items-center file:rounded-md file:border-0 file:bg-muted file:px-2 file:text-sm file:font-medium"
                />
                {attachment ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{attachment.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={removeAttachment}
                      aria-label="Remove attachment"
                    >
                      <XIcon />
                    </Button>
                  </div>
                ) : null}
                <FieldDescription id="attachment-help">
                  PNG, JPG, WEBP or PDF, up to 10 MB.
                </FieldDescription>
                <FieldError id="attachment-error">{attachmentError}</FieldError>
              </Field>

              {state.message ? (
                <Field>
                  <FieldError>{state.message}</FieldError>
                </Field>
              ) : null}

              <Field className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link
                  href="/dashboard"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Cancel
                </Link>
                <Button
                  type="submit"
                  disabled={isPending || Boolean(attachmentError)}
                >
                  {isPending ? "Creating ticket…" : "Create ticket"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
