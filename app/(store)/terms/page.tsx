import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { brand } from "@/config/brand";
import { MAX_QUANTITY, PRODUCT, VAT, formatMinor } from "@/config/funnel";
import { COMPLAINT_ACK_DAYS, isSet, legalName, supportEmail } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Terms and conditions",
  description: "The terms on which we sell bacteriostatic water, and the terms of use of this site.",
  path: "/terms",
});

/**
 * Terms of sale for a UK distance-selling retailer, plus the website terms of
 * use. Statutory references are to the law of England and Wales.
 *
 * Two clauses are commercial decisions rather than drafting, and are pulled
 * from config so they cannot contradict the storefront: the VAT statement
 * (config/funnel.ts) and the order cap (MAX_QUANTITY).
 */
export default function TermsPage() {
  const { company } = brand;
  const email = supportEmail();

  return (
    <LegalPage
      path="/terms"
      title="Terms and conditions"
      intro="The terms on which we sell to you, and the terms on which you may use this website."
      sections={[
        {
          heading: "About us and these terms",
          body: (
            <>
              <p>
                These terms and conditions (the <strong>&ldquo;Terms&rdquo;</strong>) set out the
                basis on which {legalName()} (<strong>&ldquo;we&rdquo;</strong>,{" "}
                <strong>&ldquo;us&rdquo;</strong>, <strong>&ldquo;our&rdquo;</strong>) supplies the
                products listed on this website (the <strong>&ldquo;Site&rdquo;</strong>) to you.
                They apply to every order you place, to the exclusion of any other terms you seek to
                impose.
              </p>
              <p>
                By placing an order you confirm that you have read, understood and accept these
                Terms and the{" "}
                <Link href="/disclaimer">product disclaimer</Link>. Please save or print a copy for
                your records; we do not file a copy of the contract on your behalf. These Terms are
                available only in English, and the contract will be concluded in English.
              </p>
              <h3>Our details</h3>
              {/* Each row renders only when config/brand.ts supplies it. An
                  unsupplied detail is omitted, never marked up — a customer
                  must not read a placeholder as a term. */}
              <dl>
                {isSet(company.legalName) ? (
                  <>
                    <dt>Registered name</dt>
                    <dd>{company.legalName}</dd>
                  </>
                ) : null}
                {isSet(company.companyNumber) ? (
                  <>
                    <dt>Company number</dt>
                    <dd>Registered in England &amp; Wales, no. {company.companyNumber}</dd>
                  </>
                ) : null}
                {isSet(company.registeredAddress) ? (
                  <>
                    <dt>Registered office</dt>
                    <dd>{company.registeredAddress}</dd>
                  </>
                ) : null}
                {isSet(company.vatNumber) ? (
                  <>
                    <dt>VAT number</dt>
                    <dd>{company.vatNumber}</dd>
                  </>
                ) : null}
                <dt>Contact</dt>
                <dd>
                  {email ? <a href={`mailto:${email}`}>{email}</a> : null}
                  {email ? ", or see " : "See "}
                  our <Link href="/contact">contact page</Link>.
                </dd>
              </dl>
            </>
          ),
        },
        {
          heading: "Eligibility to order",
          body: (
            <>
              <p>By placing an order you represent and warrant that:</p>
              <ul>
                <li>you are at least 18 years old and have legal capacity to enter a contract;</li>
                <li>
                  where you order on behalf of a business or institution, you are authorised to bind
                  it, and it &mdash; not you &mdash; is our customer;
                </li>
                <li>
                  the information you give us, including your name and delivery address, is accurate
                  and complete; and
                </li>
                <li>
                  you will use the product only as described in clause 3 and in the{" "}
                  <Link href="/disclaimer">product disclaimer</Link>.
                </li>
              </ul>
              <p>
                We do not knowingly sell to anyone under 18. We may refuse, limit or cancel any
                order at our discretion, including where we have reasonable grounds to believe an
                order is fraudulent, is for resale without our consent, or is intended for a use we
                do not supply the product for.
              </p>
            </>
          ),
        },
        {
          heading: "What the product is, and what it is not",
          body: (
            <>
              <p>
                We sell {PRODUCT.name} in a {PRODUCT.size}. {PRODUCT.composition} It is supplied as
                a laboratory reagent: {PRODUCT.use.charAt(0).toLowerCase() + PRODUCT.use.slice(1)}
              </p>
              <p>
                <strong>
                  The product is not a medicine and is not a medical device.
                </strong>{" "}
                It is not authorised under the Human Medicines Regulations 2012, is not
                CE/UKCA-marked under the Medical Devices Regulations 2002, and is not a food,
                cosmetic or supplement. We make no therapeutic, diagnostic, preventative or
                nutritional claim of any kind, and nothing on the Site should be read as one.
              </p>
              <p>
                You are solely responsible for determining whether the product is suitable for your
                intended purpose, for the competence of the people who handle it, and for complying
                with every law, regulation, licence and institutional rule that applies to your use
                of it. If you are in any doubt, do not order. The full position is set out in the{" "}
                <Link href="/disclaimer">product disclaimer</Link>, which forms part of these Terms.
              </p>
            </>
          ),
        },
        {
          heading: "How a contract is formed",
          body: (
            <>
              <ol>
                <li>
                  The listings on the Site are an invitation to treat. They are not an offer to sell
                  and we are not obliged to accept any order.
                </li>
                <li>
                  Your order is an offer to buy on these Terms. Before submitting it you can review
                  and correct it on the checkout page.
                </li>
                <li>
                  Any acknowledgement we send confirms that we have received your order. It is not
                  acceptance of it.
                </li>
                <li>
                  The contract is formed only when we send you a dispatch confirmation. Until then
                  no contract exists between us, whether or not payment has been taken.
                </li>
                <li>
                  If we cannot accept your order &mdash; because the product is out of stock, because
                  a price or description was wrong, because we could not authorise payment, or for
                  any other reason &mdash; we will tell you and refund any sum paid in full. That
                  refund is the limit of our liability in those circumstances.
                </li>
              </ol>
              <p>
                A single order may contain no more than {MAX_QUANTITY} units of any one bundle. For
                larger volumes, please contact us before ordering.
              </p>
            </>
          ),
        },
        {
          heading: "Price and payment",
          body: (
            <>
              <p>
                Prices are in pounds sterling and are those displayed on the Site at the time you
                place your order. The current single-vial price is{" "}
                {formatMinor(PRODUCT.unitPriceMinor)}. Any charge additional to the product price is
                shown to you at checkout before you commit to pay; you will never be charged a sum
                you have not seen first.
              </p>
              {/* Renders only when config/funnel.ts states a VAT position.
                  Silence is correct where none is set; a placeholder is not. */}
              {isSet(VAT.statement) ? <p>{VAT.statement}</p> : null}
              <p>
                Payment is taken in full at the time you place your order, by card, Apple Pay or
                Google Pay, on Stripe&rsquo;s own hosted checkout page. Your card details are entered
                on Stripe&rsquo;s page and are never transmitted to, or stored by, us. Your bank may
                apply its own authentication step, and we cannot complete an order it declines.
              </p>
              <p>
                We take reasonable care over pricing, but errors occur. If the correct price at the
                date of your order is higher than the price stated, we will contact you for
                instructions before dispatching. If a pricing error is obvious and could reasonably
                have been recognised by you as a mis-pricing, we may cancel the order, refund you in
                full, and no contract will arise.
              </p>
            </>
          ),
        },
        {
          heading: "Risk and ownership",
          body: (
            <>
              <p>
                Risk in the product passes to you when it is delivered to the address you gave us,
                or to a person you nominated to take delivery. Ownership passes when we have received
                payment in full.
              </p>
              <p>
                Unless we agree a longer period with you, we will pass the product to the carrier
                without undue delay and in any event within 30 days of the date the contract is
                formed, as required by the Consumer Rights Act 2015. If we do not, you may treat the
                contract as at an end and we will refund you in full.
              </p>
              <p>
                Once the product has been delivered, storing and handling it correctly is your
                responsibility. We are not liable for deterioration caused by storage or handling
                after delivery.
              </p>
            </>
          ),
        },
        {
          heading: "Cancellation, returns and refunds",
          body: (
            <>
              <p>
                If you are a consumer you have a statutory right to cancel a distance contract under
                the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations
                2013, and separate statutory remedies under the Consumer Rights Act 2015 if the
                product is faulty, damaged or not as described.
              </p>
              <p>
                How to exercise those rights, the exception we rely on for sealed goods, and how and
                when we refund, are set out in full in our{" "}
                <Link href="/returns">returns and refunds policy</Link>, which forms part of these
                Terms. Nothing in these Terms or in that policy limits your statutory rights.
              </p>
            </>
          ),
        },
        {
          heading: "Your obligations and acceptable use",
          body: (
            <>
              <p>You agree that you will not:</p>
              <ul>
                <li>
                  administer the product to any human or animal, or supply it to anyone you know or
                  suspect intends to do so;
                </li>
                <li>
                  represent, in any forum, that the product is a medicine, a medical device, or
                  suitable for any therapeutic, diagnostic or clinical purpose;
                </li>
                <li>
                  resell, repackage, relabel, decant or otherwise distribute the product without our
                  prior written consent, or in breach of any law that applies to you;
                </li>
                <li>use the product for any unlawful purpose, or in breach of any licence or permit;</li>
                <li>
                  remove, obscure or alter any labelling, batch identifier, expiry marking or
                  safety information; or
                </li>
                <li>
                  fail to store, handle and dispose of the product and its packaging in accordance
                  with the product labelling and applicable waste rules.
                </li>
              </ul>
              <p>
                If you are a business customer, you indemnify us against all liabilities, costs and
                reasonable legal fees we incur arising from your breach of this clause. This
                indemnity does not apply to consumers.
              </p>
            </>
          ),
        },
        {
          heading: "Use of this website",
          body: (
            <>
              <p>
                We grant you a limited, revocable, non-exclusive licence to view the Site for the
                purpose of considering and placing an order. All content on the Site &mdash; text,
                layout, graphics, photography, the {brand.name} name and logo &mdash; is owned by us
                or our licensors and is protected by copyright and trade mark law. You may not
                reproduce, republish or exploit it commercially without our written consent.
              </p>
              <p>You must not:</p>
              <ul>
                <li>
                  scrape, harvest, systematically download or mirror any part of the Site, or use it
                  to build any product, dataset or model;
                </li>
                <li>
                  attempt to gain unauthorised access to the Site, its servers, or any account,
                  or introduce any malicious code; or
                </li>
                <li>
                  interfere with the availability of the Site, including by any denial-of-service or
                  automated request flooding.
                </li>
              </ul>
              <p>
                Content on the Site is general information about what we sell. It is not scientific,
                medical, legal or professional advice, and must not be relied on as such. We may
                change, suspend or withdraw the Site, or any part of it, without notice.
              </p>
            </>
          ),
        },
        {
          heading: "Our liability to you",
          body: (
            <>
              <p>
                <strong>Nothing in these Terms excludes or limits our liability</strong> for death or
                personal injury caused by our negligence, for fraud or fraudulent misrepresentation,
                for defective products under Part I of the Consumer Protection Act 1987, or for any
                other liability that cannot lawfully be excluded or limited.
              </p>
              <h3>If you are a consumer</h3>
              <p>
                We are responsible for loss or damage you suffer that is a foreseeable result of our
                breach of these Terms or our failure to use reasonable care and skill. Loss or damage
                is foreseeable if it is obvious that it will happen, or if it was contemplated by
                both of us at the time the contract was formed. We are not responsible for
                unforeseeable loss or damage, nor for any business loss &mdash; we supply to
                consumers for private use, and if you use the product for any commercial, business or
                resale purpose we have no liability to you for loss of profit, loss of business,
                business interruption or loss of business opportunity.
              </p>
              <h3>If you are a business customer</h3>
              <p>
                Subject to the paragraph above, our total liability to you arising under or in
                connection with a contract, whether in contract, tort (including negligence),
                breach of statutory duty or otherwise, is limited to the price you paid for the
                products giving rise to the claim. We are not liable for loss of profit, loss of
                sales, revenue or business, loss of or corruption of data, loss of anticipated
                savings, loss of goodwill, or any indirect or consequential loss.
              </p>
              <h3>Use outside the intended purpose</h3>
              <p>
                We accept no liability of any kind for loss, injury or damage arising from use of the
                product otherwise than as described in clause 3 and the{" "}
                <Link href="/disclaimer">product disclaimer</Link> &mdash; including, without
                limitation, any administration of the product to a human or an animal.
              </p>
            </>
          ),
        },
        {
          heading: "Events outside our control",
          body: (
            <p>
              We are not liable for any failure or delay in performing our obligations where that
              failure or delay results from an event beyond our reasonable control, including
              carrier failure or industrial action, supplier or manufacturer failure, epidemic,
              flood, fire, extreme weather, act of terrorism, war, failure of public or private
              telecommunications networks, or an act or restriction of any government or public
              authority. If such an event occurs we will contact you as soon as we can. If it
              continues for more than 30 days, either of us may cancel the affected order and we will
              refund you in full.
            </p>
          ),
        },
        {
          heading: "Complaints and disputes",
          body: (
            <>
              <p>
                If something has gone wrong, please tell us first &mdash; most problems are resolved
                quickly. Contact details are on our <Link href="/contact">contact page</Link>. We aim
                to acknowledge every complaint within {COMPLAINT_ACK_DAYS} working days and to
                resolve it within 14 days, telling you if it will take longer and why.
              </p>
              <p>
                If we cannot resolve your complaint between us, you may be able to refer it to an
                alternative dispute resolution provider, or to take court proceedings. We are not
                obliged to use, and do not currently subscribe to, any ADR scheme. Referring a
                complaint to ADR does not affect your right to bring a claim in court.
              </p>
            </>
          ),
        },
        {
          heading: "Data protection",
          body: (
            <p>
              We use the personal information you give us to process your order, to take payment,
              to deliver the product, and to meet our record-keeping obligations. How we do that,
              the lawful bases we rely on, who we share the information with, and the rights you
              have over it, are set out in our <Link href="/privacy">privacy policy</Link>.
            </p>
          ),
        },
        {
          heading: "Changes to these terms",
          body: (
            <p>
              We may amend these Terms from time to time. The version that applies to your order is
              the version published on the Site at the moment you place it, so an amendment never
              changes the terms of an order you have already placed. Please re-read this page before
              each order.
            </p>
          ),
        },
        {
          heading: "General",
          body: (
            <ol>
              <li>
                <strong>Entire agreement.</strong> These Terms, together with the pages they
                expressly incorporate, are the entire agreement between us in relation to their
                subject matter, and replace any earlier statement or understanding. Nothing in this
                clause limits liability for fraudulent misrepresentation.
              </li>
              <li>
                <strong>Severance.</strong> If any provision is found to be unlawful or
                unenforceable, it is severed and the remaining provisions continue in force.
              </li>
              <li>
                <strong>No waiver.</strong> A delay in enforcing any provision is not a waiver of it,
                and does not prevent us enforcing it, or any other provision, later.
              </li>
              <li>
                <strong>Assignment.</strong> We may transfer our rights and obligations to another
                organisation, and will tell you in writing if we do; your rights under the contract
                will not be affected. You may not transfer your rights or obligations without our
                written consent.
              </li>
              <li>
                <strong>Third parties.</strong> A person who is not a party to the contract has no
                right under the Contracts (Rights of Third Parties) Act 1999 to enforce any of its
                terms.
              </li>
              <li>
                <strong>Notices.</strong> Notices under these Terms may be given by email to the
                address you supplied at checkout, or to our contact address, and are treated as
                received on the next working day after sending.
              </li>
            </ol>
          ),
        },
        {
          heading: "Governing law and jurisdiction",
          body: (
            <p>
              These Terms, their subject matter and their formation are governed by the law of
              England and Wales, and the courts of England and Wales have exclusive jurisdiction. If
              you are a consumer living in Scotland or Northern Ireland, you may also bring
              proceedings in the courts of the country in which you live, and the mandatory consumer
              protection law of that country continues to apply to you.
            </p>
          ),
        },
      ]}
    />
  );
}
