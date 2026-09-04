import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import {
  DAMAGE_REPORT_DAYS,
  RETURNS_ADDRESS,
  isSet,
  legalName,
  supportEmail,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Returns and refunds",
  description: "Your right to cancel, how to return an order, and how refunds are handled.",
  alternates: { canonical: "/returns" },
};

/**
 * Returns policy for a UK distance-selling retailer.
 *
 * ⚠ Clause 2 relies on the sealed-goods exception in reg. 28(3)(b) of the
 * Consumer Contracts (Information, Cancellation and Additional Charges)
 * Regulations 2013 — goods "sealed for health protection or hygiene reasons"
 * which are unsealed after delivery. That is the standard position for a
 * sterile sealed vial and is the reason the policy can be written this way at
 * all, but it is a legal judgement about THIS product, not a drafting choice.
 * Have a solicitor confirm it applies before this page takes a real order.
 */
export default function ReturnsPage() {
  const email = supportEmail();

  const contactLine = email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <Link href="/contact">our contact page</Link>
  );

  const hasReturnsAddress = isSet(RETURNS_ADDRESS);

  return (
    <LegalPage
      title="Returns and refunds"
      intro="How to cancel an order, what happens if something arrives damaged, and how we refund you."
      sections={[
        {
          heading: "Your right to cancel",
          body: (
            <>
              <p>
                If you are a consumer, the Consumer Contracts (Information, Cancellation and
                Additional Charges) Regulations 2013 give you the right to cancel a distance
                contract within <strong>14 days</strong>, without giving any reason.
              </p>
              <p>
                The cancellation period ends 14 days after the day on which you, or a person you
                nominated other than the carrier, take physical possession of the goods. Where an
                order is delivered in more than one consignment, it ends 14 days after the day you
                receive the last consignment.
              </p>
              <p>
                This right is separate from, and in addition to, your rights if something is faulty
                &mdash; see clause 4.
              </p>
            </>
          ),
        },
        {
          heading: "The exception for sealed goods",
          body: (
            <>
              <p>
                Each vial is supplied <strong>sealed for health protection and hygiene reasons</strong>.
                Under regulation 28(3)(b) of those Regulations, the right to cancel does not apply to
                goods sealed for health protection or hygiene reasons which have been unsealed after
                delivery.
              </p>
              <p>
                In practice this means: <strong>a vial whose seal is intact may be returned</strong> under
                clause 1; <strong>a vial that has been opened, punctured, or whose tamper-evident
                seal has been broken cannot be</strong>, and we cannot refund it. We cannot verify
                the sterility of a vial that has left our control and been unsealed, and we will not
                resell one.
              </p>
              <p>
                This exception does not affect your rights if the product is faulty, damaged, or not
                as described. Those rights apply whether or not the vial has been opened.
              </p>
            </>
          ),
        },
        {
          heading: "How to cancel, and returning the goods",
          body: (
            <>
              <p>
                To cancel, tell us clearly before the 14-day period ends. Email {contactLine} with
                your order number, your name, your address, and a statement that you are cancelling.
                A phone call or an ambiguous message is not enough &mdash; put it in writing so both
                of us have a record of the date. You may use the model cancellation form in Schedule
                3 of the Regulations, but you do not have to.
              </p>
              {hasReturnsAddress ? (
                <>
                  <p>
                    After telling us, send the goods back <strong>within 14 days</strong>, unopened,
                    with seals intact, and in their original packaging where possible. Send them to:
                  </p>
                  <p>{RETURNS_ADDRESS}</p>
                </>
              ) : (
                <p>
                  After telling us, send the goods back <strong>within 14 days</strong>, unopened,
                  with seals intact, and in their original packaging where possible. We will confirm
                  the return address in writing when we acknowledge your cancellation, and the
                  14 days run from the day we give it to you. Please wait for it rather than sending
                  the parcel to any other address.
                </p>
              )}
              <p>
                <strong>You pay the cost of returning the goods</strong>, and you are responsible for
                them until we receive them. We recommend a tracked service and keeping proof of
                postage; without it, we may be unable to refund a parcel that does not arrive. You are
                liable for any reduction in the value of the goods caused by handling them beyond
                what is necessary to establish their nature and characteristics, and we may deduct
                that amount from your refund.
              </p>
            </>
          ),
        },
        {
          heading: "Faulty, damaged or incorrect items",
          body: (
            <>
              <p>
                Under the Consumer Rights Act 2015 the goods we supply must be of satisfactory
                quality, fit for purpose and as described. If they are not, you have the right to:
              </p>
              <ul>
                <li>
                  <strong>reject them and get a full refund</strong> within 30 days of delivery (the
                  short-term right to reject);
                </li>
                <li>
                  a <strong>repair or replacement</strong> after those 30 days; and
                </li>
                <li>
                  a <strong>refund, in whole or in part</strong>, if a repair or replacement is
                  unsuccessful, or cannot be provided within a reasonable time and without
                  significant inconvenience to you.
                </li>
              </ul>
              <p>
                If your order arrives damaged, incomplete, or is not what you ordered, tell us within{" "}
                {DAMAGE_REPORT_DAYS} days of delivery. Please include your order number, a
                description of the problem, and photographs of the item and its outer packaging
                &mdash; including any damage to the box, which is what we need to raise a claim with
                the carrier. Do not discard the packaging until the claim is settled.
              </p>
              <p>
                We will not ask you to return a broken or leaking vial where doing so is impractical
                or unsafe. Reporting after {DAMAGE_REPORT_DAYS} days does not remove your statutory
                rights, but it may make a transit-damage claim harder to evidence.
              </p>
            </>
          ),
        },
        {
          heading: "Orders that do not arrive",
          body: (
            <p>
              If your order has not arrived, contact us and we will investigate with the carrier. If
              the goods are lost in transit they remain at our risk, and we will resend or refund at
              your choice. Where the carrier records a delivery that you did not receive, we will
              raise the matter with them; that process can take up to 14 days and we will keep you
              updated. Deliveries that fail because the address you supplied was wrong or incomplete,
              or because the parcel went unclaimed, are not our responsibility, though we will always
              try to help.
            </p>
          ),
        },
        {
          heading: "How and when we refund",
          body: (
            <>
              <p>
                Where you have cancelled under clause 1, we refund within{" "}
                <strong>14 days</strong> of the day we receive the goods back, or of the day you
                supply evidence of having sent them, whichever is earlier. Where you have not yet
                received the goods, we refund within 14 days of the day you told us you were
                cancelling. Refunds for faulty goods are made without undue delay once we have
                agreed the fault.
              </p>
              <p>
                We refund the price you paid for the goods and the basic cost of delivery to you, if
                any was charged. Where you chose a more expensive delivery option than our standard
                one, we refund only the standard cost. We do not refund the cost of returning the
                goods to us.
              </p>
              <p>
                Refunds go back to the payment method you used and no other. Card, Apple Pay and
                Google Pay refunds are issued through Stripe and typically appear on your statement
                within 5 to 10 working days, depending on your bank &mdash; that part is outside our
                control. We do not charge a restocking or administration fee.
              </p>
              <p>
                Cryptocurrency payments cannot be reversed. Where an order paid in cryptocurrency is
                refunded, we return the equivalent amount to a wallet address you confirm to us in
                writing, and we are not responsible for any change in exchange rate between payment
                and refund, or for a refund sent to an address you gave us incorrectly.
              </p>
            </>
          ),
        },
        {
          heading: "If you are a business customer",
          body: (
            <p>
              The rights in clauses 1 to 3 are consumer rights and do not apply to purchases made in
              the course of a business. Business customers may return goods only with our prior
              written agreement, and we may apply a restocking charge. Nothing in this clause affects
              a business customer&rsquo;s remedies where goods are not of satisfactory quality or do
              not correspond with their description. Our full terms for business customers are in
              our <Link href="/terms">terms and conditions</Link>.
            </p>
          ),
        },
        {
          heading: "Complaints",
          body: (
            <p>
              If you are unhappy with how a return or refund has been handled, contact us at{" "}
              {contactLine} and we will look into it. Your statutory rights against{" "}
              {legalName()} are unaffected by anything in this policy. Our complaints process is set
              out in clause 12 of our <Link href="/terms">terms and conditions</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
