/**
 * The order confirmation, set as the card in the box. Every status line says only what the order
 * record shows (lib/commerce/order-view.ts); nothing here promises a time
 * the order does not carry.
 */
export const ORDER = {
  title: "Your order",
  heading: {
    cancelled: "This order was cancelled",
    paid: "Thank you. Your order is confirmed.",
    confirming: "Payment received",
    received: "Order received",
  },
  status: {
    cancelled: "It is no longer active.",
    delivered: "Your order has been delivered.",
    sent: "Your order is on its way.",
    paid: "Payment has cleared and your order is being prepared.",
    confirming: "We are confirming your payment now. This page updates itself in a few seconds.",
    waiting: "We are waiting for your payment to be confirmed. This page shows the latest status whenever you reload it.",
  },
  number: "Order",
  placed: "Placed",
  free: "Complimentary",
  delivery: "Delivery",
  totalPaid: "Total paid",
  total: "Total",
  parcelHeading: "Your parcel",
  sentBy: "Sent by",
  trackingNumber: "Tracking number",
  latest: "Latest update",
  delivered: "Delivered",
  sent: "Sent",
  nextHeading: "What happens next",
  next: {
    email: "A confirmation email is on its way",
    to: "to",
    packed: (carrier: string) => `We pack your order and send it by ${carrier} to the address you gave`,
    packedPlain: "We pack your order and send it to the address you gave.",
    due: (text: string) => `. It is due ${text}.`,
    transit: (text: string) => ` (${text}).`,
    ships: (detail: string, text: string) => ` ${detail} It ships on ${text}.`,
    tracking: "You get a second email when it ships, with its tracking number.",
  },
  help: "Something not right?",
  helpLink: "Write to the concierge",
  helpTail: "quoting your order number.",
  home: "Return to the home page",
};
