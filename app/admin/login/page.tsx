"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/app/admin/actions";
import type { FormState } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export default function AdminLoginPage() {
  const [state, action] = useActionState(adminLoginAction, initial);

  return (
    <div className="mx-auto max-w-sm px-4 py-24 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Restricted area</p>
        <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-brand-deep">
          Admin sign in
        </h1>

        <form action={action} className="mt-7 space-y-5">
          <div>
            <label className="label" htmlFor="email">
              Email{" "}
              <span className="font-normal text-ink-soft">(leave blank for master password)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              maxLength={254}
              className="field"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              maxLength={256}
              className="field"
              autoComplete="current-password"
            />
          </div>

          <FormMessage state={state} />
          <SubmitButton>Sign in</SubmitButton>
        </form>
      </div>
    </div>
  );
}
