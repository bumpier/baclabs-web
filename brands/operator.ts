/**
 * The business behind every brand. The owner, 5 Nov 2026: the brands are a
 * front for BacLab and have no company of their own, so every company
 * reference on them names BacLab. Each brand's profile takes its legal
 * identity from here, and this reads it from config/brand.ts, BacLab's own:
 * fill the company in there once and every brand's legal pages, footer and
 * contact page name it ("BeautyBac is a trading name of …").
 *
 * Until it is filled, the business is "BacLab", as BacLab's own legal pages
 * name it (lib/legal.ts legalName), and no company number, registered
 * office, VAT or ICO line renders anywhere.
 *
 * A brand ever run by another business sets its own legalName and company
 * in its profile instead.
 */
import { brand as baclab } from "@/config/brand";
import type { BrandProfile } from "./types";

export const OPERATOR: Pick<BrandProfile, "legalName"> & { company: NonNullable<BrandProfile["company"]> } = {
  legalName: baclab.company.legalName || baclab.name,
  company: {
    number: baclab.company.companyNumber,
    registeredAddress: baclab.company.registeredAddress,
    vatNumber: baclab.company.vatNumber,
    icoRegistration: baclab.company.icoRegistration,
  },
};
