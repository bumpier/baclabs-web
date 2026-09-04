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

export function layout(body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1b2b24">
    <h2 style="color:${LITERAL.brand}">${brand.name}</h2>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#6b7a72">${brand.name} · ${brand.contact.email}</p>
  </div>`;
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
