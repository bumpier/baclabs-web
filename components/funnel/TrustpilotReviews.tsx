import { brand } from "@/config/brand";
import { TrustBox } from "@/components/funnel/TrustBox";

/**
 * The home page's Trustpilot block. Until brand.trustpilot.showRating is
 * switched on it shows only the Review Collector, a button with no score, so a
 * new profile's 0.0 TrustScore is never put in front of shoppers.
 *
 * The copy asks neutrally and offers nothing: Trustpilot removes incentivised
 * reviews, and an incentivised review that does not say so is a fake review
 * under the DMCC Act 2024.
 */
export function TrustpilotReviews() {
  const { businessUnitId, showRating } = brand.trustpilot;
  if (!businessUnitId) return null;

  return (
    <section className="section" aria-labelledby="trustpilot-heading">
      <h2 id="trustpilot-heading" className="text-2xl">
        {showRating ? "Reviewed on Trustpilot" : "Bought from us?"}
      </h2>
      <p className="measure mt-2 text-base text-ink-soft">
        {showRating
          ? "Every review is published by Trustpilot, not by us."
          : "Tell other buyers how it went, good or bad. Reviews are posted on Trustpilot, not edited by us."}
      </p>
      <div className="mt-6 max-w-md">
        {showRating ? (
          <TrustBox template="mini" height="150px" />
        ) : (
          <TrustBox template="reviewCollector" height="52px" />
        )}
      </div>
    </section>
  );
}
