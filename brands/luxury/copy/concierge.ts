/**
 * The contact page, which this brand calls the concierge. No reply time is
 * promised: only the operator can make that promise (ContactForm's
 * replyTime), and it stays unset until they do.
 */
export const CONCIERGE = {
  title: "Concierge",
  description: (name: string) =>
    `Write to ${name} about an order, its delivery or a return, or about the vials before you choose.`,
  heading: "The concierge",
  lede: "Questions before you choose, about an order, its delivery or a return, and complaints.",
  how: "Write here and we reply by email.",
  orEmail: "Or email",
  companyNo: "no.",
  vat: "VAT",
};
