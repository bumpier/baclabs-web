/**
 * The contact form's topics for a brand's site, as the props of
 * components/commerce/ContactForm.tsx. Server code: it reads lib/contact.ts,
 * which also carries BacLab's address and so must stay out of a brand's
 * bundle. The page passes the result to the form.
 *
 * The ids are lib/contact.ts's own, because ContactSchema accepts only those
 * and /admin/messages files messages by them. A brand gets every topic but
 * the trade one, which only a brand with a trade path offers, under its own
 * label (the wholesale site's quote form, the beauty site's clinic orders).
 */
import { CONTACT_MESSAGE_MAX, CONTACT_TOPICS } from "@/lib/contact";
import type { ContactTopicOption } from "@/components/commerce/ContactForm";

export { CONTACT_MESSAGE_MAX };

export function brandContactTopics(opts: {
  /** The trade topic's label, in the brand's words. Unset: no trade topic. */
  trade?: { label: string; hint?: string };
} = {}): ContactTopicOption[] {
  return CONTACT_TOPICS.flatMap((t): ContactTopicOption[] => {
    const hint = "hint" in t ? t.hint : undefined;
    if (t.id !== "wholesale") return [{ id: t.id, label: t.label, asksOrder: t.asksOrder, ...(hint ? { hint } : {}) }];
    if (!opts.trade) return [];
    const tradeHint = opts.trade.hint ?? hint;
    return [{ id: t.id, label: opts.trade.label, asksOrder: false, ...(tradeHint ? { hint: tradeHint } : {}) }];
  });
}
