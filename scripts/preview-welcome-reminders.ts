/**
 * Writes the two welcome-vial reminder emails (lib/welcome-reminders.ts) as
 * HTML files, so the copy and the layout can be read in a browser before
 * anything is sent. Run with `npm run preview:reminders [directory]`.
 * Needs no database and sends nothing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reminderEmail } from "@/lib/welcome-reminders";
import { MAILING_LIST } from "@/config/funnel";

process.env.JWT_SECRET ??= "preview-secret-that-is-at-least-32-characters-long";

const dir = process.argv[2] ?? join(tmpdir(), "baclab-reminder-preview");
mkdirSync(dir, { recursive: true });

const subscriber = {
  id: "preview",
  email: "you@example.com",
  welcomeBonusUntil: new Date(Date.now() + MAILING_LIST.reminders.bonus.validDays * 86_400_000),
};

for (const step of [1, 2] as const) {
  const email = reminderEmail(step, subscriber);
  const file = join(dir, `reminder-${step}.html`);
  writeFileSync(file, email.html);
  console.log(`Reminder ${step}: "${email.subject}"\n  ${email.preheader}\n  ${file}`);
}
