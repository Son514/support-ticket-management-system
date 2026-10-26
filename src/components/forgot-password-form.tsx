"use client"

import { useActionState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  requestPasswordReset,
  type RequestPasswordResetState,
} from "@/app/server/password-reset"
import {
  requestPasswordResetSchema,
  type RequestPasswordResetInput,
} from "@/lib/account-schema"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: RequestPasswordResetState = { status: "idle" }

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [state, formAction, isActionPending] = useActionState(
    requestPasswordReset,
    initialState
  )
  const [isTransitionPending, startTransition] = useTransition()
  const isPending = isActionPending || isTransitionPending
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  })

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData()

    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value)
    }

    startTransition(() => {
      formAction(formData)
    })
  })

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="p-0">
        <CardContent className="p-6 md:p-8">
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Forgot your password?</h1>
                <p className="text-balance text-muted-foreground">
                  Enter your email and we&apos;ll send you a link to reset it.
                </p>
              </div>
              {state.status === "success" ? (
                <>
                  <Field>
                    <FieldDescription role="status">
                      {state.message}
                    </FieldDescription>
                  </Field>
                  <FieldDescription className="text-center">
                    <a href="/login">Back to sign in</a>
                  </FieldDescription>
                </>
              ) : (
                <>
                  <Field data-invalid={Boolean(errors.email)}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      autoComplete="email"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email ? "email-error" : undefined
                      }
                      {...register("email")}
                    />
                    <FieldError id="email-error">
                      {errors.email?.message}
                    </FieldError>
                  </Field>
                  <Field>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Sending…" : "Send reset link"}
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    Remembered it? <a href="/login">Sign in</a>
                  </FieldDescription>
                </>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
