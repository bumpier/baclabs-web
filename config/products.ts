// ─────────────────────────────────────────────────────────────────
// PACK PAGES — one indexable page per bundle tier.
//
// The storefront used to be a single funnel: one URL carrying one Product
// entity with every bundle Offer inside it. That gave Google one page to rank
// for a set of genuinely different queries — "bacteriostatic water 10ml" and
// "bacteriostatic water 100 vials wholesale" are not the same search, and a
// single page cannot be the best answer to both.
//
// Each tier now has its own URL under /products. THE RULE THAT MAKES THIS
// WORK, AND THE ONLY ONE THAT MATTERS: a pack page must earn its own
// existence. Several pages describing the same vial in the same words are
// duplicates whatever their URLs say, and Google will pick one and drop the
// rest. So every entry below carries:
//
//   · its own `query` — the search it exists to answer, and the reason it is
//     a separate page at all. Two entries must never claim the same one.
//   · its own `lede` and `audience` — written for THIS pack, not templated.
//   · its own `angle` sections — the argument for this quantity specifically.
//   · its own `variant` — a different page shape, not a different heading.
//
// NOTHING NUMERIC IS TYPED HERE. Every price, per-vial figure, saving and
// draw count is derived from config/funnel.ts at render time, so re-pricing a
// tier moves every pack page with it. If you find yourself typing a £ sign in
// this file, the figure belongs in funnel.ts instead.
//
// House rules apply as everywhere else: no therapeutic or medical framing,
// the preservative is never named or quantified, and the "Cheapest in the UK"
// superlative (LOWEST_PRICE_BADGE) stays on the home page beside its
// #guarantee link — pack pages link to that anchor rather than restating it.
// ─────────────────────────────────────────────────────────────────

import { BUNDLES, PRODUCT, VIAL_ML, type Bundle, type BundleId } from "@/config/funnel";

/**
 * How a pack page is laid out. Four shapes, fewer than there are tiers,
 * because four is how many genuinely different buying situations there are — but the shapes
 * differ in which sections exist and in what order, not merely in a heading.
 *
 *  · starter   — one vial. Leads on what a single vial actually gives you and
 *                on the in-use window, because that is the real constraint on
 *                a first order. No savings table: there is nothing to save.
 *  · standard  — the everyday repeat packs. Leads on the pack arithmetic and
 *                the saving against singles.
 *  · stockUp   — the packs bought to stop re-ordering. Leads on the per-vial
 *                ladder and on delivery, and carries the full tier table.
 *  · wholesale — procurement quantities. Leads on unit economics and on the
 *                order ceiling, and hands off to /bulk-bacteriostatic-water.
 */
export type PackVariant = "starter" | "standard" | "stockUp" | "wholesale";

/**
 * A question asked about THIS pack size, and its answer.
 *
 * Answers may carry tokens in braces — {vials}, {totalMl}, {price},
 * {perVial}, {maxOrderVials}, {maxPacks}, {openedLimit}, {freeFrom},
 * {singlesPrice}, {saving} — which lib/pack-metrics.ts fills from
 * config/funnel.ts at render time. That keeps the "no figure is ever typed"
 * rule while still letting an answer read like a sentence rather than like a
 * cross-reference to a table further up the page.
 *
 * An unknown token is left alone rather than silently emptied, so a typo
 * shows up in the copy instead of quietly deleting a number.
 */
export interface PackFaq {
  q: string;
  a: string;
}

export interface PackAngle {
  /** Section heading. Must be specific to this pack, never generic. */
  heading: string;
  /** One or two sentences. Facts and figures come from funnel.ts, not here. */
  body: string;
}

