"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form-state";

export function SubmitButton({
  children,
  className = "btn-primary w-full",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="alert-error">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="alert-note">
        {state.success}
      </p>
    );
  }
  return null;
}
