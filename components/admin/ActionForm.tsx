"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "@/components/forms";

/**
 * A form bound to a (prev, formData) => FormState server action, with the
 * result message and a pending-aware submit button. Lets a server page put
 * plain inputs inside without a client component of its own per form.
 *
 * `confirm` asks before submitting — for the actions that cost money or
 * cannot be undone (buying a label, switching the stock mode).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-4",
  submitClassName = "btn-primary",
  confirm,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  submitLabel: string;
  className?: string;
  submitClassName?: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <FormMessage state={state} />
      <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
    </form>
  );
}
