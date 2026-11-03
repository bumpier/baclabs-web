import type { ContactMessage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ctaButton, escapeHtml, layout, send } from "@/lib/email";
import { canonicalOrigin } from "@/lib/site-url";
import { formatSaleDateTime } from "@/lib/saleTime";
import { LITERAL } from "@/lib/theme";
import { CONTACT_EMAIL, contactTopic, type ContactTopicId } from "@/lib/contact";

// What happens to a contact form message once the route has checked it:
// stored, then emailed to the contact inbox. The row is written first so the
// message survives a Resend outage; /admin/messages shows every one.
//
// Nothing goes back to the customer. A form that emails whatever address it
// is given, with text it is given, is a spam relay, and the reply from the
// inbox is the acknowledgement.

/** Where the alert goes. CONTACT_FORM_TO overrides the published address. */
export function contactInbox(): string {
  return process.env.CONTACT_FORM_TO?.trim() || CONTACT_EMAIL;
}

/**
 * An order reference as it might be typed: the id from the confirmation
 * email, the 8-character reference printed on the parcel label (upper-case),
 * with a stray "#" or spaces. Returns the lower-case form an order id starts
 * with, or null when it cannot be one.
 */
export function normaliseOrderRef(raw: string): string | null {
  const ref = raw.trim().replace(/^#/, "").replace(/\s+/g, "").toLowerCase();
  return /^[0-9a-f-]{8,36}$/.test(ref) ? ref : null;
}

/** The order a reference points at, when exactly one id starts with it. */
export async function findOrderByRef(raw: string): Promise<string | null> {
  const ref = normaliseOrderRef(raw);
  if (!ref) return null;
  const orders = await prisma.order.findMany({
    where: { id: { startsWith: ref } },
    select: { id: true },
    take: 2,
  });
  return orders.length === 1 ? orders[0]!.id : null;
}

export function adminMessageUrl(id: string): string {
  return `${canonicalOrigin()}/admin/messages/${id}`;
}

/** The alert for the contact inbox. Everything the customer typed is escaped. */
export function buildContactAlert(
  msg: Pick<ContactMessage, "id" | "topic" | "name" | "email" | "orderRef" | "message" | "createdAt">,
  orderId: string | null
): { subject: string; html: string } {
  const topic = contactTopic(msg.topic)?.label ?? msg.topic;
  const subject = `Contact form: ${topic} from ${msg.name}`;

  const orderLine = msg.orderRef
    ? orderId
      ? `<a href="${canonicalOrigin()}/admin/orders/${orderId}" style="color:${LITERAL.brand}">${escapeHtml(msg.orderRef)}</a>`
      : `${escapeHtml(msg.orderRef)} <span style="color:${LITERAL.inkSoft}">(no order matches this)</span>`
    : `<span style="color:${LITERAL.inkSoft}">Not given</span>`;

  // Outlook ignores white-space:pre-wrap, so line breaks are made explicit.
  const body = escapeHtml(msg.message).replace(/\r?\n/g, "<br>");

  const html = layout(
    `<p style="font-weight:bold;margin-top:0">${escapeHtml(topic)}</p>
      <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(msg.name)} &lt;${escapeHtml(msg.email)}&gt;</p>
      <p style="margin:0 0 4px"><strong>Order:</strong> ${orderLine}</p>
      <p style="margin:0 0 20px"><strong>Sent:</strong> ${formatSaleDateTime(msg.createdAt)} (UK time)</p>
      <div style="border-left:3px solid ${LITERAL.brand};padding:4px 0 4px 16px;margin:0 0 24px">${body}</div>
      <p style="margin:0 0 20px">Reply to this email to answer: it goes to ${escapeHtml(msg.email)}.</p>
      ${ctaButton(adminMessageUrl(msg.id), "Open in admin")}`,
    { preheader: `${topic} from ${msg.name}` }
  );
  return { subject, html };
}

export interface ContactInput {
  topic: ContactTopicId;
  name: string;
  email: string;
  orderRef?: string;
  message: string;
}

/**
 * Store the message, then email it to the inbox. Throws only if the row
 * cannot be written; a failed email leaves emailedAt null for the admin
 * list to show.
 */
export async function recordContactMessage(input: ContactInput): Promise<ContactMessage> {
  const row = await prisma.contactMessage.create({
    data: {
      topic: input.topic,
      // One line: it goes into the alert's subject.
      name: input.name.replace(/\s+/g, " ").trim(),
      email: input.email.trim().toLowerCase(),
      orderRef: input.orderRef?.trim() ?? "",
      message: input.message.trim(),
    },
  });

  try {
    const orderId = row.orderRef ? await findOrderByRef(row.orderRef) : null;
    const { subject, html } = buildContactAlert(row, orderId);
    const sent = await send(contactInbox(), subject, html, { replyTo: row.email });
    if (sent?.id) {
      return await prisma.contactMessage.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
    }
  } catch (err) {
    console.error(`[contact] alert failed for ${row.id}`, err);
  }
  return row;
}
