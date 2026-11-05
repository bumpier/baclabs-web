import { SignupForm } from "@/components/commerce/SignupForm";
import { brand, STOREFRONT } from "./site";
import { BuySection } from "./BuySection";

/**
 * A placeholder home page until the brand's design lands: the brand's name,
 * a buy section (#buy, where a checkout that is abandoned returns to) and,
 * when the brand runs a list, the signup. Enough to test the funnel end to
 * end; the design replaces all of it.
 *
 * Photographs, when the design adds them: files in public/<id>/, drawn
 * through next/image only with a loader of the brand's own over widths made
 * ahead with sharp (or unoptimized with a srcSet), never its default loader.
 * The default sends them through /_next/image, which fetches the file
 * without the brand's Host, misses the host rewrite and answers 400.
 * deploy/NEW-BRAND.md "Images" has the pattern; npm run check:brands fails
 * a file that leaves next/image on the default.
 */
export default function Home() {
  const list = STOREFRONT.mailingList;
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-5xl text-ink">{brand.name}</h1>
      <p className="mt-4 text-lg text-ink-soft">10ml bacteriostatic water, supplied as a laboratory reagent.</p>

      <BuySection />

      {list ? (
        <section aria-labelledby="list-heading" className="mt-16">
          <h2 id="list-heading" className="font-display text-2xl text-ink">
            Mailing list
          </h2>
          <div className="mt-4">
            <SignupForm config={{ consentText: list.consentText }} source="inline" />
          </div>
        </section>
      ) : null}
    </main>
  );
}
