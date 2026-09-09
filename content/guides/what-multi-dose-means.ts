import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const whatMultiDoseMeans: Guide = {
  slug: "what-multi-dose-means",
  title: "What does multi-dose mean on a bacteriostatic water vial?",
  metaTitle: "What multi-dose means on bacteriostatic water",
  description: `A multi-dose vial can be entered more than once because a preservative works inside it. What that allows, what it does not, and why a limit applies.`,
  quickAnswer: `A multi-dose vial is one designed to be entered more than once. Bacteriostatic water qualifies because a preservative inhibits bacterial growth inside the vial between entries. That is what the term means and all it means: it does not make the contents sterile after entry, and the vial still has an in-use limit of ${FACTS.openedLimit}.`,
  updated: "2026-09-09",
  sections: [
    {
      heading: "What makes a vial multi-dose?",
      paragraphs: [
        `A multi-dose vial is one the manufacturer intends to be entered more than once. Three things make that possible: a stopper that reseals after a needle is withdrawn, a sterile fill, and a preservative that works on organisms introduced after the seal is first broken.`,
        `The stopper is the part people notice. It is an elastomer designed to close behind the needle rather than to be pierced once and thrown away, which is why a multi-dose vial has a crimped collar and a flip cap rather than a snap top.`,
        `The preservative is the part that actually earns the designation. Without it, resealing does nothing useful, because whatever came in on the first needle has an undisturbed environment to grow in until the second one arrives.`,
      ],
    },
    {
      heading: "Why can a preserved vial be entered more than once?",
      paragraphs: [
        `Every entry carries some risk of introducing organisms. A needle passes through the outer surface of the stopper, and that surface has been exposed to the air, to gloved hands and to whatever the vial has been resting on.`,
        `A bacteriostatic preservative inhibits the growth of bacteria that arrive that way. It does not prevent them arriving and it does not remove them. What it does is stop a small number of organisms multiplying into a large number between one entry and the next, which is the difference between a vial that can be used again next week and one that cannot.`,
        `**Bacteriostatic is not the same as bactericidal.** The word describes inhibiting growth, not killing. A vial that has taken in a significant contamination is not rescued by the preservative, and the appearance of the liquid is not a reliable way to tell.`,
      ],
    },
    {
      heading: "What does multi-dose not mean?",
      paragraphs: [
        "It does not mean the contents stay sterile. Sterility describes the vial as filled and sealed. Once a needle has gone through the stopper, the contents are preserved rather than sterile, and the two words describe different things.",
        "It does not mean the vial can be entered indefinitely. The preservative has a finite capacity and the risk accumulates with every entry, which is why an in-use limit exists rather than an open-ended permission.",
        "It does not mean the vial is protected from poor handling. A preservative works against a small bacterial challenge introduced under otherwise clean conditions. It is not a substitute for a clean needle, a disinfected stopper or a vial that has been stored properly.",
      ],
    },
    {
      heading: `Why is the in-use limit ${FACTS.openedLimitDays} days?`,
      paragraphs: [
        `${FACTS.openedLimitDays} days is the conventional in-use period for preserved multi-dose vials, and it is the figure printed as the in-use limit on this product. It is a handling convention rather than a measurement of when the preservative stops working, which is why it is a round number.`,
        `The logic behind it is cumulative risk. Each entry adds a small chance of introducing organisms, and each day adds time for anything introduced to establish itself. A fixed window caps both without requiring anyone to track how many entries a particular vial has had.`,
        `The clock starts at first puncture and runs on the calendar. It is not paused by refrigeration and not extended by the vial being nearly full. Whatever is left on day ${FACTS.openedLimitDays} is discarded.`,
      ],
      table: {
        caption: "Single-use and multi-dose vials compared",
        columns: ["", "Single-use vial", "Multi-dose vial"],
        rows: [
          ["Preservative", "None", "Bacteriostatic preservative"],
          ["Entries intended", "One", "Several"],
          ["Stopper", "Often a snap top", "Resealing stopper, crimped collar"],
          ["After first entry", "Discard the remainder", `Usable for ${FACTS.openedLimit}`],
          ["Contents after entry", "No longer sterile", "No longer sterile, preserved"],
        ],
      },
    },
    {
      heading: "Does the number of entries matter as well as the days?",
      paragraphs: [
        `Both matter, and the limit is written in days because days are easier to track. A vial entered twice over four weeks has taken on less cumulative risk than one entered thirty times over the same period, even though the same in-use limit applies to each.`,
        `In practice the volume runs out before the entry count becomes the binding constraint on a ${FACTS.vialMl} ml vial. A vial drawn from daily at half a millilitre empties in twenty days, inside the window. A vial drawn from weekly reaches day ${FACTS.openedLimitDays} with most of its contents unused.`,
        `Where a workflow involves many small entries, the thing to watch is the stopper. Repeated puncturing in the same place eventually damages the elastomer and it stops resealing cleanly, which is a reason to discard early regardless of the date.`,
      ],
    },
    {
      heading: "How should a multi-dose vial be treated between entries?",
      paragraphs: [
        `As an open container that happens to have a preservative in it. Disinfect the stopper before every entry rather than only the first, use a fresh needle each time, and return the vial to the storage conditions the label states rather than leaving it on a bench between sessions.`,
        `Write the date of first entry on the label. The in-use limit is only useful if the person picking the vial up next can see when the period started, and a vial with no date on it is a vial no one can vouch for.`,
        `Discard on appearance regardless of the date. Cloudiness, discolouration or visible particles mean the contents no longer meet the appearance criterion, and the preservative does not make a contaminated vial usable again.`,
      ],
    },
  ],
  faq: [
    {
      q: "Does multi-dose mean the vial stays sterile?",
      a: "No. Sterility describes the vial as sealed. After the first entry the contents are preserved rather than sterile, which is a different and weaker claim.",
    },
    {
      q: "How many times can a vial be entered?",
      a: `There is no fixed entry count. The limit is written in days, ${FACTS.openedLimit}, because days are easier to track. Discard earlier if the stopper is damaged or the contents change in appearance.`,
    },
    {
      q: "What is the difference between bacteriostatic and bactericidal?",
      a: "Bacteriostatic means inhibiting bacterial growth. Bactericidal means killing bacteria. The preservative in a multi-dose vial is the first, so it holds a small contamination in check rather than clearing it.",
    },
    {
      q: "Does refrigeration extend the in-use limit?",
      a: `No. The limit runs on the calendar from first puncture. Storing the vial as the label directs is a condition of the limit applying, not a way to extend it beyond ${FACTS.openedLimitDays} days.`,
    },
    {
      q: "Can an unpreserved vial be treated as multi-dose?",
      a: "No. Without a preservative there is nothing inhibiting growth between entries, which is why sterile water and ordinary saline are single use once opened regardless of how much is left.",
    },
  ],
  related: ["what-is-bacteriostatic-water", "how-long-does-bacteriostatic-water-last"],
};