export interface PackPage {
  /** The tier this page sells. Must exist in BUNDLES. */
  bundleId: BundleId;
  /** URL segment under /products. Keyword-bearing, never "pack-3". */
  slug: string;
  /** <h1>. Distinct from every other pack's. */
  h1: string;
  /** <title>, before the brand suffix. */
  metaTitle: string;
  /** <meta name="description">. */
  metaDescription: string;
  /**
   * The search this page exists to answer. Documentation, not output — it is
   * the test a new entry has to pass before it earns a URL. Two pages sharing
   * a query are two pages competing with each other.
   */
  query: string;
  /** Short label for cards, breadcrumbs and the pack ladder. */
  shortLabel: string;
  /** The opening paragraph. The most-read text on the page. */
  lede: string;
  /** Who this quantity is for, in one sentence. */
  audience: string;
  /** The argument for this quantity. Two or three sections, pack-specific. */
  angles: readonly PackAngle[];
  variant: PackVariant;
  /**
   * Questions specific to THIS quantity. Not the site-wide FAQ — those live
   * in config/faq.ts and are answered on /faq and the home page.
   *
   * These carry most of the unique wording on a pack page, which is what
   * stops two adjacent sizes reading as the same document. Nothing here may
   * assert a fact the site does not already hold: no lead times, no invoicing
   * terms, no stock promises.
   */
  faqs: readonly PackFaq[];
  /**
   * The other packs this page links to, in order. A pack page that points at
   * the cheaper-per-vial alternative is more useful than one that does not,
   * and the internal links are what let the pack pages share authority rather
   * than split it.
   */
  related: readonly BundleId[];
}

/**
 * THE pack pages, in ladder order.
 *
 * Order here is render order in the /products index and in the pack ladder on
 * the home page, so it must stay ascending by vial count.
 */
