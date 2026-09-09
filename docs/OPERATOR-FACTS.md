# Operator facts still missing

Everything on baclab.co.uk that renders a fact is wired to config. Anything
left empty renders nothing rather than a placeholder, so the site is honest
today — but four commercially important surfaces are silent because nobody
has supplied the fact behind them. None of these can be filled in from the
code, a competitor, or a reasonable guess.

Ordered by what they unblock.

---

## 1. A public contact address — blocks the most

**Set:** `NEXT_PUBLIC_CONTACT_EMAIL` in `.env.local` on the VPS, then rebuild.

**Prerequisite, and it is not optional:** `baclab.co.uk` currently publishes
**no MX record**, so no mailbox exists on the domain. Verify with:

```bash
dig +short MX baclab.co.uk
```

An empty result means mail sent to any address at the domain bounces. Set up
mail routing first (Cloudflare Email Routing is free and needs only the MX
records it gives you), confirm a test message arrives, then set the variable.

**What turns on when it is set:**

- The contact page stops saying it is not reachable and publishes the address.
- The footer support column shows the address instead of pointing at the
  contact page.
- The price-match guarantee regains its instruction: "Email us the listing
  at … and we'll match the price". This is the undertaking that substantiates
  the "Cheapest in the UK" badge, so it is currently a promise with no channel.
- The wholesale section regains its "email a wholesale enquiry" button and the
  bulk page its trade-enquiry route.
- `Organization` JSON-LD gains a `contactPoint`.
- The FAQ answer about orders larger than the form allows regains its route.

**Related, and separately broken:** transactional email is not configured
either — `RESEND_API_KEY` and `EMAIL_FROM` are unset, so order confirmations
are not being sent at all. `lib/email.ts` logs and no-ops rather than failing
the order. Fix this at the same time; the contact page currently tells buyers
their order questions are handled "from the confirmation email for that
order", which assumes one was sent.

---

## 2. Seller identity — the audit's main trust finding

**Set:** in `config/brand.ts`, under `company`. These are literals in git, not
env vars, because they are identity rather than deployment configuration.

| Field | What it is |
|---|---|
| `legalName` | Registered company name, or your own name if a sole trader |
| `companyNumber` | Companies House number, if incorporated |
| `registeredAddress` | One-line address for the footer and legal pages |
| `postalAddress` | The same address, structured, for `Organization` JSON-LD |
| `vatNumber` | VAT registration number, if registered |
| `foundingDate` | Year trading began, `"YYYY"` |
| `icoRegistration` | ICO register entry, or leave empty if fee-exempt |

Every one renders only when non-empty, so partial information is fine — fill
in what is true and leave the rest blank. `postalAddress.streetAddress` is the
one that gates the address appearing in structured data.

Sampled competitors all publish more identity than BacLab does. For a
laboratory buyer choosing between suppliers this is the cheapest trust signal
available, and consumer law expects a trader to be identifiable.

---

## 3. Dispatch and delivery timing

**Set:** in `config/funnel.ts`, under `DELIVERY`. All three together:

```ts
dispatchLine: "Dispatched the same working day on orders before 2pm",
handlingDays: [0, 1],   // working days, order → dispatch
transitDays: [1, 3],    // working days, dispatch → arrival
```

Only commit to what you can actually meet. `handlingDays` and `transitDays`
feed `OfferShippingDetails.deliveryTime` in the Product structured data, which
is what the "delivery" line under a Google shopping result reads from — so a
figure here is a public commitment, not a marketing line. Leaving them null
omits the block entirely, which is why nothing appears today.

The bulk page renders a Dispatch row automatically once `dispatchLine` is set.

---

## 4. Batch documentation

**Set:** in `config/documentation.ts`, `BATCH_DOCUMENTS`, plus the file itself
in `public/documents/`.

Each entry needs a batch identifier that matches what is printed on the vial,
a document date, and the file. `/quality-and-documentation` renders no batch
section at all while the list is empty — deliberately, because describing an
unavailable certificate of analysis as available is a false quality claim.

`MANUFACTURER` in the same file publishes supplier provenance where that is
publishable. Leave it empty rather than writing something vague.

---

## Search Console

Not a missing fact so much as a missing step. There is no
`google-site-verification` TXT record on the domain and no verification meta
tag in the live HTML, so the property is not verified by either method.

The token was already read by `app/layout.tsx`, but it was never passed into
the Docker build, so setting `GOOGLE_SITE_VERIFICATION` in `.env.local` and
restarting produced no tag. That is now fixed: it is a build arg in
`Dockerfile` and `docker-compose.yml`. Set the variable and **rebuild**.

Either method works — the DNS TXT record through Cloudflare is simpler and
does not need a rebuild at all. Verification gates every measurement in the
SEO plan: impressions, queries, indexation and the live URL inspection that
would settle whether the pages are indexed.
