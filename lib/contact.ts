/**
 * The contact form's topics and the address its messages go to. Imported by
 * the form (a client component) and by the route, so nothing server-only
 * belongs here. Storing and emailing a message is lib/contact-inbox.ts.
 */
import { brand } from "@/config/brand";

/**
 * BacLab's published contact address: shown on /contact and the inbox each
 * form message is emailed to (CONTACT_FORM_TO overrides the latter). Set in
 * config/brand.ts as brand.contact.published, not brand.contact.email, which
 * also feeds the footer, the home page and the structured data; see
 * app/(baclab)/(store)/contact/page.tsx. Other brands' inboxes are on their profiles
 * (brands/registry.ts), which this file must not import: the form is a
 * client component and would ship every brand's name.
 */
export const CONTACT_EMAIL = brand.contact.published;

export interface ContactTopic {
  id: string;
  label: string;
  /** Show the order number box. Still optional: people lose the email. */
  asksOrder: boolean;
  /** Shown under the topic once it is chosen. */
  hint?: string;
}

// The order is the order a customer reaches for them in: what happened to
// my parcel first, the pre-sale questions after.
export const CONTACT_TOPICS = [
  {
    id: "delivery",
    label: "Delivery or tracking",
    asksOrder: true,
  },
  {
    id: "problem",
    label: "Damaged, missing or wrong item",
    asksOrder: true,
    hint: "Tell us what arrived and what was wrong. If a vial is damaged, we will reply asking for a photo of it and the packaging.",
  },
  {
    id: "return",
    label: "Return or refund",
    asksOrder: true,
  },
  {
    id: "complaint",
    label: "Complaint",
    asksOrder: true,
  },
  {
    id: "product",
    label: "Question about the product",
    asksOrder: false,
    // The house rule: the product is sold as a laboratory and research
    // diluent, and nothing here may invite a question about any other use.
    hint: "We can answer questions about the product as sold, a laboratory and research diluent. We cannot advise on any other use.",
  },
  {
    id: "wholesale",
    label: "Wholesale or trade",
    asksOrder: false,
    hint: "Include the quantity you need, the delivery postcode and whether it is a one-off or recurring.",
  },
  {
    id: "other",
    label: "Something else",
    asksOrder: false,
  },
] as const satisfies readonly ContactTopic[];

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"];

export const CONTACT_TOPIC_IDS = CONTACT_TOPICS.map((t) => t.id) as [ContactTopicId, ...ContactTopicId[]];

export function contactTopic(id: string): ContactTopic | undefined {
  return CONTACT_TOPICS.find((t) => t.id === id);
}

/** Longest message the form takes. Generous: a complaint can need a page. */
export const CONTACT_MESSAGE_MAX = 5000;
