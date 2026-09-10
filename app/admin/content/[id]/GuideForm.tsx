"use client";

import { useActionState, useEffect, useState } from "react";
import type { Guide, GuideSection } from "@/content/guides/types";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import {
  deleteArticleAction,
  publishArticleAction,
  saveArticleAction,
  unpublishArticleAction,
} from "@/app/admin/content/actions";

const field = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink";
const label = "block text-sm font-medium text-ink";
const hint = "mt-1 text-xs text-ink-soft";

// Which of the four independent action states is the one to show. Each
// useActionState hook below keeps its own result until ITS form is
// resubmitted, so without this a stale success from one action can render
// next to a genuine error from another (or vice versa). Tagging the action
// that most recently completed, and showing only that one's message, is
// what keeps the panel honest.
type ActionTag = "save" | "publish" | "unpublish" | "delete";

function Counter({ n, max, unit = "characters" }: { n: number; max: number; unit?: string }) {
  return (
    <span className={n > max ? "text-red-700" : "text-ink-soft"}>
      {n}/{max} {unit}
    </span>
  );
}

export function GuideForm({
  id,
  guide,
  sortOrder,
  slugLocked,
  isLive,
  canPublish,
  relatedOptions,
}: {
  id: string;
  guide: Guide;
  sortOrder: number;
  slugLocked: boolean;
  isLive: boolean;
  canPublish: boolean;
  relatedOptions: string[];
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

  const [metaTitle, setMetaTitle] = useState(guide.metaTitle);
  const [description, setDescription] = useState(guide.description);
  const [quickAnswer, setQuickAnswer] = useState(guide.quickAnswer);
  const [sections, setSections] = useState<GuideSection[]>(guide.sections);
  const [faq, setFaq] = useState(guide.faq);
  const [related, setRelated] = useState<string[]>([
    guide.related[0] ?? "",
    guide.related[1] ?? "",
  ]);

  const quickAnswerWords = quickAnswer.trim() === "" ? 0 : quickAnswer.trim().split(/\s+/).length;

  function patchSection(i: number, patch: Partial<GuideSection>) {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

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
      {/* Sections, FAQ and related guides live in React state mirrored into
          the hidden inputs below, and the visible fields for them further
          down are unnamed - without JavaScript they still look editable, but
          a submit posts the values the page loaded with, not what was
          typed. Browsers render <noscript> only when scripting is off, so
          this never shows for the JavaScript case this form assumes. */}
      <noscript>
        <p className="rounded-panel border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          JavaScript is off in this browser. The sections, FAQ and related-guide fields below
          need it, and will not save until it is turned back on.
        </p>
      </noscript>

      <form action={save} className="grid gap-5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="sections" value={JSON.stringify(sections)} />
        <input type="hidden" name="faq" value={JSON.stringify(faq)} />
        <input
          type="hidden"
          name="related"
          value={JSON.stringify(related.filter((r) => r !== ""))}
        />
        {/* Post-only fields the shared action still expects. */}
        <input type="hidden" name="markdown" value="" />
        <input type="hidden" name="excerpt" value="" />

        <div>
          <label className={label} htmlFor="title">Title</label>
          <input className={field} id="title" name="title" defaultValue={guide.title} required />
          <p className={hint}>The H1. Phrase it as the question the guide answers.</p>
        </div>

        <div>
          <label className={label} htmlFor="slug">Address</label>
          <input
            className={field}
            id="slug"
            name="slug"
            defaultValue={guide.slug}
            readOnly={slugLocked}
            required
          />
          <p className={hint}>
            {slugLocked
              ? "Locked. This guide has been published, and changing its address would break the live URL and lose its ranking."
              : "Lowercase words separated by hyphens. It becomes /guides/your-address."}
          </p>
        </div>

        <div>
          <label className={label} htmlFor="metaTitle">Meta title</label>
          <input
            className={field}
            id="metaTitle"
            name="metaTitle"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            required
          />
          <p className={hint}>
            <Counter n={metaTitle.length} max={60} /> · must contain &quot;bacteriostatic water&quot;
          </p>
        </div>

        <div>
          <label className={label} htmlFor="description">Meta description</label>
          <textarea
            className={field}
            id="description"
            name="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className={hint}><Counter n={description.length} max={155} /></p>
        </div>

        <div>
          <label className={label} htmlFor="quickAnswer">Quick answer</label>
          <textarea
            className={field}
            id="quickAnswer"
            name="quickAnswer"
            rows={4}
            value={quickAnswer}
            onChange={(e) => setQuickAnswer(e.target.value)}
          />
          <p className={hint}>
            <Counter n={quickAnswerWords} max={75} unit="words (40 minimum)" /> · this is the
            paragraph an answer engine lifts, so answer the title directly.
          </p>
        </div>

        <fieldset className="grid gap-4 border-t border-line pt-4">
          <legend className="text-sm font-semibold text-ink">
            Sections ({sections.length}; 5 to 7 required)
          </legend>

          {sections.map((s, i) => (
            <div key={i} className="rounded-panel border border-line p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Section {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setSections((prev) => prev.filter((_, j) => j !== i))}
                  className="text-xs text-red-700 underline"
                >
                  Remove
                </button>
              </div>

              <input
                className={`${field} mt-2`}
                placeholder="Heading - phrase it as the sub-question it answers"
                value={s.heading}
                onChange={(e) => patchSection(i, { heading: e.target.value })}
              />

              <textarea
                className={`${field} mt-2`}
                rows={6}
                placeholder="Paragraphs. One blank line between them. **bold** is the only markup."
                value={s.paragraphs.join("\n\n")}
                onChange={(e) =>
                  patchSection(i, {
                    paragraphs: e.target.value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
                  })
                }
              />

              <textarea
                className={`${field} mt-2`}
                rows={3}
                placeholder="Optional bullet list, one per line"
                value={(s.list ?? []).join("\n")}
                onChange={(e) => {
                  const list = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
                  patchSection(i, { list: list.length ? list : undefined });
                }}
              />
            </div>
          ))}

          <div>
            <button
              type="button"
              onClick={() =>
                setSections((prev) => [...prev, { heading: "", paragraphs: [] }])
              }
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink"
            >
              Add section
            </button>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-line pt-4">
          <legend className="text-sm font-semibold text-ink">
            FAQ ({faq.length}; 4 to 6 required)
          </legend>

          {faq.map((f, i) => (
            <div key={i} className="rounded-panel border border-line p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Question {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setFaq((prev) => prev.filter((_, j) => j !== i))}
                  className="text-xs text-red-700 underline"
                >
                  Remove
                </button>
              </div>
              <input
                className={`${field} mt-2`}
                placeholder="Question"
                value={f.q}
                onChange={(e) =>
                  setFaq((prev) => prev.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))
                }
              />
              <textarea
                className={`${field} mt-2`}
                rows={3}
                placeholder="Answer, in one to three sentences"
                value={f.a}
                onChange={(e) =>
                  setFaq((prev) => prev.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))
                }
              />
            </div>
          ))}

          <div>
            <button
              type="button"
              onClick={() => setFaq((prev) => [...prev, { q: "", a: "" }])}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink"
            >
              Add question
            </button>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-line pt-4">
          <legend className="text-sm font-semibold text-ink">Related guides (exactly 2)</legend>
          {[0, 1].map((i) => {
            const own = related[i] ?? "";
            const sibling = related[1 - i] ?? "";
            // Own value is never hidden from its own list, even when it
            // matches the sibling's pick (legacy data from before this rule
            // existed) - only the OTHER select's options are narrowed, so a
            // genuine duplicate stays visible and fixable rather than
            // disappearing from its own dropdown.
            const options = relatedOptions.filter((s) => s !== sibling || s === own);
            // A slug saved here that is no longer published shows as a
            // blank-looking select with no indication of which one is
            // wrong. Render it explicitly, labelled, so the author can see
            // and replace it rather than guess.
            const stale = own !== "" && !relatedOptions.includes(own);
            return (
              <select
                key={i}
                className={field}
                value={own}
                onChange={(e) =>
                  setRelated((prev) => prev.map((r, j) => (j === i ? e.target.value : r)))
                }
              >
                <option value="">Choose a guide</option>
                {stale ? <option value={own}>{own} (no longer published)</option> : null}
                {options.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            );
          })}
          <p className={hint}>
            Only published guides appear here. The two must be different.
          </p>
        </fieldset>

        <div className="border-t border-line pt-4">
          <label className={label} htmlFor="updated">Updated</label>
          <input className={field} id="updated" name="updated" defaultValue={guide.updated} />
          <p className={hint}>YYYY-MM-DD. Bump it when the wording changes.</p>
        </div>

        <div>
          <label className={label} htmlFor="sortOrder">Position in the guides index</label>
          <input
            className={field}
            id="sortOrder"
            name="sortOrder"
            type="number"
            step="1"
            required
            defaultValue={sortOrder}
          />
          <p className={hint}>
            Where this guide appears on /guides relative to the others. Lower numbers come
            first.
          </p>
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
