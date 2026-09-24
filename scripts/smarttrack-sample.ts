/**
 * The sample order behind scripts/preview-smarttrack.ts and
 * scripts/check-smarttrack.ts, so both send exactly the same request. It is
 * built by buildShipmentRequest, the function "Buy label" uses.
 *
 * Flags (all optional):
 *   --pack           storefront pack id: single, five, ten, twenty, fifty, hundred
 *   --qty            how many of that pack
 *   --service        SmartTrack service code
 *   --instructions   delivery instructions (the consignment description)
 *   --weight         parcel weight in grams, as posted
 *   --size           parcel size in mm, LxWxH
 *   --postcode       delivery postcode
 *
 * The sender and customer are samples: edit them here to try an address.
 */
import { BUNDLES, PRODUCT, totalMinor } from "@/config/funnel";
import { normaliseCode } from "@/lib/inventory/codes";
import { buildShipmentRequest, cleanDeliveryInstructions, type BuiltRequest } from "@/lib/smarttrack/payload";
import { DEFAULT_DELIVERY_INSTRUCTIONS } from "@/lib/shipping/shipments";

export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function sampleRequest(reference: string): BuiltRequest {
  const bundle = BUNDLES.find((b) => b.id === (flag("pack") ?? "five"));
  if (!bundle) {
    console.error(`Unknown --pack. Use one of: ${BUNDLES.map((b) => b.id).join(", ")}`);
    process.exit(1);
  }
  const quantity = Number(flag("qty") ?? 1);
  const [lengthMm, widthMm, heightMm] = (flag("size") ?? "110x60x45").split(/x/i).map(Number);
  const weightGrams = Number(flag("weight") ?? 180 * quantity);
  const lineTotalMinor = totalMinor(bundle, quantity);

  return buildShipmentRequest({
    reference,
    orderRef: "SAMPLE",
    serviceCode: flag("service") ?? "STNINRM48",
    labelSize: process.env.SMARTTRACK_LABEL_SIZE?.trim() || "100x150",
    sender: {
      contactName: "Dispatch",
      company: "BacLab",
      addressLine1: "Unit 1",
      addressLine2: "Example Business Park",
      city: "Leeds",
      postcode: "LS1 1AA",
      countryIso: "GB",
      phone: "",
      email: "",
    },
    receiver: {
      name: "Sam Customer",
      email: "sam@example.com",
      phone: "07700900000",
      address: {
        line1: "22 Acacia Avenue",
        line2: null,
        city: "Leeds",
        country: "GB",
        postalCode: flag("postcode") ?? "LS2 2BB",
      },
    },
    parcel: { weightGrams, lengthMm: lengthMm ?? 0, widthMm: widthMm ?? 0, heightMm: heightMm ?? 0 },
    items: [
      {
        skuCode: normaliseCode(bundle.sku),
        description: `${PRODUCT.name} ${PRODUCT.size} — ${bundle.vials}-pack`,
        quantity,
        unitWeightGrams: Math.round(weightGrams / quantity),
        lineTotalMinor,
      },
    ],
    goodsTotalMinor: lineTotalMinor,
    currency: "GBP",
    deliveryInstructions: cleanDeliveryInstructions(flag("instructions")) ?? DEFAULT_DELIVERY_INSTRUCTIONS,
  });
}