export const PACK_PAGES: readonly PackPage[] = [
  {
    bundleId: "single",
    slug: "bacteriostatic-water-10ml-single-vial",
    h1: `Single ${PRODUCT.size} of bacteriostatic water`,
    metaTitle: `Bacteriostatic water ${PRODUCT.size} — single vial`,
    metaDescription: `One sealed ${PRODUCT.size} of bacteriostatic water, sterile water with a bacteriostatic preservative. Sold singly for laboratory and research use, with UK delivery.`,
    query: "bacteriostatic water 10ml / single vial",
    shortLabel: "Single vial",
    lede: `One sealed ${PRODUCT.size}, sold on its own. This is the smallest quantity we sell and the one to start with if you have not bought from us before — there is no minimum order and nothing to commit to beyond a single vial.`,
    audience:
      "A first order, a one-off requirement, or topping up a shelf that is nearly bare.",
    angles: [
      {
        heading: "What one vial actually gives you",
        // Draw counts are computed by the page from VIAL_ML, never stated here.
        body: `A ${PRODUCT.size} is drawn from more than once — that is the point of the preservative. How many times depends entirely on the volume you take each draw, so the useful figure is millilitres, not a count.`,
      },
      {
        heading: "The in-use window matters more than the vial count",
        // FACTS.openedLimit is injected by the page.
        body: "Once the stopper has been punctured the vial has a limited in-use life, and that window — not the number of vials on the shelf — is usually what decides how much you should buy. One vial you finish is worth more than three you do not.",
      },
      {
        heading: "Buying one costs the most per vial",
        body: "Said plainly because it is true: this is the dearest tier per vial on the site, and every larger pack beats it. If you already know you will use more than one, the multi-vial packs are cheaper for the same product in the same vial.",
      },
    ],
    faqs: [
      {
        q: "Can I buy a single vial, or is there a minimum order?",
        a: "A single vial is {price} and there is no minimum order. This is the smallest quantity listed and it can be bought on its own.",
      },
      {
        q: "How long does one vial last once it has been opened?",
        a: "{openedLimit}. That limit runs from the first puncture, not from delivery, so an unopened vial on a shelf is not counting down.",
      },
      {
        q: "How many draws will I get from one vial?",
        a: "{drawsAt1ml} at 1ml, or {drawsAt2ml} at 2ml. The vial holds {totalMl}ml, so the honest answer is that it depends entirely on the volume you take each time.",
      },
      {
        q: "Is a single vial the same product as the larger packs?",
        a: "Yes. Every pack size contains the same sealed vial to the same specification. Only the number of vials and the price per vial change.",
      },
    ],
    variant: "starter",
    related: ["five", "ten"],
  },
  {
    bundleId: "five",
    slug: "bacteriostatic-water-10ml-5-vials",
    h1: `Bacteriostatic water, 5 × ${PRODUCT.size}`,
    metaTitle: `Bacteriostatic water 5 pack — 5 × ${PRODUCT.size}`,
    metaDescription: `Five sealed ${PRODUCT.size}s of bacteriostatic water in one pack — our most-ordered quantity. Sterile water with a bacteriostatic preservative, for laboratory and research use.`,
    query: "bacteriostatic water 5 pack / 5 vials",
    shortLabel: "5 vials",
    lede: `Five sealed ${PRODUCT.size}s in one pack. This is the quantity most people settle on after their first order: enough that you are not re-ordering constantly, small enough that every vial gets used well inside its in-use window.`,
    audience:
      "The standing repeat order — ongoing work at a steady, modest rate of use.",
    angles: [
      {
        heading: "Why five is the one most people come back for",
        body: "It is the smallest pack where the per-vial price drops meaningfully against buying singly, and it is small enough that the vials do not sit around. Past this point you are buying on price rather than on need.",
      },
      {
        // NOT a second heading about saving — the savings panel rendered
        // directly below this grid already owns that subject, and two
        // adjacent headings about the same thing read as a template running
        // twice. This covers the mistake buyers actually make instead.
        heading: "Buying five does not extend anything",
        body: "The in-use window applies to each vial from its own first puncture, not to the pack as a whole. Five vials is five separate windows, each starting whenever you start it — which is why pack size and shelf life are independent decisions.",
      },
    ],
    faqs: [
      {
        q: "How much cheaper is the 5-pack than buying five singles?",
        a: "Five vials bought one at a time would be {singlesPrice}. This pack is {price}, a saving of {saving}. That is arithmetic against today's single-vial price, not a promotion.",
      },
      {
        q: "How much water is in a 5-pack?",
        a: "{totalMl}ml across {vials} sealed vials, which is {drawsAt1ml} draws at 1ml.",
      },
      {
        q: "Can I order more than one 5-pack?",
        a: "Yes, up to {maxPacks} packs in a single order, which is {maxOrderVials} vials. Beyond that the bulk page is the right place to start.",
      },
      {
        q: "Do all five vials have to be opened at once?",
        a: "No. Each vial is sealed separately and only starts its in-use window when it is first punctured. Unopened vials are unaffected by the ones beside them.",
      },
    ],
    variant: "standard",
    related: ["single", "ten", "twenty"],
  },
  {
    bundleId: "ten",
    slug: "bacteriostatic-water-10ml-10-vials",
    h1: `Bacteriostatic water, 10 × ${PRODUCT.size}`,
    metaTitle: `Bacteriostatic water 10 pack — 10 × ${PRODUCT.size}`,
    metaDescription: `Ten sealed ${PRODUCT.size}s of bacteriostatic water — ${VIAL_ML * 10}ml in total. The stock-up pack, for laboratory and research use, with UK delivery.`,
    query: "bacteriostatic water 10 pack / 10 vials",
    shortLabel: "10 vials",
    lede: `Ten sealed ${PRODUCT.size}s. The stock-up pack: the point on the ladder where the per-vial price drops properly and re-ordering stops being something you think about every few weeks.`,
    audience:
      "Steady, continuing use — a working stock rather than a purchase.",
    angles: [
      {
        heading: "Where the per-vial price turns",
        body: "The ladder below shows every tier side by side. Ten is where the curve flattens: the tiers under it cost noticeably more per vial, and the ones above it improve on it far more gradually.",
      },
      {
        heading: "Delivery at this size",
        // The page prints the real threshold and whether this pack clears it.
        body: "Whether a pack ships free depends on the order value against our delivery threshold, and this tier's position relative to it is stated below rather than implied.",
      },
      {
        heading: "Storing ten vials",
        body: "The storage condition printed on the label applies to every vial in the pack, sealed or otherwise. Vials are unaffected by pack size — ten sealed vials keep exactly as one does.",
      },
    ],
    faqs: [
      {
        q: "Does a 10-pack qualify for free UK delivery?",
        a: "Free delivery applies at or above {freeFrom}. Whether this pack clears it on its own is stated in the delivery line on this page, and the figure shown at checkout is the one charged.",
      },
      {
        q: "How much water is in a 10-pack?",
        a: "{totalMl}ml across {vials} sealed {vialWord}, which is {drawsAt1ml} draws at 1ml or {drawsAt2ml} at 2ml.",
      },
      {
        q: "Do ten vials need different storage from one?",
        a: "No. The storage condition printed on the label applies per vial and does not change with pack size. Ten sealed vials keep exactly as one does.",
      },
      {
        q: "Will I use ten vials before they expire?",
        a: "The in-use limit of {openedLimit} applies from the first puncture of each vial individually. Sealed vials carry a batch expiry printed on the vial itself.",
      },
    ],
    variant: "stockUp",
    related: ["five", "twenty", "fifty"],
  },
  {
    bundleId: "twenty",
    slug: "bacteriostatic-water-10ml-20-vials",
    h1: `Bacteriostatic water, 20 × ${PRODUCT.size}`,
    metaTitle: `Bacteriostatic water 20 pack — 20 × ${PRODUCT.size}`,
    metaDescription: `Twenty sealed ${PRODUCT.size}s of bacteriostatic water, ${VIAL_ML * 20}ml in total. Bulk pricing for laboratory and research use, delivered in the UK.`,
    query: "bacteriostatic water 20 vials / bulk 20 pack",
    shortLabel: "20 vials",
    lede: `Twenty sealed ${PRODUCT.size}s. The first properly bulk quantity — bought to cover a period of work rather than to meet a particular requirement.`,
    audience:
      "A laboratory or workshop covering months of continuing use in one order.",
    angles: [
      {
        heading: "Buying by the period rather than by the vial",
        body: "At this quantity the question stops being how many vials you need and becomes how long you want to go without ordering again. The total volume below is the figure to plan against.",
      },
      {
        heading: "What the saving is worth here",
        body: "The comparison against buying singly is printed below in both cash and percentage terms. Both are computed from today's prices, and both move if the prices do.",
      },
    ],
    faqs: [
      {
        q: "What does the 20-pack save against buying singly?",
        a: "Twenty vials bought one at a time would be {singlesPrice}. This pack is {price} — a saving of {saving}.",
      },
      {
        q: "How long does {vials} vials' worth of water last?",
        a: "That depends entirely on your rate of use, which is why the figure we publish is volume rather than time: {totalMl}ml, or {drawsAt1ml} draws at 1ml.",
      },
      {
        q: "Can I order two 20-packs?",
        a: "Yes. Up to {maxPacks} packs go through the checkout in one order, which is {maxOrderVials} vials.",
      },
    ],
    variant: "stockUp",
    related: ["ten", "fifty", "hundred"],
  },
  {
    bundleId: "fifty",
    slug: "bacteriostatic-water-10ml-50-vials",
    h1: `Bacteriostatic water, 50 × ${PRODUCT.size}`,
    metaTitle: `Bacteriostatic water 50 vials — bulk case`,
    metaDescription: `Fifty sealed ${PRODUCT.size}s of bacteriostatic water, ${VIAL_ML * 50}ml in total, at bulk unit pricing. For laboratory and research procurement in the UK.`,
    query: "bacteriostatic water 50 vials / bulk case",
    shortLabel: "50 vials",
    lede: `Fifty sealed ${PRODUCT.size}s at bulk unit pricing. This is a procurement quantity: bought against a budget and a period of work, not against a task.`,
    audience:
      "Laboratory procurement, teaching facilities and workshops buying a term or a quarter at a time.",
    angles: [
      {
        heading: "Unit economics at fifty",
        body: "The per-vial and per-millilitre figures below are the ones worth quoting in a purchase order. Both are derived from the pack price, so neither can drift from what you are actually charged.",
      },
      {
        heading: "Ordering more than one pack",
        body: "Packs can be ordered in multiples up to the per-order ceiling stated below. Beyond that, or for a standing arrangement, the wholesale page is the right starting point.",
      },
    ],
    faqs: [
      {
        q: "What is the unit price at 50 vials?",
        a: "{perVial} a vial, {price} for the pack, covering {totalMl}ml.",
      },
      {
        q: "Can I order more than one 50-vial pack?",
        a: "Yes, up to {maxPacks} packs in one order — {maxOrderVials} vials. Larger or standing requirements are quoted rather than listed.",
      },
      {
        q: "Is the product any different at this quantity?",
        a: "No. The same sealed vial to the same specification as a single-vial order. Volume changes the unit price and nothing else.",
      },
    ],
    variant: "wholesale",
    related: ["twenty", "hundred"],
  },
  {
    bundleId: "hundred",
    slug: "bacteriostatic-water-10ml-100-vials",
    h1: `Bacteriostatic water, 100 × ${PRODUCT.size}`,
    metaTitle: `Bacteriostatic water 100 vials — wholesale`,
    metaDescription: `One hundred sealed ${PRODUCT.size}s of bacteriostatic water, ${VIAL_ML * 100}ml in total, at our lowest unit price. Wholesale supply for UK laboratory and research buyers.`,
    query: "bacteriostatic water 100 vials / wholesale",
    shortLabel: "100 vials",
    lede: `One hundred sealed ${PRODUCT.size}s — the largest pack we list, at the lowest unit price on the site. Ordered by buyers who are supplying a facility rather than a bench.`,
    audience:
      "Wholesale and repeat institutional supply, where unit price and continuity of stock are the deciding factors.",
    angles: [
      {
        heading: "The lowest unit price we list",
        body: "Every tier is compared below on the same per-vial basis so the claim can be checked rather than taken. Nothing on this page asks you to believe a figure you cannot see the working for.",
      },
      {
        heading: "Order ceiling and larger arrangements",
        body: "The storefront takes multiples of this pack up to the per-order ceiling stated below. Requirements above that are a conversation rather than a checkout, and the wholesale page explains how to start one.",
      },
      {
        heading: "What does not change at this quantity",
        body: "The same sealed vial, the same specification and the same documentation as the single-vial order. Volume changes the unit price and nothing else about what arrives.",
      },
    ],
    faqs: [
      {
        q: "Is the 100-vial pack the lowest unit price you offer?",
        a: "It is the lowest listed on the site: {perVial} a vial against {singleUnit} for a single. Every tier is compared on this page so the claim can be checked rather than taken.",
      },
      {
        q: "What is the largest order I can place online?",
        a: "{maxPacks} packs, which is {maxOrderVials} vials. Requirements above that are quoted rather than listed — the bulk page explains how to ask.",
      },
      {
        q: "How much water is 100 vials?",
        a: "{totalMl}ml in total, across {vials} individually sealed vials.",
      },
      {
        q: "Does anything about the product change at wholesale quantity?",
        a: "No. Same vial, same specification, same documentation. Only the unit price moves.",
      },
    ],
    variant: "wholesale",
    related: ["fifty", "twenty"],
  },
] as const;

