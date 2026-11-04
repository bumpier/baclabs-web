import { SignupForm } from "@/components/commerce/SignupForm";
import { deliveryQuote } from "@/lib/commerce/view";
import { SIGNUP } from "@/brands/gym/copy/home";
import { Hero } from "@/brands/gym/components/Hero";
import { BoxSection } from "@/brands/gym/components/BoxSection";
import { Answers } from "@/brands/gym/components/Answers";
import { OrderProvider } from "@/brands/gym/components/OrderProvider";
import { StickyBuyBar } from "@/brands/gym/components/StickyBuyBar";
import { brand, STOREFRONT } from "./site";
import { BuySection } from "./BuySection";

/** The pack the headline sells: the 10 if it is on sale, else the smallest that is. */
const HERO_VIALS = 10;

/**
 * Brute Lab's home page, which is the whole shop: the price-led hero, the
 * stock-up ladder, the basket with the Lab Kit offer and the checkout, what
 * you get, straight answers, and the restock list when the brand runs one.
 * On a phone the sticky buy bar follows once the hero's button has gone.
 *
 * Prerendered from the storefront view (the layout's revalidate bounds how
 * stale a price can be). There is no urgency of any kind: the view carries
 * no stock level, and the brand never invents one.
 */
export default function Home() {
  const packs = STOREFRONT.packs.filter((p) => p.available);
  const heroPack = packs.find((p) => p.vials === HERO_VIALS) ?? packs[0] ?? null;
  // The option this pack gets free, if its price clears the threshold.
  const freeOption = heroPack
    ? (deliveryQuote(STOREFRONT, heroPack.priceMinor).find((d) => d.priceMinor === 0)?.option.label ?? null)
    : null;
  const list = STOREFRONT.mailingList;

  return (
    <OrderProvider defaultSku={heroPack?.sku ?? null}>
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero pack={heroPack} freeOption={freeOption} />
        <BuySection />
        <BoxSection view={STOREFRONT} name={brand.name} vials={heroPack?.vials ?? null} />
        <Answers view={STOREFRONT} />

        {list ? (
          <section aria-labelledby="list-heading" className="gym-signup gym-hot">
            <div className="gym-wrap gym-signup-grid">
              <div>
                <h2 id="list-heading" className="gym-h2">
                  {SIGNUP.heading}
                </h2>
                <p className="gym-signup-lead">{SIGNUP.lead}</p>
              </div>
              <SignupForm
                config={{
                  consentText: list.consentText,
                  placeholder: SIGNUP.placeholder,
                  submitLabel: SIGNUP.submit,
                  pendingLabel: SIGNUP.pending,
                  doneMessage: SIGNUP.done,
                }}
                source="inline"
                classNames={{
                  form: "gym-signup-form",
                  row: "gym-signup-row",
                  input: "gym-signup-input",
                  button: "gym-btn gym-btn-ink gym-btn-lg shrink-0",
                  error: "gym-signup-error",
                  consent: "gym-signup-consent",
                  link: "gym-link",
                  done: "gym-signup-done",
                }}
              />
            </div>
          </section>
        ) : null}
      </main>
      <StickyBuyBar />
    </OrderProvider>
  );
}
