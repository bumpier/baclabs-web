import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { shipsFree } from "@/lib/commerce/view";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { ClinicPicker } from "../ClinicPicker";
import { Basket } from "../Basket";
import { CLINICS } from "@/brands/beauty/copy/clinics";
import { brand, CLINIC_PACKS, STOREFRONT, TRADE_TOPIC } from "../site";

const PATH = "/clinics";

export const metadata: Metadata = pageMetadata({
  title: CLINICS.metaTitle,
  description: CLINICS.metaDescription,
  path: PATH,
  brandId: brand.id,
});

/**
 * The enquiry form's topics, decided on the server (lib/contact.ts must
 * stay out of the browser): the clinic topic first, then a question about
 * the product, then anything else. Orders already placed go through the
 * contact page, which offers every topic.
 */
const TOPICS = (() => {
  const all = brandContactTopics(TRADE_TOPIC ? { trade: TRADE_TOPIC } : {});
  return ["wholesale", "product", "other"].flatMap((id) => all.filter((t) => t.id === id));
})();

/**
 * "For clinics": the larger packs, in a professional register. The packs
 * can be bought here like the Essentials (the same basket, #buy), and
 * anything larger or recurring comes through the enquiry form (#enquire).
 * A link with ?topic=wholesale opens the form on the clinic topic.
 */
export default function ClinicsPage() {
  const onSale = CLINIC_PACKS.filter((p) => p.available);
  const freeDelivery = onSale.length > 0 && onSale.every((p) => shipsFree(STOREFRONT, p.priceMinor));
  const method = STOREFRONT.payment.methods[0] ?? null;
  const enquire = `${PATH}?topic=wholesale#enquire`;

  return (
    <main id="main">
      <JsonLd data={breadcrumbSchema(CLINICS.metaTitle, PATH, brand.id)} />

      <section aria-labelledby="clinics-title" className="mx-auto max-w-6xl px-5 pb-14 pt-10 sm:px-8 md:pb-20 md:pt-14">
        <h1 id="clinics-title" className="au-display max-w-[12ch]">
          {CLINICS.title}
        </h1>
        <p className="au-lead mt-6 max-w-[38rem]">{CLINICS.lead}</p>
        <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          {onSale.length > 0 ? (
            <a href="#order" className="btn-cta">
              {CLINICS.orderTitle}
            </a>
          ) : null}
          {/* A full load, so the form reads the topic from the address. */}
          <a href={enquire} className="au-link inline-flex min-h-11 items-center font-semibold">
            {CLINICS.enquireLink}
          </a>
        </div>
      </section>

      {CLINIC_PACKS.length > 0 ? (
        <section id="buy" aria-labelledby="order" className="au-sheet au-blush scroll-mt-4 px-5 py-14 sm:px-10 md:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 id="order" className="au-h2 scroll-mt-8">
              {CLINICS.orderTitle}
            </h2>
            <div className="mt-10 md:mt-12">
              <ClinicPicker packs={CLINIC_PACKS} freeDelivery={freeDelivery} />
            </div>
            <div className="mt-12 md:grid md:grid-cols-2 md:gap-14">
              <div aria-hidden="true" />
              <Basket />
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="how-title" className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14 md:py-28">
        <h2 id="how-title" className="au-h2">
          {CLINICS.howTitle}
        </h2>
        <dl className="grid gap-9 sm:grid-cols-2 sm:gap-x-10">
          <div>
            <dt className="au-h3">{CLINICS.onlineTerm}</dt>
            <dd className="mt-2 text-ink-soft">{CLINICS.online(method?.label ?? null)}</dd>
          </div>
          <div>
            <dt className="au-h3">{CLINICS.largerTerm}</dt>
            <dd className="mt-2 text-ink-soft">{CLINICS.larger}</dd>
          </div>
          <div>
            <dt className="au-h3">{CLINICS.productTerm}</dt>
            <dd className="mt-2 text-ink-soft">{CLINICS.product}</dd>
          </div>
          <div>
            <dt className="au-h3">{CLINICS.limitTerm}</dt>
            <dd className="mt-2 text-ink-soft">{CLINICS.limit(STOREFRONT.limits.maxVials)}</dd>
          </div>
        </dl>
      </section>

      <section id="enquire" aria-labelledby="enquire-title" className="au-sheet au-on-plum scroll-mt-4 px-6 py-14 sm:px-12 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
          <div>
            <h2 id="enquire-title" className="au-h2">
              {CLINICS.enquireTitle}
            </h2>
            <p className="mt-4 text-[1.1875rem] text-on-plum-soft">{CLINICS.enquireLead}</p>
          </div>
          <ContactForm
            topics={TOPICS}
            complaintAckDays={COMPLAINT_ACK_DAYS}
            messageMax={CONTACT_MESSAGE_MAX}
            classNames={{
              form: "space-y-5",
              label: "label text-on-plum",
              hint: "mt-2 text-[0.9375rem] text-on-plum-soft",
              note: "mt-3 text-[0.875rem] text-on-plum-soft",
              link: "au-link text-on-plum",
              button: "btn-cta",
              sent: "rounded-[1.5rem] bg-plum-raised px-6 py-7",
              sentHeading: "au-h3 outline-none",
              sentText: "mt-2 text-on-plum-soft",
              again: "au-link mt-4 text-[0.9375rem]",
            }}
          />
        </div>
      </section>
    </main>
  );
}
