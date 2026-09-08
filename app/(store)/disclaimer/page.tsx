import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PRODUCT } from "@/config/funnel";
import { legalName } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Product disclaimer",
  description: "What this product is sold as, what it is not, and the limits of what we can be responsible for.",
  path: "/disclaimer",
});

/**
 * The compliance page. This is the single place the product framing is stated
 * in full; /terms clause 3 and the footer line in config/brand.ts are short
 * forms of it and must not contradict it.
 *
 * Nothing here may state or imply a therapeutic use — the same rule that
 * governs config/faq.ts. Adding one turns an unlicensed reagent into an
 * unlicensed medicinal product under the Human Medicines Regulations 2012,
 * which is a criminal offence, not a copy problem.
 */
export default function DisclaimerPage() {
  return (
    <LegalPage
      path="/disclaimer"
      title="Product disclaimer"
      intro="Read this before ordering. It sets out exactly what we sell, and what we do not."
      sections={[
        {
          heading: "What we sell",
          body: (
            <>
              <p>
                {legalName()} supplies {PRODUCT.name} in a {PRODUCT.size}. {PRODUCT.composition}
              </p>
              <p>
                It is sold as a <strong>laboratory reagent</strong>:{" "}
                {PRODUCT.use.charAt(0).toLowerCase() + PRODUCT.use.slice(1)} It is a diluent. It has
                no activity of its own, and it is not sold on the basis that it will achieve any
                particular result.
              </p>
            </>
          ),
        },
        {
          heading: "Research and laboratory use only",
          body: (
            <>
              <p>
                <strong>
                  This product is supplied strictly for laboratory and research use. It is not
                  supplied for human or veterinary use, and it must not be administered to any human
                  or animal.
                </strong>
              </p>
              <p>
                By ordering, you confirm that you are acquiring the product for laboratory or
                research purposes only, that you will not administer it to any person or animal, and
                that you will not supply it to anyone you know or suspect intends to do so.
              </p>
            </>
          ),
        },
        {
          heading: "Not a medicine and not a medical device",
          body: (
            <>
              <p>The product is not, and is not offered as:</p>
              <ul>
                <li>
                  a <strong>medicinal product</strong> &mdash; it holds no marketing authorisation
                  under the Human Medicines Regulations 2012 and has not been assessed by the MHRA;
                </li>
                <li>
                  a <strong>medical device</strong> &mdash; it is not UKCA or CE marked under the
                  Medical Devices Regulations 2002;
                </li>
                <li>
                  a <strong>food, food supplement or cosmetic</strong> within the meaning of the
                  legislation governing those categories.
                </li>
              </ul>
              <p>
                We make <strong>no therapeutic, diagnostic, preventative, curative or nutritional
                claim</strong> about this product, and none should be inferred from anything on this
                website, in our emails, or in any correspondence with us. Nothing we publish is
                medical, clinical, scientific, veterinary or professional advice, and none of it
                should be relied on as a substitute for advice from a qualified professional.
              </p>
            </>
          ),
        },
        {
          heading: "Your responsibility",
          body: (
            <>
              <p>You are solely responsible for:</p>
              <ul>
                <li>
                  deciding whether the product is suitable for your intended purpose, and satisfying
                  yourself of that before ordering;
                </li>
                <li>
                  the competence, training and supervision of anyone who handles it on your behalf;
                </li>
                <li>
                  carrying out your own risk assessment, including under the Control of Substances
                  Hazardous to Health Regulations 2002 where they apply to you;
                </li>
                <li>
                  holding any licence, permit or institutional approval your use requires, and
                  complying with every law and regulation that applies to you; and
                </li>
                <li>
                  storing, handling and disposing of the product and its packaging in accordance with
                  its labelling and applicable waste rules.
                </li>
              </ul>
              <p>
                If you are unsure about any of the above, do not order. Requirements differ by
                country; you are responsible for the law that applies where you are, including any
                import restriction.
              </p>
            </>
          ),
        },
        {
          heading: "Product information and specification",
          body: (
            <p>
              We take care to describe the product accurately, but images are illustrative, and
              packaging, labelling and batch details may change. Where a specification, storage
              condition, shelf life or certificate of analysis matters to you, rely on the
              information printed on the vial and its labelling, and on any certificate we supply
              with the batch &mdash; not on this website. If a delivered batch does not match the
              description we gave, that is a fault, and your rights are set out in our{" "}
              <Link href="/returns">returns and refunds policy</Link>.
            </p>
          ),
        },
        {
          heading: "Limits of our responsibility",
          body: (
            <>
              <p>
                We accept no liability of any kind for loss, injury, damage or expense arising from
                use of the product other than as described on this page &mdash; including, without
                limitation, from administering it to any human or animal, from use by a person who
                is not competent to handle it, or from use in breach of any law or licence that
                applies to you.
              </p>
              <p>
                <strong>Nothing on this page limits our liability</strong> for death or personal
                injury caused by our negligence, for fraud, for defective products under Part I of
                the Consumer Protection Act 1987, or for anything else that cannot lawfully be
                limited. The full liability position, including your statutory rights as a consumer,
                is in clause 10 of our <Link href="/terms">terms and conditions</Link>.
              </p>
            </>
          ),
        },
        {
          heading: "Reporting a problem",
          body: (
            <p>
              If you believe a product we supplied is defective, contaminated, mislabelled or unsafe,
              stop using it and tell us immediately through our{" "}
              <Link href="/contact">contact page</Link>. Please keep the vial, its packaging and its
              batch identifier &mdash; we cannot investigate a batch we cannot identify. We take
              reports of this kind seriously and will respond to them ahead of anything else.
            </p>
          ),
        },
      ]}
    />
  );
}
