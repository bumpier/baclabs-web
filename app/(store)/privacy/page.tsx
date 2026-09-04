import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { brand } from "@/config/brand";
import { RECORD_RETENTION_YEARS, isSet, legalName, supportEmail } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal data we collect, why, who we share it with, and your rights.",
  alternates: { canonical: "/privacy" },
};

/**
 * UK GDPR / DPA 2018 / PECR privacy notice.
 *
 * The previous version described affiliate accounts that do not exist and
 * asserted that no tracking cookies were used while shipping a Meta Pixel.
 * This version is written against what the code actually does:
 *
 *  - Cart state is localStorage (components/CartProvider.tsx), not a cookie.
 *  - The only cookie set for a visitor is `admin_session`, and only for staff
 *    signing into /admin (lib/adminAuth.ts).
 *  - Meta Pixel and GA4 load ONLY when NEXT_PUBLIC_META_PIXEL_ID /
 *    NEXT_PUBLIC_GA4_ID are set at BUILD time (components/Analytics.tsx).
 *    No consent banner exists, so those must stay unset until one is built —
 *    the analytics clause below says exactly that.
 *  - Repurchase nudges (app/api/cron/nudges) are marketing, sent under the
 *    PECR soft opt-in with a working unsubscribe (app/api/email/unsubscribe).
 *
 * If any of those change, this page must change with them.
 */
const ANALYTICS_PROVIDERS = [
  process.env.NEXT_PUBLIC_GA4_ID ? "Google Analytics" : null,
  process.env.NEXT_PUBLIC_META_PIXEL_ID ? "the Meta Pixel" : null,
].filter((p): p is string => p !== null);

const ANALYTICS_ENABLED = ANALYTICS_PROVIDERS.length > 0;

/** "A and B", or just "A" — read into a sentence, so no Oxford list. */
const ANALYTICS_PROVIDER_LIST = ANALYTICS_PROVIDERS.join(" and ");

