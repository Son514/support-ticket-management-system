"use client"

import { useActionState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  resetPassword,
  type ResetPasswordState,
} from "@/app/server/password-reset"
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/account-schema"
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

const initialState: ResetPasswordState = { status: "idle" }

export function ResetPasswordForm({
  token,
  className,
  ...props
}: React.ComponentProps<"div"> & { token: string }) {
  const [state, formAction, isActionPending] = useActionState(
    resetPassword,
    initialState
  )
  const [isTransitionPending, startTransition] = useTransition()
  const isPending = isActionPending || isTransitionPending
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { token, password: "", confirmPassword: "" },
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
          {state.status === "success" ? (
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Password updated</h1>
                <p className="text-balance text-muted-foreground">
                  Your password has been changed. Sign in with your new
                  password.
                </p>
              </div>
              <Field>
                <a href="/login" className={buttonVariants()}>
                  Sign in
                </a>
              </Field>
            </FieldGroup>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Choose a new password</h1>
                  <p className="text-balance text-muted-foreground">
                    Pick a password you haven&apos;t used before.
                  </p>
                </div>
                <input type="hidden" {...register("token")} />
                <Field data-invalid={Boolean(errors.password)}>
                  <FieldLabel htmlFor="password">New password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    {...register("password")}
                  />
                  <FieldError id="password-error">
                    {errors.password?.message}
                  </FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.confirmPassword)}>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm new password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={
                      errors.confirmPassword
                        ? "confirm-password-error"
                        : undefined
                    }
                    {...register("confirmPassword")}
                  />
                  <FieldError id="confirm-password-error">
                    {errors.confirmPassword?.message}
                  </FieldError>
                </Field>
                {state.message ? (
                  <Field>
                    <FieldError>{state.message}</FieldError>
                  </Field>
                ) : null}
                <Field>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Updating…" : "Update password"}
                  </Button>
                </Field>
                <FieldDescription className="text-center">
                  <a href="/login">Back to sign in</a>
                </FieldDescription>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
