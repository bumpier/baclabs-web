"use client";

import { useActionState } from "react";
import { createSubuserAction } from "@/app/admin/subusers/actions";
import type { FormState } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export default function SubuserForm() {
  const [state, action] = useActionState(createSubuserAction, initial);

  return (
    <form action={action} className="mt-5 max-w-md space-y-5">
      <div>
        <label className="label" htmlFor="su-name">
          Full name
        </label>
        <input
          id="su-name"
          name="name"
          type="text"
          required
          maxLength={100}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="su-email">
          Email
        </label>
        <input
          id="su-email"
          name="email"
          type="email"
          required
          maxLength={254}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="su-role">
          Role
        </label>
        <select id="su-role" name="role" required className="field">
          <option value="PACKER">Packer — orders &amp; shipping only</option>
          <option value="ADMIN">Admin — full access</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="su-password">
          Temporary password
        </label>
        <input
          id="su-password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          className="field"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
