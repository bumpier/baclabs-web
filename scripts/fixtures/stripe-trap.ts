/**
 * Counts every Stripe client this process makes, so a test can prove a path
 * never makes one. Not a test file itself: a test-*.ts script imports it
 * FIRST, before anything loads the Stripe SDK.
 *
 * tsx runs these scripts as CommonJS, so `import Stripe from "stripe"`
 * (lib/payments/stripe.ts) is a require() through Module._load. The hook
 * hands back the SDK's own constructor behind a Proxy that counts each
 * `new Stripe(...)` (or call without `new`) and otherwise behaves exactly
 * as the SDK does: static members, `instanceof`, webhooks helpers.
 */
import Module from "node:module";

let made = 0;
let trapped: unknown = null;

type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const mod = Module as unknown as { _load: Loader };
const load = mod._load;
mod._load = function (this: unknown, request: string, parent: unknown, isMain: boolean) {
  const loaded = load.call(this, request, parent, isMain);
  if (request !== "stripe") return loaded;
  trapped ??= new Proxy(loaded as (...args: unknown[]) => object, {
    construct(target, args, newTarget) {
      made++;
      return Reflect.construct(target, args, newTarget);
    },
    apply(target, self, args) {
      made++;
      return Reflect.apply(target, self, args);
    },
  });
  return trapped;
};

/** How many Stripe clients have been made since the trap was set. */
export function stripeClientsMade(): number {
  return made;
}
