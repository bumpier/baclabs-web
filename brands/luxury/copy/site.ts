/**
 * The words every page shares: the delivery line above the header, the
 * header, the footer, the 404 and the cookie banner. Plain strings that
 * import nothing (the bag button is a client component).
 */

/**
 * The line above the header, from the catalogue's delivery facts
 * (brands/luxury/service.ts). Says only what every order gets.
 */
export const ANNOUNCE = (f: { cutoff: string | null; arrives: string; included: boolean }) => {
  const what = f.included ? `Complimentary ${f.arrives.toLowerCase()} delivery on every order.` : `${f.arrives} delivery.`;
  return f.cutoff ? `${what} Order by ${f.cutoff} on a working day.` : what;
};

export const NAV = {
  label: "Main",
  skip: "Skip to content",
  shop: "Shop",
  vial: "The vial",
  concierge: "Concierge",
  bag: "Bag",
  inBag: (n: number) => (n === 1 ? "1 box in your bag" : `${n} boxes in your bag`),
  home: (name: string) => `${name}, home`,
};

export const FOOTER = {
  label: "Footer",
  shop: "Shop",
  concierge: "Concierge",
  infoHeading: "Information",
  terms: "Terms",
  privacy: "Privacy",
  returns: "Returns",
  disclaimer: "Product disclaimer",
  cookies: "Cookie settings",
  companyNo: "company no.",
};

export const NOT_FOUND = {
  heading: "Page not found",
  body: "This address leads nowhere. It may have moved, or never existed.",
  home: "Return to the home page",
  concierge: "Write to the concierge",
};

export const COOKIES = {
  heading: "Cookies",
  reject: "Reject",
  accept: "Accept",
};
