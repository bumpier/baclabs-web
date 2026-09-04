import { REVIEWS, HAS_REVIEWS, averageRating } from "@/lib/reviews";

/**
 * Renders NOTHING until config/reviews.json contains real reviews.
 *
 * No placeholder, no "be the first to review", no empty-state star row — an
 * empty reviews section still implies a review system with nothing good in
 * it, and a star outline still reads as a rating.
 */
export function Reviews() {
  if (!HAS_REVIEWS) return null;

  const avg = averageRating();

  return (
    <section className="section" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-2xl">
        What customers say
      </h2>

      {avg !== null ? (
        <p className="mt-2 text-sm text-ink-soft">
          <span className="tabular font-semibold text-ink">{avg.toFixed(1)}</span> out of 5, from{" "}
          <span className="tabular">{REVIEWS.length}</span>{" "}
          {REVIEWS.length === 1 ? "review" : "reviews"}
        </p>
      ) : null}

      <ul className="mt-8 space-y-8">
        {REVIEWS.map((r, i) => (
          <li key={i} className="border-t border-line pt-6">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-base font-semibold text-ink">{r.title}</h3>
              <span className="tabular shrink-0 text-sm text-ink-soft">{r.rating}/5</span>
            </div>
            <p className="measure mt-2 text-base text-ink-soft">{r.body}</p>
            <p className="mt-2 text-sm text-ink-soft">
              {r.author} ·{" "}
              <time dateTime={r.datePublished}>
                {new Date(r.datePublished).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
