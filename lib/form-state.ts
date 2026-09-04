/**
 * Shared result shape for every server action that backs a <form>.
 *
 * This used to live in app/(store)/auth/actions.ts. That file was the affiliate
 * auth layer and has been removed, but admin forms still need the type, so it
 * lives here now — no server-action module in the import graph of a client
 * component.
 */
export type FormState = {
  error?: string;
  success?: string;
};

export const EMPTY_FORM_STATE: FormState = {};
