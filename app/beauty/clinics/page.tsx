import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { Photo } from "@/brands/beauty/components/Photo";
import { CLINICS } from "@/brands/beauty/copy/clinics";
import { listSizes } from "@/brands/beauty/copy/home";
import { IMAGES } from "@/brands/beauty/copy/images";
import { ClinicPicker } from "../ClinicPicker";
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

/** The form opens on the clinic topic: this page is about one subject. */
const OPENING_TOPIC = TOPICS.find((t) => t.id === "wholesale")?.id;

/**
 * "For clinics and salons": the same four packs in a professional register.
 * The hero and three plain facts; the price list (#buy, the same basket
 * and drawer as everywhere); how clinic orders work; and the enquiry form
 * (#enquire), which opens on the clinic topic by itself, so every link to
 * it is a plain anchor.
 */
export default function ClinicsPage() {
  const onSale = CLINIC_PACKS.filter((p) => p.available);
  const sizes = listSizes(onSale.map((p) => p.vials));
  const method = STOREFRONT.payment.methods[0] ?? null;
  const maxVials = STOREFRONT.limits.maxVials;

  return (
    <main id="main">
      <JsonLd data={breadcrumbSchema(CLINICS.metaTitle, PATH, brand.id)} />

      <section aria-labelledby="clinics-title" className="au-wrap pt-8 md:pt-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="lg:py-10">
            <h1 id="clinics-title" className="au-display max-w-[11ch]">
              {CLINICS.title}
            </h1>
            <p className="au-lead mt-6">{CLINICS.lead(sizes)}</p>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              {onSale.length > 0 ? (
                <a href="#price-list" className="btn-cta">
                  {CLINICS.toPriceList}
                </a>
              ) : null}
              <a href="#enquire" className="au-link inline-flex min-h-11 items-center font-semibold">
                {CLINICS.enquireLink}
              </a>
            </div>
          </div>
          <div className="au-frame aspect-[4/3] lg:aspect-[5/4]">
            <Photo image={IMAGES.clinicCounter} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-[45%_60%]" />
          </div>
        </div>

        <dl className="mt-12 grid gap-5 sm:grid-cols-3 sm:gap-8 lg:mt-16">
          {CLINICS.facts(sizes, maxVials).map((f) => (
            <div key={f.term} className="flex items-baseline gap-3 sm:block">
              <dt className="font-display text-[1.375rem] leading-tight">{f.term}</dt>
              <dd className="au-small sm:mt-1">{f.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {CLINIC_PACKS.length > 0 ? (
        <section id="buy" aria-labelledby="price-list" className="au-sheet au-blush mt-20 px-5 py-14 sm:px-10 lg:mt-28 lg:py-20">
          <div className="mx-auto grid max-w-[74rem] gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <h2 id="price-list" className="au-h2">
                {CLINICS.priceTitle}
              </h2>
              <p className="au-lead mt-4">{CLINICS.priceLead(onSale.length)}</p>
              <div className="au-frame mt-10 hidden aspect-[4/5] max-w-[24rem] lg:block">
                <Photo image={IMAGES.clinicShelf} fill sizes="24rem" className="object-[50%_30%]" />
              </div>
            </div>
            <div className="lg:pt-2">
              <ClinicPicker packs={CLINIC_PACKS} />
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="how-title" className="au-wrap pt-24 lg:pt-32">
        <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <h2 id="how-title" className="au-h2">
            {CLINICS.howTitle}
          </h2>
          <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
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
              <dd className="mt-2 text-ink-soft">{CLINICS.limit(maxVials)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="enquire" aria-labelledby="enquire-title" className="au-sheet au-on-plum mt-24 px-6 py-14 sm:px-12 lg:mt-32 lg:py-20">
        <div className="mx-auto grid max-w-[74rem] gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <div>
            <h2 id="enquire-title" className="au-h2">
              {CLINICS.enquireTitle}
            </h2>
            <p className="mt-4 text-[1.1875rem] text-on-plum-soft">{CLINICS.enquireLead}</p>
            <p className="mt-3 text-[0.9375rem] text-on-plum-soft">{CLINICS.enquireNote}</p>
          </div>
          <ContactForm
            topics={TOPICS}
            defaultTopic={OPENING_TOPIC}
            text={CLINICS.form}
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
