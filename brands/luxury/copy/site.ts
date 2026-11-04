/**
 * The words every page shares: the header, the footer, the 404 and the
 * cookie banner. Plain strings that import nothing (the header's basket
 * count is a client component).
 */
export const NAV = {
  label: "Main",
  skip: "Skip to content",
  order: "Order",
  inOrder: (n: number) => (n === 1 ? "1 box in your order" : `${n} boxes in your order`),
  concierge: "Concierge",
};

export const FOOTER = {
  label: "Footer",
  concierge: "Concierge",
  terms: "Terms",
  privacy: "Privacy",
  returns: "Returns",
  disclaimer: "Product disclaimer",
  cookies: "Cookie settings",
  companyNo: "company no.",
};

export const NOT_FOUND = {
  heading: "Page not found",
  body: "That address does not exist on this site.",
  home: "Back to the home page",
};

export const COOKIES = {
  heading: "Cookies",
  reject: "Reject",
  accept: "Accept",
};
