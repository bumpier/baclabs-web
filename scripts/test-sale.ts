/**
 * Test suite for the sale arithmetic in config/funnel.ts. Run with
 * `npm run test:sale`. Exits non-zero on any failure, like
 * scripts/test-consent.ts.
 *
 * Every sale figure on the page — the struck-through price, the "You save"
 * line, the per-vial figure on the chooser tiles — is derived from
 * SALE.percentOff and the charged price. These checks hold the figures to
 * each other, so no surface can state a saving the others contradict.
 */
import {
  BUNDLES,
  PRODUCT,
  SALE,
  perVialMinor,
  referencePerVialMinor,
  referencePriceMinor,
  referenceUnitPriceMinor,
  saleSaveLabel,
  saleSavingMinor,
  saleUnitSavingMinor,
} from "@/config/funnel";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

for (const b of BUNDLES) {
  const saving = saleSavingMinor(b, 1);
  const reference = referencePriceMinor(b);

  check(
    `${b.id}: saving is the reference price less the charged price`,
    saving === reference - b.priceMinor,
    `${saving} vs ${reference} - ${b.priceMinor}`
  );
  check(`${b.id}: saving is positive`, saving > 0, String(saving));
  check(
    `${b.id}: saving scales with quantity`,
    saleSavingMinor(b, 3) === saving * 3,
    `${saleSavingMinor(b, 3)} vs ${saving * 3}`
  );
  // Rounding to whole pence can move the effective percentage a hair, never
  // by half a percent — beyond that the badge and the figures would disagree.
  const effective = (saving / reference) * 100;
  check(
    `${b.id}: saving matches the advertised percentage`,
    Math.abs(effective - SALE.percentOff) < 0.5,
    `${effective.toFixed(2)}% vs ${SALE.percentOff}%`
  );
  check(
    `${b.id}: struck-through per-vial figure is above the charged one`,
    referencePerVialMinor(b) > perVialMinor(b),
    `${referencePerVialMinor(b)} vs ${perVialMinor(b)}`
  );
  check(
    `${b.id}: per-vial reference is the pack reference over its vials`,
    referencePerVialMinor(b) === Math.round(reference / b.vials),
    `${referencePerVialMinor(b)} vs ${Math.round(reference / b.vials)}`
  );
}

check(
  "unit saving is the unit reference less the unit price",
  saleUnitSavingMinor() === referenceUnitPriceMinor() - PRODUCT.unitPriceMinor,
  `${saleUnitSavingMinor()}`
);
check(
  "the save label carries the configured percentage",
  saleSaveLabel() === `Save ${SALE.percentOff}%`,
  saleSaveLabel()
);

if (failures > 0) {
  console.error(`\n${failures} sale check(s) failed.`);
  process.exit(1);
}
console.log("✓ sale arithmetic passes");
