"use client";

import { useActionState, useState } from "react";
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
  slugLocked,
  isLive,
  canPublish,
  relatedOptions,
}: {
  id: string;
  guide: Guide;
  slugLocked: boolean;
  isLive: boolean;
  canPublish: boolean;
  relatedOptions: string[];
}) {
  const [saveState, save] = useActionState(saveArticleAction, EMPTY_FORM_STATE);
  const [pubState, publish] = useActionState(publishArticleAction, EMPTY_FORM_STATE);
  const [unpubState, unpublish] = useActionState(unpublishArticleAction, EMPTY_FORM_STATE);
  const [delState, deleteArticle] = useActionState(deleteArticleAction, EMPTY_FORM_STATE);

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

  const message = saveState.error ?? pubState.error ?? unpubState.error ?? delState.error;
  const success = saveState.success ?? pubState.success ?? unpubState.success;

  return (
    <div className="grid gap-6">
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
          {[0, 1].map((i) => (
            <select
              key={i}
              className={field}
              value={related[i] ?? ""}
              onChange={(e) =>
                setRelated((prev) => prev.map((r, j) => (j === i ? e.target.value : r)))
              }
            >
              <option value="">Choose a guide</option>
              {relatedOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ))}
          <p className={hint}>Only published guides appear here.</p>
        </fieldset>

        <div className="border-t border-line pt-4">
          <label className={label} htmlFor="updated">Updated</label>
          <input className={field} id="updated" name="updated" defaultValue={guide.updated} />
          <p className={hint}>YYYY-MM-DD. Bump it when the wording changes.</p>
        </div>

        <div>
          <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink">
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
            disabled={!canPublish}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLive ? "Republish" : "Publish"}
          </button>
        </form>
        {isLive ? (
          <form action={unpublish}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm text-ink">
              Unpublish
            </button>
          </form>
        ) : null}
        {!isLive ? (
          <form action={deleteArticle} className="ml-auto">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="rounded-md border border-line px-4 py-2 text-sm text-red-700"
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
