import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const howToReadAVialLabel: Guide = {
  slug: "how-to-read-a-vial-label",
  title: "How to read a bacteriostatic water vial label",
  metaTitle: "How to read a bacteriostatic water vial label",
  description: `Every field on a bacteriostatic water label and what it governs: batch number, expiry, fill volume, storage and the in-use limit.`,
  quickAnswer: `A vial label carries the solution name, the fill volume, a batch or lot number, an expiry date, a storage instruction and usually the in-use limit once opened. The batch number and expiry belong to that vial alone. Where the label and a general figure disagree, the label governs.`,
  updated: "2026-09-09",
  sections: [
    {
      heading: "What is printed on a bacteriostatic water vial?",
      paragraphs: [
        `A small vial has very little room, so what survives onto the label is what governs handling. Expect six things: what the solution is, how much of it there is, which batch it came from, when it expires, how to store it, and how long it may be used once entered.`,
        `Some of those fields describe the product in general and are the same on every vial. Others describe this vial specifically and are printed at the point of filling. Telling the two apart is most of what reading a label well amounts to, because only the second kind can answer a question about the vial in your hand.`,
      ],
      table: {
        caption: "Fields on a vial label and what each one governs",
        columns: ["Field", "What it tells you", "Batch-specific"],
        rows: [
          ["Solution name", "What is in the vial, including whether it is preserved", "No"],
          ["Fill volume", `The nominal contents, commonly ${FACTS.vialMl} ml`, "No"],
          ["Batch or lot number", "Which production run it came from", "Yes"],
          ["Expiry date", "The last date the unopened vial may be used", "Yes"],
          ["Storage", "The conditions the stated shelf life assumes", "No"],
          ["In-use limit", "How long after first entry the vial may be used", "No"],
        ],
      },
    },
    {
      heading: "What does the batch or lot number do?",
      paragraphs: [
        `The batch number identifies the production run the vial came from. It is the field that connects a physical vial to the paperwork behind it, and without it a certificate of analysis or a specification is describing nothing you can check.`,
        `When a supplier publishes documentation, the useful question is whether the batch on the document matches the batch on the vial. A document with no batch identifier, or one that does not match, tells you about some other production run. It may still be accurate, but it is not evidence about the vial in front of you.`,
        `**Record the batch number before the label is discarded.** Once the vial is gone the link to the documentation is gone with it, and a query weeks later has nothing to reference.`,
      ],
    },
    {
      heading: "What does the expiry date mean?",
      paragraphs: [
        `The expiry applies to the unopened vial stored as the label directs. It is set from the batch's own production date and stability data, which is why it is batch-specific and why it cannot be inferred from a general figure about how long the product lasts.`,
        `Expiry and the in-use limit are two separate clocks and both apply. An unopened vial within its expiry is usable. Once entered, the in-use limit starts and runs independently, so a vial can reach the end of its in-use period long before its printed expiry, and a vial opened close to its expiry is governed by whichever date comes first.`,
        `A date printed as a month and year means the end of that month unless the label says otherwise.`,
      ],
    },
    {
      heading: "What does the storage line tell you?",
      paragraphs: [
        `The storage instruction is the condition the stated shelf life assumes. It is not a recommendation to be improved on. A vial kept warmer than the label allows may still look unchanged and still be outside the conditions its expiry was set under.`,
        `Labels differ between suppliers and between markets, so the instruction on the vial is the one to follow rather than a figure remembered from a different product. Where a range is printed, the whole range is acceptable and there is no benefit in aiming for one end of it.`,
        `Storage conditions before first entry and handling after it are separate questions. The storage line covers the first; the in-use limit covers the second.`,
      ],
    },
    {
      heading: "What is the in-use limit and where does it appear?",
      paragraphs: [
        `The in-use limit is how long a vial may be used after the stopper has first been punctured. For a preserved multi-dose vial it is conventionally ${FACTS.openedLimit}, and it starts at the first entry, not at the first use of the contents.`,
        `It is often printed on the label, sometimes on the carton, and sometimes only in the accompanying documentation. If it does not appear on the vial itself, write the date of first entry on the label so the clock is visible to whoever picks the vial up next.`,
        `The limit runs on the calendar. It is not extended by refrigeration, by the vial still being nearly full, or by the contents looking unchanged.`,
      ],
    },
    {
      heading: "What is not on the label, and where does it live?",
      paragraphs: [
        `A vial label carries handling information, not a full specification. Properties such as appearance criteria, pH where it is specified, and the hazard classification of the mixture sit in the safety data sheet and the supplier's specification rather than on the glass.`,
        `For this product the appearance criterion is ${FACTS.appearance.toLowerCase()}, and the mixture is ${FACTS.hazardClassification.toLowerCase()}. Neither of those changes between batches, which is why they are published once rather than reprinted on every vial.`,
        `If a field you need is not on the label and not in the published documentation, that is a question for the supplier rather than something to infer from a comparable product.`,
      ],
    },
    {
      heading: "When should a vial be discarded on the strength of the label?",
      paragraphs: [
        `Past its printed expiry, past its in-use limit, or where the label is missing or illegible. A vial that cannot be identified cannot be relied on, because every question about it depends on knowing which batch it is and when it was filled.`,
        `Discard also on appearance regardless of what the dates say. Cloudiness, discolouration or visible particles mean the contents no longer meet the appearance criterion, and no date on the label overrides what is visible in the vial.`,
        `A damaged seal, a lifted cap or a stopper that has come loose puts the vial outside the conditions the label describes, whatever the dates on it.`,
      ],
    },
  ],
  faq: [
    {
      q: "What is the batch number for?",
      a: "It identifies the production run the vial came from and links it to the supplier's documentation. A certificate of analysis is only evidence about your vial if its batch number matches the one printed on the label.",
    },
    {
      q: "Does the expiry date apply after the vial is opened?",
      a: `No. The expiry applies to the unopened vial. Once the stopper is punctured the in-use limit of ${FACTS.openedLimit} applies as well, and whichever date comes first governs.`,
    },
    {
      q: "Why is the unopened shelf life not stated as one figure?",
      a: "Because it is set per batch from that batch's production date, so it differs between vials from different runs. The date printed on the vial is the only one that applies to it.",
    },
    {
      q: "What if the in-use limit is not printed on the vial?",
      a: "Check the carton and the supplier's documentation. Write the date of first entry on the label either way, so the person who picks the vial up next can see when the period started.",
    },
    {
      q: "Is a label with a month and year an end-of-month date?",
      a: "Conventionally yes, the vial is usable to the last day of the printed month unless the label states otherwise. Where it matters, treat the earlier interpretation as the safe one.",
    },
  ],
  related: ["how-to-store-bacteriostatic-water", "how-long-does-bacteriostatic-water-last"],
};
