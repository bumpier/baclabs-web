/**
 * Accepted payment methods, as plain labelled chips.
 *
 * Deliberately typographic rather than redrawn brand logos: card-scheme marks
 * have strict usage rules, and an approximate redraw is worse than a clear
 * word. Stripe shows the real marks on its own hosted page regardless — these
 * exist only to answer "can I pay with Apple Pay?" before the customer
 * commits.
 */
const MARKS = ["Visa", "Mastercard", "American Express", "Apple Pay", "Google Pay"] as const;

export function PaymentMarks() {
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Accepted payment methods">
      {MARKS.map((m) => (
        <li
          key={m}
          className="rounded-full border border-line bg-paper px-2.5 py-1 text-2xs font-medium text-ink-soft"
        >
          {m}
        </li>
      ))}
    </ul>
  );
}
