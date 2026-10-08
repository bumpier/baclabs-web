import Link from "next/link";
import { FACTS } from "@/content/facts";
import { contentHref } from "@/lib/blog-migration";

/**
 * "What is bacteriostatic water?", below the buy section and the pack grid
 * rather than above or beside the buy box. The buy section is the photo,
 * the specification and the buy box, nothing else.
 *
 * The definition is the passage an answer engine lifts: definition,
 * mechanism, the "not a steriliser" caveat and the laboratory-only use, in
 * that order. Every figure is read from content/facts.ts. The heading is a
 * question because that is the query it answers.
 */
export function AboutProduct() {
  return (
    <section id="what-is" className="section scroll-mt-24 pt-0" aria-labelledby="what-heading">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <h2 id="what-heading" className="text-3xl sm:text-4xl">
            What is bacteriostatic water?
          </h2>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <p className="measure text-lg text-ink-soft" data-explainer>
            Bacteriostatic water is sterile, purified water to which a bacteriostatic preservative has been
            added. It is supplied in a sealed multi-dose vial with a rubber stopper and a crimped collar. The
            preservative inhibits the growth of bacteria that may enter the vial once the stopper has been
            punctured, which is why the same vial can be entered more than once, for up to {FACTS.openedLimit}.
            Plain sterile water contains no preservative and is single-use once opened; that one ingredient is
            the whole difference between the two. The preservative is bacteriostatic, not bactericidal: it
            slows bacterial growth but does not sterilise the contents and cannot make a contaminated vial
            safe. It is used as a diluent and solvent to dissolve or dilute substances in laboratory and
            research work, and has no activity of its own. It is not a medicine.
          </p>
          <p className="mt-5 text-sm text-ink-soft">
            <Link href={contentHref("/guides/what-is-bacteriostatic-water")} className="link">
              Read the full guide
            </Link>
            {" · "}
            <Link href={contentHref("/guides/bacteriostatic-water-vs-sterile-water")} className="link">
              How it compares with sterile water and saline
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
