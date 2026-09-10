"use client";

import { useActionState, useEffect, useState } from "react";
import type { Post } from "@/content/posts/types";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import {
  deleteArticleAction,
  publishArticleAction,
  saveArticleAction,
  unpublishArticleAction,
} from "@/app/admin/content/actions";

// Which of the four independent action states is the one to show. Each
// useActionState hook below keeps its own result until ITS form is
// resubmitted, so without this a stale success from one action can render
// next to a genuine error from another (or vice versa). Tagging the action
// that most recently completed, and showing only that one's message, is
// what keeps the panel honest.
type ActionTag = "save" | "publish" | "unpublish" | "delete";

const field = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink";
const label = "block text-sm font-medium text-ink";
const hint = "mt-1 text-xs text-ink-soft";

export function PostForm({
  id,
  post,
  slugLocked,
  isLive,
  canPublish,
}: {
  id: string;
  post: Post;
  slugLocked: boolean;
  isLive: boolean;
  canPublish: boolean;
}) {
  // The actions below are passed to useActionState UNWRAPPED - each stays a
  // direct reference to its "use server" export, which is what lets React
  // serialise these forms for progressive enhancement (the hidden
  // $ACTION_REF fields). Wrapping them in a local function to tag which one
  // fired breaks that serialisation, so "which action last completed" is
  // tracked separately below instead.
  const [saveState, save, saveIsPending] = useActionState(saveArticleAction, EMPTY_FORM_STATE);
  const [pubState, publish, pubIsPending] = useActionState(publishArticleAction, EMPTY_FORM_STATE);
  const [unpubState, unpublish, unpubIsPending] = useActionState(
    unpublishArticleAction,
    EMPTY_FORM_STATE
  );
  const [delState, deleteArticle, delIsPending] = useActionState(
    deleteArticleAction,
    EMPTY_FORM_STATE
  );

  // Each useActionState hook above replaces its state with a fresh object
  // (even {} !== {}) the moment its action resolves, so watching for that
  // reference change - rather than wrapping the actions - tells us which
  // action most recently completed, without touching the action references
  // themselves.
  const [lastAction, setLastAction] = useState<ActionTag | null>(null);
  useEffect(() => {
    if (saveState !== EMPTY_FORM_STATE) setLastAction("save");
  }, [saveState]);
  useEffect(() => {
    if (pubState !== EMPTY_FORM_STATE) setLastAction("publish");
  }, [pubState]);
  useEffect(() => {
    if (unpubState !== EMPTY_FORM_STATE) setLastAction("unpublish");
  }, [unpubState]);
  useEffect(() => {
    if (delState !== EMPTY_FORM_STATE) setLastAction("delete");
  }, [delState]);

  // lastAction is set from useEffect, which never runs without JavaScript.
  // A no-JS submit is a fresh mount of this whole form (progressive
  // enhancement re-renders the page from the server response), so
  // lastAction is null on every such render regardless of which action
  // just ran - falling through to the plain ?? chain in that case is what
  // still surfaces the result. With JS, once any action has completed,
  // lastAction is non-null and this fallback is never reached; before that,
  // all four states are still the same EMPTY_FORM_STATE object, so the
  // chain yields nothing either way.
  const message =
    lastAction === "save"
      ? saveState.error
      : lastAction === "publish"
        ? pubState.error
        : lastAction === "unpublish"
          ? unpubState.error
          : lastAction === "delete"
            ? delState.error
            : saveState.error ?? pubState.error ?? unpubState.error ?? delState.error;
  const success =
    lastAction === "save"
      ? saveState.success
      : lastAction === "publish"
        ? pubState.success
        : lastAction === "unpublish"
          ? unpubState.success
          : saveState.success ?? pubState.success ?? unpubState.success;

  return (
    <div className="grid gap-6">
      <form action={save} className="grid gap-4">
        <input type="hidden" name="id" value={id} />
        {/* Guide-only fields the shared action still expects. */}
        <input type="hidden" name="quickAnswer" value="" />
        <input type="hidden" name="sections" value="[]" />
        <input type="hidden" name="faq" value="[]" />
        <input type="hidden" name="related" value="[]" />

        <div>
          <label className={label} htmlFor="title">Title</label>
          <input className={field} id="title" name="title" defaultValue={post.title} required />
        </div>

        <div>
          <label className={label} htmlFor="slug">Address</label>
          <input
            className={field}
            id="slug"
            name="slug"
            defaultValue={post.slug}
            readOnly={slugLocked}
            required
          />
          <p className={hint}>
            {slugLocked
              ? "Locked. This post has been published, and changing its address would break the live URL."
              : "Lowercase words separated by hyphens. It becomes /blog/your-address."}
          </p>
        </div>

        <div>
          <label className={label} htmlFor="metaTitle">Meta title</label>
          <input className={field} id="metaTitle" name="metaTitle" defaultValue={post.metaTitle} required />
          <p className={hint}>Shown in search results. Keep it under 60 characters.</p>
        </div>

        <div>
          <label className={label} htmlFor="description">Meta description</label>
          <textarea className={field} id="description" name="description" rows={2} defaultValue={post.description} />
          <p className={hint}>Under 155 characters.</p>
        </div>

        <div>
          <label className={label} htmlFor="excerpt">Excerpt</label>
          <textarea className={field} id="excerpt" name="excerpt" rows={2} defaultValue={post.excerpt} />
          <p className={hint}>One or two sentences, shown on the blog index.</p>
        </div>

        <div>
          <label className={label} htmlFor="markdown">Body</label>
          <textarea
            className={`${field} font-mono`}
            id="markdown"
            name="markdown"
            rows={24}
            defaultValue={post.markdown}
          />
          <p className={hint}>
            Markdown. ## for a heading, **bold**, - for a list. HTML is ignored.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="updated">Updated</label>
          <input className={field} id="updated" name="updated" defaultValue={post.updated} />
          <p className={hint}>YYYY-MM-DD. Bump it when the wording changes.</p>
        </div>

        <div>
          <button
            type="submit"
            disabled={saveIsPending}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save draft
          </button>
        </div>
      </form>

      {message ? <p className="text-sm text-red-700">{message}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <form action={publish}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={!canPublish || pubIsPending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLive ? "Republish" : "Publish"}
          </button>
        </form>
        {isLive ? (
          <form action={unpublish}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={unpubIsPending}
              className="rounded-md border border-line px-4 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Unpublish
            </button>
          </form>
        ) : null}
        {!isLive ? (
          <form action={deleteArticle} className="ml-auto">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={delIsPending}
              onClick={(e) => {
                if (!window.confirm("Delete this draft? This cannot be undone.")) {
                  e.preventDefault();
                }
              }}
              className="rounded-md border border-line px-4 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete draft
            </button>
          </form>
        ) : null}
      </div>

      <p className="text-xs text-ink-soft">
        Save first, then publish. The violations panel above reflects what has been saved.
      </p>
    </div>
  );
}
