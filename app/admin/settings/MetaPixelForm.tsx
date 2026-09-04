"use client";

import { useActionState } from "react";
import { saveMetaPixelAction } from "@/app/admin/settings/actions";
import type { FormState } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export default function MetaPixelForm({ pixelId }: { pixelId: string }) {
  const [state, action] = useActionState(saveMetaPixelAction, initial);

  return (
    <form action={action} className="mt-5 max-w-md space-y-5">
      <div>
        <label className="label" htmlFor="meta-pixel-id">
          Meta Pixel ID
        </label>
        {/* A textarea, not an input: operators paste the whole base code
            block from Events Manager at least as often as they paste the
            bare id, and a 40-character input silently truncates it. */}
        <textarea
          id="meta-pixel-id"
          name="pixelId"
          rows={3}
          autoComplete="off"
          spellCheck={false}
          defaultValue={pixelId}
          placeholder="123456789012345 — or paste the whole base code block"
          maxLength={4000}
          className="field resize-y font-mono text-sm"
          aria-describedby="meta-pixel-help"
        />
        <p id="meta-pixel-help" className="mt-1.5 text-sm text-ink-soft">
          Paste the Pixel ID, or the whole snippet Meta gives you — the ID is pulled out of it.
          Clear the box and save to switch tracking off.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary">Save pixel</SubmitButton>
    </form>
  );
}
