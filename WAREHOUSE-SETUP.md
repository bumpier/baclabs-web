# Warehouse, SKUs and postage labels

What was built on 22 September 2026, how to switch it on, and what is still
open. The admin screens are **Inventory** and **Shipping** (admin role only);
packers see the pick list and label buttons on each order.

Nothing here changes what a customer can buy until the switch on the
Inventory page is flipped. Until then checkout keeps using the old single
vial counter (`Product.stock`).

## How it fits together

- **SKU** — every thing with its own code: the single vial (`BACLAB-10ML`)
  and each storefront pack (`BACLAB-10ML-X5` …). Letters, numbers or both;
  upper case; fixed once created. The pack codes are the `sku` strings that
  `config/funnel.ts` already gives each bundle, so there is no mapping table.
- **Kit or stocked.** A SKU with components is a *kit*: it holds no stock,
  and selling one takes its components off the shelf (a 5-pack kit takes five
  vials). A pack that arrives or is made up already packed is a *stocked*
  SKU with its own locations and its own count. Both are supported; switch a
  pack between them by adding or removing its components.
- **Warehouse → locations → stock.** Stock is held per SKU per location.
  The total for a SKU is the sum across every active location. The
  warehouse's address is the sender on its labels.
- **Ledger.** Every change is a movement row — book-in, adjustment (with a
  reason; "Split pack into singles" is one), move, sale, cancellation — in
  the same transaction as the level it changes. Stock never goes below zero.
- **Orders.** When an order is paid (warehouse mode) it is allocated to
  locations, pick face first (lowest *pick order*), and the allocation is the
  pick list. If the shelves are short, the rest is recorded as a shortfall
  and "Allocate the shortfall" on the order retries it once stock is booked
  in. Cancelling an order puts its stock back where it came from.
- **Postal services** are synced from SmartTrack (`get-services`: weight
  band, maximum sides, a size rule such as `L+W+H`, countries) or added by
  hand. Each order's parcel — built from the sold SKUs' packed weights and
  sizes — is checked against every service; the first that fits, by
  priority, is suggested, with the reason every other service was passed
  over. A service assigned to a SKU wins whenever it fits the order; when an
  order outgrows it the automatic choice is used and the order page says why.
  Volumetric weight is applied per service where a divisor is set.
- **Labels.** "Buy label" on the order calls SmartTrack `generate-label`,
  stores the PDF and tracking number, and can void it. A **pick label** at
  the same 100 × 150 mm size lists location, SKU and quantity in walking
  order, to print alongside the carrier label.

## Switching it on

1. **Shipping** — add services by hand, or connect SmartTrack (below) and
   press *Sync services*. Set priorities.
2. **Inventory → Warehouses & locations** — add the warehouse with its full
   address, then its locations (e.g. `A-01-02`). Low pick order for the pick
   face, high for overflow; pre-packed packs in their own locations.
3. **Inventory** — *Create the missing SKUs* makes the vial and every
   storefront pack as kits. Weigh and measure each pack **as posted** and
   enter it on the SKU; change any pack that is pre-packed to stocked.
4. **Book stock in** — count what is physically on the shelves into
   locations. The old counter is not carried over.
5. When the checklist on the Inventory page is all *Yes*, press **Switch to
   warehouse stock**. *Switch back* is there if anything looks wrong.

## SmartTrack — what the account needs

The code runs without an account; only *Buy label* waits for one.

- [ ] A **UAT** (test) account at qa.smarttrack.co and a **live** account.
      They are separate systems with separate keys.
- [ ] **API Key and API Secret** for each: Profile → API Keys.
- [ ] **Services assigned** to the account — `get-services` only lists what
      SmartTrack has assigned, so ask them to assign the ones you will use.
- [ ] Set `SMARTTRACK_API_KEY`, `SMARTTRACK_API_SECRET` and `SMARTTRACK_ENV`
      (`uat`, then `live`) in the server env, restart, then *Test connection*
      and *Sync services* on the Shipping page.
- [ ] A **4 × 6 in (100 × 150 mm) thermal label printer**. The current label
      printer takes 1.5 × 1 in stickers, which cannot hold a carrier label.

**To raise with SmartTrack:** on 22 September their UAT sign-in endpoint
(`qa.smarttrack.co/api/v2/token`) answered every request with a server-side
database error (`Table 'user_shopping_platforms' doesn't exist`, HTTP 500).
The live endpoint answered correctly. UAT testing cannot start until they fix
it.

Also worth confirming with them:

- Units: the code reads their service limits as **kg and cm** (their example
  shows `to_weight 3.000`, `max_length 25.00`, `L+W+H ≤ 90`).
- Whether **manifests** (`create-manifest`) are needed for collections. The
  client call exists; there is no button yet.
- Whether **ZPL** labels are available for your services (PDF is used now).
- The required consignment `description` field carries **delivery
  instructions** — "Leave at doorstep" unless changed on the Shipping page
  (30 characters). The contents go in each parcel item's own description.
  Confirm that is how their carriers read it.
- Their `create-order` / `create-sku` endpoints (SmartTrack holding the
  orders itself) are an alternative integration. This build keeps orders
  here and only buys labels.

## Barcodes and the scan station

Every barcode is **Code 128 (1D)**, which both 1D laser and 2D imaging
scanners read. What each one holds is a **draft until agreed with the
fulfilment team**; it is all set in `lib/inventory/scan.ts`:

| Barcode | Holds | Printed on |
|---|---|---|
| Pick label | `ORD-` + order reference, e.g. `ORD-3F9A1C2D` | the pick label, with the carrier label |
| Shelf | `LOC-` + location code, e.g. `LOC-A-01-02` | *Print shelf labels* (Warehouses page) |
| Product | the maker's barcode if the SKU has one, else the SKU code | *Print product labels* (Inventory page) |

Shelf and product labels print on A4 sheets of 21 (63.5 × 38.1 mm).

**Scan station** (Orders → *Scan station*; packers can use it): scan the pick
label to open the order, then each shelf or item. A high beep means right; a
low double buzz means wrong, and nothing is counted. A shelf scan counts
everything the pick label says to take from that shelf; an item scan counts
one. When the order is complete a chime plays and *Mark packed* appears. Any
USB or Bluetooth scanner that types like a keyboard works, with no drivers.
The tally is saved on the server, so it survives a refresh.

## Open — for the next session

- Confirm the barcode contents above with the fulfilment team.
- Tracking updates feeding order status and the "shipped" email.
- Batch buying and printing of labels for all unfulfilled orders.
- Cheapest-service choice from live `get-quotes` prices (the choice is by
  priority today).

## For developers

- Schema: the models at the bottom of `prisma/schema.prisma`; migration
  `20260922090000_warehouse_inventory_postage` is additive only.
- `lib/inventory/` — codes, allocation maths, bundle → SKU mapping, the mode
  switch, and `store.ts`, the only code that writes stock.
- `lib/shipping/` — parcel sizing, the service picker (pure), order plans,
  and `shipments.ts` (label buying: PENDING is written before SmartTrack is
  called, so a crash cannot lose a paid-for label).
- `lib/smarttrack/` — config, the REST client, and the request builder
  (kg/cm conversion and field-length rules live only there).
- Tests: `npm run test:inventory`, `npm run test:shipping` (pure), and
  `scripts/smoke-inventory.ts` / `scripts/smoke-shipping.ts` against a
  throwaway database (instructions at the top of each; they refuse to run
  against `data/baclab.db`).
