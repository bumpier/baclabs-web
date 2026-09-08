import { Resend } from "resend";
import { brand } from "@/config/brand";
import { canonicalOrigin } from "@/lib/site-url";
import { LITERAL } from "@/lib/theme";

// Transactional email via Resend (HTTP API).
// Without RESEND_API_KEY (local dev), emails are logged to the server
// console instead — never in production.

const from = process.env.EMAIL_FROM ?? `${brand.name} <noreply@example.com>`;

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

export async function send(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      // Dev: surface the email body so flows are testable without a mail provider.
      console.log(`[dev email] to=${to} subject="${subject}"\n${html}`);
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

/** The brand-blue pill CTA used across every transactional email. */
export function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:${LITERAL.brand};color:#ffffff;padding:12px 28px;border-radius:24px;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(label)}</a>`;
}

/**
 * Wraps an email body in the shared BacLab shell: dark header band, white
 * card, neutral footer with the compliance line. Table-based markup, not
 * flex/grid — Outlook's rendering engine (Word) only understands tables.
 *
 * `preheader` is the hidden text inbox lists show as the preview snippet;
 * without it clients fall back to the email's opening HTML (e.g. a stray
 * "Hi ,") which reads as broken before the message is even opened.
 */
export function layout(body: string, opts?: { preheader?: string }): string {
  const preheader = opts?.preheader;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${brand.name}</title>
</head>
<body style="margin:0;padding:0;background:${LITERAL.neutral};font-family:${FONT_STACK}">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LITERAL.neutral}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${LITERAL.paper};border-radius:12px;overflow:hidden">
<tr><td style="background:${LITERAL.abyss};padding:24px 32px">
<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.02em">${brand.name}</span>
</td></tr>
<tr><td style="padding:32px;color:${LITERAL.ink};font-size:15px;line-height:1.6">
${body}
</td></tr>
<tr><td style="padding:20px 32px;background:${LITERAL.neutral};border-top:1px solid ${LITERAL.line}">
<p style="margin:0 0 6px;font-size:12px;color:${LITERAL.inkSoft}">${brand.name}${brand.contact.email ? ` &middot; <a href="mailto:${brand.contact.email}" style="color:${LITERAL.inkSoft}">${brand.contact.email}</a>` : ""}</p>
<p style="margin:0;font-size:11px;color:${LITERAL.inkSoft};line-height:1.5">${escapeHtml(brand.disclaimer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

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