export default function PrivacyPage() {
  const { company } = brand;
  const email = supportEmail();

  const contactLine = email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <Link href="/contact">our contact page</Link>
  );

  return (
    <LegalPage
      title="Privacy policy"
      intro="What we collect, why we collect it, who sees it, and what you can ask us to do about it."
      sections={[
        {
          heading: "Who we are",
          body: (
            <>
              <p>
                {legalName()} is the <strong>data controller</strong> for the personal data described
                in this notice. That means we decide what is collected and why, and we are
                accountable for it under the UK GDPR and the Data Protection Act 2018.
              </p>
              {/* Each row renders only when config/brand.ts supplies it. An
                  unsupplied detail is omitted, never marked up — a customer
                  must not read a placeholder as a statement of fact. */}
              <dl>
                {isSet(company.legalName) ? (
                  <>
                    <dt>Registered name</dt>
                    <dd>{company.legalName}</dd>
                  </>
                ) : null}
                {isSet(company.registeredAddress) ? (
                  <>
                    <dt>Registered office</dt>
                    <dd>{company.registeredAddress}</dd>
                  </>
                ) : null}
                {isSet(company.icoRegistration) ? (
                  <>
                    <dt>ICO registration</dt>
                    <dd>{company.icoRegistration}</dd>
                  </>
                ) : null}
                <dt>How to reach us about data protection</dt>
                <dd>{contactLine}</dd>
              </dl>
              <p>
                We have not appointed a Data Protection Officer; we are not required to. Data
                protection questions go to the contact above.
              </p>
            </>
          ),
        },
        {
          heading: "What we collect",
          body: (
            <>
              <p>We collect only what an order needs. Specifically:</p>
              <dl>
                <dt>Identity and contact data</dt>
                <dd>Your name, email address and, where you give it, your phone number.</dd>
                <dt>Delivery data</dt>
                <dd>
                  The postal address you supply so the order can be sent to you. For card orders this
                  reaches us from Stripe after payment, because the address is collected on
                  Stripe&rsquo;s checkout page rather than ours.
                </dd>
                <dt>Order data</dt>
                <dd>
                  What you bought, the quantity, the price, the currency, the order status, and the
                  dates the order moved between statuses.
                </dd>
                <dt>Payment data</dt>
                <dd>
                  A payment reference from the payment provider, the provider name, and the method
                  used (for example &ldquo;card&rdquo;). <strong>We never receive, see or store your
                  card number, expiry date or security code.</strong>
                </dd>
                <dt>Correspondence</dt>
                <dd>Messages you send us, and our replies.</dd>
                <dt>Email delivery records</dt>
                <dd>
                  Which order emails were sent to which address and when, so we do not send the same
                  message twice.
                </dd>
              </dl>
              <p>
                We do not ask for, and do not want, any special category data &mdash; including
                health data. Please do not send us any.
              </p>
            </>
          ),
        },
        {
          heading: "Why we use it, and our lawful basis",
          body: (
            <>
              <dl>
                <dt>To take and fulfil your order &mdash; performance of a contract</dt>
                <dd>
                  Processing payment, packing, dispatching, and sending order confirmation, dispatch
                  and delivery emails. Without this data we cannot sell to you.
                </dd>
                <dt>To keep accounting and tax records &mdash; legal obligation</dt>
                <dd>
                  We must retain records of what we sold, to whom and for how much, to satisfy HMRC
                  and company law.
                </dd>
                <dt>To answer your questions and handle returns &mdash; legitimate interests</dt>
                <dd>
                  Our interest in running a business that responds to its customers. We have
                  considered your rights and consider this processing unintrusive and expected.
                </dd>
                <dt>To prevent fraud and secure the site &mdash; legitimate interests</dt>
                <dd>
                  Our interest, and yours, in not being defrauded. This includes rate-limiting and
                  checking orders that look anomalous.
                </dd>
                <dt>To send repurchase reminders &mdash; the PECR soft opt-in</dt>
                <dd>See clause 5.</dd>
                <dt>To measure how the site is used &mdash; consent</dt>
                <dd>See clause 6.</dd>
              </dl>
            </>
          ),
        },
        {
          heading: "Payments",
          body: (
            <>
              <p>
                Card, Apple Pay and Google Pay payments are processed by{" "}
                <strong>Stripe Payments Europe, Ltd.</strong> on Stripe&rsquo;s own hosted checkout
                page. Your card details are entered there and never pass through this website. Stripe
                is a separate data controller for the payment data it collects, and processes it
                under its own privacy policy at{" "}
                <a href="https://stripe.com/gb/privacy" rel="noopener noreferrer" target="_blank">
                  stripe.com/gb/privacy
                </a>
                . Stripe returns to us only what we need to fulfil the order: your name, email,
                delivery address and a payment reference.
              </p>
              <p>
                Where cryptocurrency payment is offered, the payment gateway receives the order
                reference and the amount. It does not receive your name, email or address, and we do
                not receive your wallet address except where you give it to us for a refund.
              </p>
            </>
          ),
        },
        {
          heading: "Email we send you",
          body: (
            <>
              <p>
                <strong>Transactional email.</strong> Order confirmation, dispatch and delivery
                notifications are part of fulfilling your order. They are not marketing and you
                cannot opt out of them while an order is live &mdash; you would not know where your
                order was.
              </p>
              <p>
                <strong>Repurchase reminders.</strong> We may email you once, some time after an
                order, to say that your supply is likely running low. This is marketing. We send it
                under the &ldquo;soft opt-in&rdquo; in regulation 22(3) of the Privacy and Electronic
                Communications Regulations 2003: you bought a similar product from us, it is about
                that product, and every such email carries a one-click unsubscribe link. Use it and
                we will record your address on a suppression list and never send you another. You may
                also opt out at any time by emailing {contactLine}.
              </p>
              <p>
                Email is delivered by <strong>Resend</strong>, acting as our processor. We keep a
                record of which emails were sent to which address and when.
              </p>
            </>
          ),
        },
        {
          heading: "Cookies and analytics",
          body: (
            <>
              <p>
                <strong>This site sets no cookies on a shopping visitor&rsquo;s browser.</strong> Your
                basket is held in your own browser&rsquo;s local storage, on your device, and is
                never transmitted to us until you check out. Clearing your browser data clears it.
                The only cookie this site sets is a session cookie for staff signing into the admin
                area, which is strictly necessary and set only after a successful staff login.
              </p>
              {/* ⚠ This build loads analytics, and no consent mechanism exists.
                  PECR requires consent BEFORE a non-essential cookie is set, so
                  the clause below describes what runs but does not cure that:
                  build a consent banner, or unset NEXT_PUBLIC_META_PIXEL_ID and
                  NEXT_PUBLIC_GA4_ID and rebuild. Customer-facing wording must
                  never carry a note to ourselves, which is why this is a code
                  comment and not a marker on the page. */}
              {ANALYTICS_ENABLED ? (
                <p>
                  This build also loads {ANALYTICS_PROVIDER_LIST}, which measure how the site is
                  used. {ANALYTICS_PROVIDERS.length > 1 ? "They set their" : "It sets its"} own
                  cookies and identifiers on your device and{" "}
                  {ANALYTICS_PROVIDERS.length > 1 ? "process" : "processes"} data about your visit
                  under {ANALYTICS_PROVIDERS.length > 1 ? "their" : "its"} own privacy notice. You
                  can block {ANALYTICS_PROVIDERS.length > 1 ? "them" : "it"} with your
                  browser&rsquo;s cookie controls or a content blocker, and clearing your browser
                  data removes what has already been set.
                </p>
              ) : (
                <p>
                  We run no analytics, advertising or tracking scripts on this site. There is no
                  Google Analytics, no Meta Pixel and no advertising cookie. If we ever introduce
                  one, we will ask for your consent first &mdash; PECR requires it &mdash; and update
                  this page before it goes live.
                </p>
              )}
              <p>
                Stripe sets its own cookies on Stripe&rsquo;s checkout page, including for fraud
                prevention. That happens on Stripe&rsquo;s domain and is governed by Stripe&rsquo;s
                privacy policy.
              </p>
            </>
          ),
        },
        {
          heading: "Who we share it with",
          body: (
            <>
              <p>
                We do not sell your personal data, and we never share it for anyone else&rsquo;s
                marketing. We share it only with the organisations that make an order possible:
              </p>
              <ul>
                <li>
                  <strong>Stripe</strong> &mdash; payment processing and refunds.
                </li>
                <li>
                  <strong>Resend</strong> &mdash; sending order and reminder emails.
                </li>
                <li>
                  <strong>Our delivery carrier</strong> &mdash; your name and delivery address, so
                  the parcel can reach you.
                </li>
                <li>
                  <strong>Our hosting provider</strong> &mdash; which stores the site and its
                  database on our behalf.
                </li>
                <li>
                  <strong>Professional advisers and authorities</strong> &mdash; our accountant, and
                  any regulator, court or law enforcement body where we are legally required to
                  disclose.
                </li>
              </ul>
              <p>
                Each of these acts as our processor under a written contract, except Stripe, which is
                a separate controller for payment data. If our business is sold or transferred, your
                data may transfer with it; the buyer would be bound by this notice.
              </p>
            </>
          ),
        },
        {
          heading: "Transfers outside the UK",
          body: (
            <p>
              Some of our providers process data outside the UK, including in the United States.
              Where that happens we rely on the safeguards permitted by Article 46 of the UK GDPR
              &mdash; a UK adequacy decision where one covers the country, or the International Data
              Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses, together
              with a transfer risk assessment. You can ask us for details of the safeguard used for
              any specific transfer.
            </p>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <>
              <dl>
                <dt>Order and payment records</dt>
                <dd>
                  {RECORD_RETENTION_YEARS} years from the end of the financial year the order falls
                  in, because HMRC requires it. We cannot delete these earlier, even on request.
                </dd>
                <dt>Correspondence</dt>
                <dd>
                  Up to 2 years after the matter is closed, so we can pick up a returning question.
                </dd>
                <dt>Email suppression list</dt>
                <dd>
                  Indefinitely. Keeping your address on a do-not-email list is the only way to
                  guarantee we do not email you again.
                </dd>
                <dt>Server and security logs</dt>
                <dd>Typically 30 to 90 days, depending on the provider.</dd>
              </dl>
              <p>
                When a retention period ends we delete the data or irreversibly anonymise it, so what
                remains can no longer identify you.
              </p>
            </>
          ),
        },
        {
          heading: "How we protect it",
          body: (
            <p>
              The site is served over HTTPS. Admin access requires a password and is protected by a
              signed, HTTP-only, secure session cookie, with credentials stored as bcrypt hashes.
              Access to order data is limited to the people who need it to pack and support orders.
              No system is perfectly secure, and we cannot guarantee the security of data in transit
              across the internet, but we will notify you and the ICO where a breach is likely to
              result in a risk to your rights, within 72 hours of becoming aware of it.
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <>
              <p>Under the UK GDPR you have the right to:</p>
              <ul>
                <li>
                  <strong>be informed</strong> about how we use your data &mdash; this notice;
                </li>
                <li>
                  <strong>access</strong> a copy of the data we hold about you;
                </li>
                <li>
                  <strong>rectify</strong> data that is inaccurate or incomplete;
                </li>
                <li>
                  <strong>erasure</strong> of your data, where we have no overriding reason to keep
                  it &mdash; note that tax records are such a reason;
                </li>
                <li>
                  <strong>restrict</strong> our processing while a dispute about accuracy or
                  legitimate interests is resolved;
                </li>
                <li>
                  <strong>data portability</strong> &mdash; to receive the data you gave us in a
                  structured, commonly used, machine-readable format;
                </li>
                <li>
                  <strong>object</strong> to processing based on legitimate interests, and{" "}
                  <strong>to object to direct marketing at any time, absolutely</strong>; and
                </li>
                <li>
                  <strong>withdraw consent</strong> at any time where we rely on it, without
                  affecting processing carried out before you withdrew it.
                </li>
              </ul>
              <p>
                We do not carry out automated decision-making or profiling that produces legal or
                similarly significant effects.
              </p>
              <p>
                To exercise any of these, contact {contactLine}. We respond within one month, and
                will tell you if we need to extend that by up to two further months because the
                request is complex. There is no charge unless a request is manifestly unfounded or
                excessive. We may ask you to confirm your identity first, so that we do not disclose
                your data to someone else.
              </p>
            </>
          ),
        },
        {
          heading: "Complaining to the regulator",
          body: (
            <p>
              If you are unhappy with how we have handled your personal data, please tell us first so
              we can put it right. You also have the right to complain to the Information
              Commissioner&rsquo;s Office at any time &mdash;{" "}
              <a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer" target="_blank">
                ico.org.uk/make-a-complaint
              </a>{" "}
              or 0303 123 1113. Complaining to us first is not a precondition of complaining to them.
            </p>
          ),
        },
        {
          heading: "Children",
          body: (
            <p>
              This site is not intended for anyone under 18 and we do not knowingly collect data
              about children. If you believe a child has given us personal data, contact{" "}
              {contactLine} and we will delete it.
            </p>
          ),
        },
        {
          heading: "Changes to this notice",
          body: (
            <p>
              We update this notice when what we do with personal data changes. The date at the top
              of this page is the date of the current version. Where a change materially affects you
              &mdash; a new purpose, a new recipient, a new lawful basis &mdash; we will tell you
              directly rather than relying on you re-reading this page.
            </p>
          ),
        },
      ]}
    />
  );
}
