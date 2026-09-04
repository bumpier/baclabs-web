import raw from "@/config/reviews.json";

/**
 * Customer reviews, loaded from config/reviews.json.
 *
 * The file ships EMPTY and everything downstream — the section, the rating
 * summary, the Review and AggregateRating structured data — renders nothing
 * until it is populated with real reviews you actually received.
 *
 * Do not seed this with examples. Fabricated reviews are unlawful in the UK
 * under the Digital Markets, Competition and Consumers Act 2024, and Google
 * penalises AggregateRating that does not correspond to visible reviews.
 */
export interface Review {
  author: string;
  /** 1–5. */
  rating: number;
  title: string;
  body: string;
  /** ISO date, YYYY-MM-DD. */
  datePublished: string;
}

function isReview(v: unknown): v is Review {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.author === "string" &&
    r.author.length > 0 &&
    typeof r.rating === "number" &&
    r.rating >= 1 &&
    r.rating <= 5 &&
    typeof r.title === "string" &&
    typeof r.body === "string" &&
    typeof r.datePublished === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.datePublished)
  );
}

/** Malformed entries are dropped rather than half-rendered. */
export const REVIEWS: Review[] = (Array.isArray(raw) ? raw : []).filter(isReview);

export const HAS_REVIEWS = REVIEWS.length > 0;

/** Mean rating to one decimal place, or null when there are no reviews. */
export function averageRating(): number | null {
  if (!HAS_REVIEWS) return null;
  const sum = REVIEWS.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / REVIEWS.length) * 10) / 10;
}
