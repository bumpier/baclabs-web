import { Resend } from "resend";
import { brand } from "@/config/brand";
import { brandFor, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import { canonicalOrigin } from "@/lib/site-url";
import { LITERAL } from "@/lib/theme";

// Transactional email via Resend (HTTP API).
// Without RESEND_API_KEY (local dev), emails are logged to the server
// console instead — never in production.
//
// Every customer email is in one brand's voice (brands/registry.ts): its
// from-address, its name in the header, its colours, its contact line and
// its disclaimer. Callers pass the brand of the row they are handling
// (brandFor(order.brand), brandFor(subscriber.brand), ...). Leaving it out
// means BacLab, which is what every email was before brands existed.

/** The brand an email is in when the caller names none. */
function defaultBrand(): BrandProfile {
  return brandFor(DEFAULT_BRAND);
}

/**
 * "[GymWater] " before the subject of an email to the owner (new order,
 * contact form), so one inbox can tell the brands apart. Nothing for BacLab:
 * its subjects stay exactly as they were, and so do the owner's inbox
 * filters on them.
 */
export function ownerSubjectPrefix(b: BrandProfile): string {
  return b.id === DEFAULT_BRAND ? "" : `[${b.name}] `;
}

// Constructed lazily: the Resend client throws when handed an empty key, and
// this module is imported by pages that render fine with email switched off.
let client: Resend | null = null;
function getClient(apiKey: string): Resend {
  if (!client) client = new Resend(apiKey);
  return client;
}

/**
 * Email is enabled only when Resend is configured. With the key blank the app
 * runs normally and email-dependent flows (password reset) are hidden. No mail
 * provider is ever assumed as a default.
 */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function send(
  to: string | string[],
  subject: string,
  html: string,
  opts?: {
    bcc?: string;
    replyTo?: string;
    headers?: Record<string, string>;
    /** Resend allows 40 MB per email in all, after base64. */
    attachments?: { filename: string; content: Buffer }[];
    /** Whose address it goes from. BacLab's when unset. */
    brand?: BrandProfile;
  }
) {
  const from = (opts?.brand ?? defaultBrand()).email.from;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      // Dev: surface the email body so flows are testable without a mail provider.
      console.log(
        `[dev email] to=${to}${opts?.bcc ? ` bcc=${opts.bcc}` : ""}${opts?.replyTo ? ` reply-to=${opts.replyTo}` : ""} subject="${subject}"\n${html}`
      );
    }
    // Blank in production → email intentionally disabled → stay silent.
    return;
  }
  // Resend only accepts a From address on a domain verified in your account.
  // The placeholder default would 403 on every send, so fail loudly once here
  // rather than silently dropping every customer receipt.
  if (from.includes("example.com")) {
    console.error(
      "[email] EMAIL_FROM is still the placeholder (example.com) — Resend will reject every send. Set it to an address on your verified domain."
    );
    return;
  }
  try {
    // The SDK reports API failures in `error` rather than throwing.
    const { data, error } = await getClient(apiKey).emails.send({
      from,
      to,
      subject,
      html,
      ...(opts?.bcc ? { bcc: opts.bcc } : {}),
      ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts?.headers ? { headers: opts.headers } : {}),
      ...(opts?.attachments?.length ? { attachments: opts.attachments } : {}),
    });
    if (error) {
      console.error("[email] Resend send failed", JSON.stringify(error));
    }
    return data ?? undefined;
  } catch (err) {
    // Network/transport failure. Never rethrow: callers fire-and-forget these
    // (e.g. `void sendNewOrderAlert(order)`) and an order must not fail because
    // its receipt did.
    console.error("[email] Resend send failed", err);
  }
}

export interface BatchEmail {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

/** One result per email handed to sendBatch, in the same order. */
export type BatchResult = { ok: true; id: string | null } | { ok: false; error: string };

/**
 * Up to 100 emails in one Resend call (the batch API's limit). Never throws:
 * a failure is returned against every email in the batch, for the caller to
 * record and retry. `idempotencyKey` makes a retried call return the first
 * call's result instead of sending again, so it must identify exactly these
 * emails.
 *
 * Without RESEND_API_KEY it logs in development and reports success, so a
 * campaign can be walked through end to end locally; in production it
 * reports failure, because an unsent campaign must not read as sent.
 *
 * Every email in one batch goes out from the same brand, `b`.
 */
export async function sendBatch(
  emails: BatchEmail[],
  idempotencyKey: string,
  b: BrandProfile = defaultBrand()
): Promise<BatchResult[]> {
  if (emails.length === 0) return [];
  const from = b.email.from;
  if (emails.length > 100) throw new Error("sendBatch takes at most 100 emails");
  const fail = (error: string): BatchResult[] => emails.map(() => ({ ok: false, error }));

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      for (const e of emails) console.log(`[dev email batch] to=${e.to} subject="${e.subject}"`);
      return emails.map(() => ({ ok: true, id: null }));
    }
    return fail("RESEND_API_KEY is not set");
  }
  if (from.includes("example.com")) return fail("EMAIL_FROM is still the placeholder (example.com)");

  try {
    const { data, error } = await getClient(apiKey).batch.send(
      emails.map((e) => ({
        from,
        to: e.to,
        subject: e.subject,
        html: e.html,
        ...(e.headers ? { headers: e.headers } : {}),
      })),
      { idempotencyKey }
    );
    if (error || !data) {
      console.error("[email] Resend batch failed", JSON.stringify(error));
      return fail(error?.message ?? "Resend returned no data");
    }
    return emails.map((_, i) => ({ ok: true, id: data.data[i]?.id ?? null }));
  } catch (err) {
    console.error("[email] Resend batch failed", err);
    return fail(err instanceof Error ? err.message : "Network error");
  }
}