// ── Lookups ───────────────────────────────────────────────────────

/** Base path for every pack page. One constant, so a move is one edit. */
export const PRODUCTS_BASE = "/products";

/** The canonical path of a pack page. */
export function packPath(p: PackPage): string {
  return `${PRODUCTS_BASE}/${p.slug}`;
}

export function packBySlug(slug: string): PackPage | undefined {
  return PACK_PAGES.find((p) => p.slug === slug);
}

export function packByBundleId(id: BundleId): PackPage | undefined {
  return PACK_PAGES.find((p) => p.bundleId === id);
}

/** The bundle a pack page sells. Throws rather than render a page with no price. */
export function bundleForPack(p: PackPage): Bundle {
  const b = BUNDLES.find((x) => x.id === p.bundleId);
  if (!b) {
    throw new Error(
      `Pack page "${p.slug}" names bundle "${p.bundleId}", which is not in BUNDLES.`
    );
  }
  return b;
}

/**
 * Every pack page has a bundle and every bundle has a pack page, and no two
 * pages share a slug or a query.
 *
 * Called by scripts/check-packs.ts. It exists because the failure mode is
 * silent: a tier added to BUNDLES with no entry here simply becomes
 * unreachable and unindexed, and a duplicated `query` produces two pages that
 * quietly compete for the same search instead of one that wins it.
 */
export function packRegistryProblems(): string[] {
  const problems: string[] = [];
  const seenSlug = new Set<string>();
  const seenQuery = new Set<string>();
  const seenBundle = new Set<string>();

  for (const p of PACK_PAGES) {
    if (!BUNDLES.some((b) => b.id === p.bundleId)) {
      problems.push(`${p.slug}: bundle "${p.bundleId}" is not in BUNDLES.`);
    }
    if (seenSlug.has(p.slug)) problems.push(`Duplicate slug: ${p.slug}`);
    if (seenQuery.has(p.query)) {
      problems.push(
        `Duplicate query "${p.query}" (${p.slug}) — two pages competing for one search.`
      );
    }
    if (seenBundle.has(p.bundleId)) {
      problems.push(`Bundle "${p.bundleId}" has more than one pack page.`);
    }
    seenSlug.add(p.slug);
    seenQuery.add(p.query);
    seenBundle.add(p.bundleId);
  }

  for (const b of BUNDLES) {
    if (!PACK_PAGES.some((p) => p.bundleId === b.id)) {
      problems.push(`Bundle "${b.id}" has no pack page, so it is unreachable.`);
    }
  }

  return problems;
}
