/**
 * A second brand for the test scripts, registered with __registerTestBrand
 * (brands/registry.ts) so every per-brand path can be checked against
 * something other than BacLab without registering a real brand. Not a test
 * file itself: the test-*.ts scripts import it.
 *
 * Every value differs from BacLab's, so a BacLab value showing up in a
 * fixture email is a leak, which bacLabLeaks() reports. The name holds an
 * "&" to prove it is escaped in HTML.
 */
import { __registerTestBrand, type BrandProfile } from "@/brands/registry";
import { PAYPAL_PAYMENT } from "@/brands/payment-methods";

// A plain string, not a literal: it is deliberately not a BrandId.
export const TEST_BRAND_ID: string = "testbrand";

/**
 * A brand on PayPal: `source`'s profile and catalogue under a fixture id and
 * development host of its own, listing PayPal in PayPal's words, as a brand
 * moved to PayPal would be (deploy/BRAND-PAYMENTS.md). No real brand lists
 * PayPal, so the PayPal tests run on these. The id must not contain a real
 * brand's id, or its host would read as that brand's ("pplux", not
 * "ppluxury"). Its credentials are PAYPAL_*__<ID>, by the fixture's id.
 */
export function registerPayPalTestBrand(source: BrandProfile, id: string): BrandProfile {
  return __registerTestBrand({
    ...source,
    id,
    origin: `http://${id}.localhost:3000`,
    domains: [`${id}.localhost`],
    paymentProviders: ["paypal"],
    payment: PAYPAL_PAYMENT,
  });
}

export function registerTestBrand(): BrandProfile {
  return __registerTestBrand({
    id: TEST_BRAND_ID,
    name: "Fixture & Co",
    shortCode: "FX",
    origin: "https://fixture.example",
    domains: ["fixture.example", "www.fixture.example"],
    logo: "/fixture/logo.svg",
    colours: {
      paper: "#FFFDF8",
      surface: "#FFFDF8",
      neutral: "#F4EFE6",
      ink: "#221A12",
      inkSoft: "#5C4F40",
      line: "#E3D9CA",
      primary: "#8A3B12",
      cta: "#7A2E0C",
      header: "#F4EFE6",
      onHeader: "#221A12",
      onCta: "#FFF8F0",
    },
    email: {
      from: "Fixture & Co <hello@fixture.example>",
      contact: "help@fixture.example",
      inbox: "contact@fixture.example",
    },
    reviews: { url: "", inviteBcc: null },
    disclaimer: "Fixture disclaimer line.",
    packingSlipThankYou: "Thanks from the fixture.",
    legalName: "",
    shipping: { senderCompany: "Fixture Co", packingNote: "Fixture box" },
    analytics: { metaPixelId: "999999999999999" },
  });
}

/**
 * BacLab's identity, as it could leak into another brand's output: its name,
 * its domain, its two signature colours. Checked case-insensitively.
 */
const BACLAB_MARKERS = ["baclab", "#0047ff", "#050b1f"];

/** The BacLab markers found in `text`; [] means none leaked. */
export function bacLabLeaks(text: string): string[] {
  const lower = text.toLowerCase();
  return BACLAB_MARKERS.filter((m) => lower.includes(m));
}
