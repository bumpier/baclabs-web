"use client";

import { LADDER } from "@/brands/gym/copy/home";
import { StockUpLadder } from "@/brands/gym/components/StockUpLadder";
import { Basket } from "@/brands/gym/components/Basket";

/**
 * The buying half of the home page: the stock-up ladder (#packs), then the
 * basket with the Lab Kit offer and the checkout (#buy, where an unfinished
 * payment returns). A hazard band marks where the offer ends and the
 * order starts.
 *
 * Client code, as everything in it is: the ladder and the basket read the
 * storefront view from the basket the root layout set up, so no catalogue
 * data is passed twice, and this file is where npm run test:bundle starts
 * following the brand's buy flow. Needs the page's OrderProvider above it.
 */
export function BuySection() {
  return (
    <>
      <div className="gym-hazard" aria-hidden="true" />
      <section id="packs" aria-labelledby="packs-heading" className="gym-packs gym-concrete">
        <div className="gym-wrap">
          <div className="gym-section-head">
            <h2 id="packs-heading" className="gym-h2">
              {LADDER.heading}
            </h2>
            <p className="gym-section-lead">{LADDER.lead}</p>
          </div>
          <StockUpLadder />
        </div>
      </section>
      <Basket />
    </>
  );
}