// Single-quoted font names: this stack is interpolated into a
// double-quoted style="..." attribute, so a literal " would close it early.
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Escapes user-supplied text (customer name, shipping address, etc.) before
 * it's interpolated into an email. Nothing upstream of these templates
 * escapes for us — they're plain strings, not a templating engine's tree.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The pill CTA used across every transactional email, in the brand's button colour. */
export function ctaButton(url: string, label: string, b: BrandProfile = defaultBrand()): string {
  return `<a href="${url}" style="display:inline-block;background:${b.colours.cta};color:${b.colours.onCta ?? "#ffffff"};padding:12px 28px;border-radius:24px;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(label)}</a>`;
}

/**
 * Wraps an email body in the brand's shell: a header band with its name, a
 * white card, and a neutral footer with its contact and compliance lines.
 * Table-based markup, not flex/grid — Outlook's rendering engine (Word) only
 * understands tables.
 *
 * `preheader` is the hidden text inbox lists show as the preview snippet;
 * without it clients fall back to the email's opening HTML (e.g. a stray
 * "Hi ,") which reads as broken before the message is even opened.
 */
export function layout(body: string, opts?: { preheader?: string; brand?: BrandProfile }): string {
  const preheader = opts?.preheader;
  const b = opts?.brand ?? defaultBrand();
  const c = b.colours;
  // Escaped: a brand name can hold an "&".
  const name = escapeHtml(b.name);
  const contact = b.email.contact;
  const onHeader = c.onHeader ?? "#ffffff";
  const centred = b.email.headerAlign === "center";
  // The brand's wordmark when it has one. Its alt text is the name, styled
  // as the name is, for a client that has images switched off.
  const logo = b.email.logo;
  const mark = logo
    ? `<img src="${b.origin}${logo.src}" width="${logo.width}" height="${logo.height}" alt="${name}" style="display:block;${centred ? "margin:0 auto;" : ""}border:0;outline:none;text-decoration:none;max-width:100%;height:auto;color:${onHeader};font-size:18px;font-weight:700;letter-spacing:0.02em" />`
    : `<span style="color:${onHeader};font-size:18px;font-weight:700;letter-spacing:0.02em">${name}</span>`;
  // A header in the card's own colour has no band, so a rule closes it.
  const headerRule = c.header === c.paper ? `;border-bottom:1px solid ${c.line}` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background:${c.neutral};font-family:${FONT_STACK}">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.neutral}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${c.paper};border-radius:12px;overflow:hidden">
<tr><td${centred ? ` align="center"` : ""} style="background:${c.header};padding:24px 32px${headerRule}">
${mark}
</td></tr>
<tr><td style="padding:32px;color:${c.ink};font-size:15px;line-height:1.6">
${body}
</td></tr>
<tr><td style="padding:20px 32px;background:${c.neutral};border-top:1px solid ${c.line}">
<p style="margin:0 0 6px;font-size:12px;color:${c.inkSoft}">${name}${contact ? ` &middot; <a href="mailto:${contact}" style="color:${c.inkSoft}">${contact}</a>` : ""}</p>
<p style="margin:0;font-size:11px;color:${c.inkSoft};line-height:1.5">${escapeHtml(b.disclaimer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// The affiliate programme's emails below are BacLab's own (affiliates sign
// up on BacLab's site), so they keep BacLab's shell and canonical origin.

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${canonicalOrigin()}/auth/verify?token=${token}`;
  await send(
    to,
    `Verify your ${brand.name} account`,
    layout(`<p>Welcome! Please confirm your email address to activate your affiliate dashboard.</p>
      <p><a href="${url}" style="background:${LITERAL.brand};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Verify email</a></p>
      <p>Or copy this link: ${url}</p>`)
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${canonicalOrigin()}/auth/reset-password?token=${token}`;
  await send(
    to,
    `Reset your ${brand.name} password`,
    layout(`<p>We received a request to reset your password. This link expires in 1 hour.</p>
      <p><a href="${url}" style="background:${LITERAL.brand};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>`)
  );
}

export async function sendMasterPromotionEmail(to: string, referralCode: string) {
  const url = `${canonicalOrigin()}/auth/register?recruiter=${referralCode}`;
  await send(
    to,
    `You're now a ${brand.name} Master affiliate`,
    layout(`<p>Congratulations! You've been promoted to <strong>Master affiliate</strong>.</p>
      <p>You can now recruit your own affiliates. Anyone who joins through your personal link below becomes part of your team, and you'll earn an extra commission on every confirmed sale they generate — on top of their own earnings.</p>
      <p><a href="${url}" style="background:${LITERAL.brand};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Your recruit link</a></p>
      <p>Or copy this link: ${url}</p>
      <p>Your full team overview is available in your affiliate dashboard.</p>`)
  );
}

export async function sendAffiliateInviteEmail(to: string, token: string) {
  const url = `${canonicalOrigin()}/auth/register?token=${token}`;
  await send(
    to,
    `You're invited to the ${brand.name} affiliate programme`,
    layout(`<p>You've been invited to join the ${brand.name} affiliate programme. This invite expires in 48 hours and can be used once.</p>
      <p><a href="${url}" style="background:${LITERAL.brand};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Create your account</a></p>
      <p>Or copy this link: ${url}</p>`)
  );
}
