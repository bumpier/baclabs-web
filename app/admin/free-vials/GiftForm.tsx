"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { addVialGiftAction, type GiftFormState } from "./actions";

/**
 * Its own client form rather than ActionForm: the inputs are controlled so a
 * warning ("no orders under this email") keeps what was typed while
 * "Send anyway" is ticked, and they clear once the gift is saved.
 */
export function GiftForm({ email: initialEmail, maxVials }: { email: string; maxVials: number }) {
  const [state, formAction] = useActionState<GiftFormState, FormData>(addVialGiftAction, {});
  const [email, setEmail] = useState(initialEmail);
  const [vials, setVials] = useState("");
  const [note, setNote] = useState("");
  const [anyway, setAnyway] = useState(false);
  const [seen, setSeen] = useState(state);

  // A new result: clear the form after a save, and untick "Send anyway"
  // whenever it has done its job.
  if (state !== seen) {
    setSeen(state);
    setAnyway(false);
    if (state.success) {
      setEmail("");
      setVials("");
      setNote("");
    }
  }

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="gift-email" className="label">
            Customer&apos;s email
          </label>
          <input
            id="gift-email"
            name="email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="The one they order with"
            className="field w-full"
          />
        </div>
        <div>
          <label htmlFor="gift-vials" className="label">
            Free vials
          </label>
          <input
            id="gift-vials"
            name="vials"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            value={vials}
            onChange={(e) => setVials(e.target.value)}
            placeholder={`1–${maxVials}`}
            className="field w-24"
          />
        </div>
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="gift-note" className="label">
            Reason (only you see this)
          </label>
          <input
            id="gift-note"
            name="note"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Parcel late, order 1a2b3c4d…"
            className="field w-full"
          />
        </div>
      </div>
      {state.confirm && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="anyway"
            checked={anyway}
            onChange={(e) => setAnyway(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          Send anyway
        </label>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary">Add and email them</SubmitButton>
    </form>
  );
}
