import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

/** Draw counts for the standard vial, derived rather than typed. */
const drawsAtQuarterMl = FACTS.vialMl * 4;
const drawsAtHalfMl = FACTS.vialMl * 2;
const drawsAt1ml = FACTS.vialMl;
const drawsAt2ml = FACTS.vialMl / 2;
const drawsAt5ml = FACTS.vialMl / 5;
/** Usable volume once the short last draw is allowed for. */
const usableMl = FACTS.vialMl - 1;
/** Whole weeks inside the in-use limit. */
const weeksInLimit = Math.floor(FACTS.openedLimitDays / 7);
/** A planned run of work, in weeks, used for the worked examples. */
const runWeeks = weeksInLimit * 3;
const windowsInRun = Math.ceil(runWeeks / weeksInLimit);

export const howManyDrawsFromAVial: Guide = {
  slug: "how-many-draws-from-a-vial",
  title: `How many draws can you take from a ${FACTS.vialMl} ml vial of bacteriostatic water?`,
  metaTitle: `How many draws from a ${FACTS.vialMl} ml bacteriostatic water vial`,
  description: `A ${FACTS.vialMl} ml vial gives ${drawsAt1ml} draws of 1 ml or ${drawsAtHalfMl} of 0.5 ml, but the ${FACTS.openedLimitDays}-day in-use limit and syringe dead volume set the real count. How to plan vials for a run.`,
  quickAnswer: `A ${FACTS.vialMl} ml vial gives ${drawsAt1ml} draws of 1 ml or ${drawsAtHalfMl} draws of 0.5 ml, less a little lost in the syringe hub. The in-use limit of ${FACTS.openedLimit} is the other ceiling: whatever is left on day ${FACTS.openedLimitDays} is discarded, so a vial can run out of time before it runs out of water.`,
  updated: "2026-09-08",
  sections: [
    {
      heading: `How many draws does a ${FACTS.vialMl} ml vial give?`,
      paragraphs: [
        `The first answer is division. A vial holds a nominal ${FACTS.vialMl} ml, so the number of draws is ${FACTS.vialMl} divided by the volume withdrawn each time. Draw 1 ml and you get ${drawsAt1ml} draws. Draw 2 ml and you get ${drawsAt2ml}. Draw 0.5 ml and you get ${drawsAtHalfMl}. The liquid is the same sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol from the first draw to the last.`,
        `Two things push the real count below the paper figure. The in-use limit of ${FACTS.openedLimit} stops the clock whether or not the vial is empty, and a small volume never reaches the receiving vessel because it stays in the syringe hub, the needle and the bottom of the vial. The table gives the arithmetic; the sections below make the adjustments.`,
      ],
      table: {
        caption: `Draws from one ${FACTS.vialMl} ml vial by volume withdrawn each time`,
        columns: ["Volume per draw", "Draws per vial", "Days to empty at one draw a day"],
        rows: [
          ["0.25 ml", `${drawsAtQuarterMl}`, `${drawsAtQuarterMl}, past the ${FACTS.openedLimitDays}-day limit`],
          ["0.5 ml", `${drawsAtHalfMl}`, `${drawsAtHalfMl}`],
          ["1 ml", `${drawsAt1ml}`, `${drawsAt1ml}`],
          ["2 ml", `${drawsAt2ml}`, `${drawsAt2ml}`],
          ["5 ml", `${drawsAt5ml}`, `${drawsAt5ml}`],
        ],
      },
    },
    {
      heading: `Why is the ${FACTS.openedLimitDays}-day limit often the real ceiling?`,
      paragraphs: [
        `Once the stopper has been punctured, the vial is discarded ${FACTS.openedLimit}. That limit runs on the calendar, not on the volume. A vial drawn from once a week gives ${weeksInLimit} draws in ${FACTS.openedLimitDays} days. At 1 ml a draw that is ${weeksInLimit} ml used and ${FACTS.vialMl - weeksInLimit} ml discarded; at 0.5 ml it is ${weeksInLimit / 2} ml used and ${FACTS.vialMl - weeksInLimit / 2} ml discarded.`,
        `So the question is not only how many draws a vial holds, but how many you will make before day ${FACTS.openedLimitDays}. For daily work at 0.5 ml or more, the volume runs out first and the table holds. For weekly or twice-weekly work, the date runs out first, and draws per vial is set by frequency rather than by size.`,
        `The two ceilings meet where days to empty equals ${FACTS.openedLimitDays}. Faster than that is volume-limited; slower is time-limited, and the leftover is the price of keeping to the label.`,
      ],
    },
    {
      heading: "Why is the last draw from a vial often short?",
      paragraphs: [
        `Manufacturers usually fill a little over the nominal ${FACTS.vialMl} ml so the labelled volume can be withdrawn, but the surplus is small and not something to rely on. What matters more is the volume that leaves the vial and never reaches the receiving vessel.`,
        "A standard syringe with a detachable needle has a dead space: the hub and the needle bore hold liquid the plunger cannot push out. It is a few hundredths of a millilitre for a typical combination, lost on every draw because it is drawn up with the rest and left behind on transfer. Over ten draws it adds up to a measurable fraction of a millilitre. Low dead space syringes reduce the loss but do not remove it.",
        `The vial keeps some too. As the level drops the needle has to reach the last of the liquid, and once the meniscus falls below the tip the draw pulls air. Tilting helps, but a residue always clings to the glass and the underside of the stopper. The practical rule most laboratories use is to plan on one draw fewer than the arithmetic gives, so about ${usableMl} ml usable.`,
        `**Small draws feel this more.** Losing 0.05 ml from a 2 ml draw is a rounding error; from a 0.25 ml draw it is a fifth of the volume, so a vial drawn at very small volumes rarely delivers the full ${drawsAtQuarterMl}.`,
      ],
    },
    {
      heading: "Does the number of punctures matter?",
      paragraphs: [
        `Yes, in two ways. The first is contamination. The preservative inhibits the growth of organisms that get past the stopper; it does not sterilise. Every entry with a needle is a chance to carry something in from the air, the stopper surface or the needle itself. Twenty entries carry more chances than five, which is one reason the in-use limit is ${FACTS.openedLimit} and not longer.`,
        "The second is the stopper. Each puncture removes, or nearly removes, a small plug of rubber, and a stopper entered many times at the same spot can shed fragments into the liquid. This is coring. It is more likely with large-bore, blunt or reused needles and with entries made straight down through the same hole.",
        "Fewer, larger draws are therefore kinder to the vial than many tiny ones, where the procedure allows. If a session needs 0.5 ml at four points, a single 2 ml draw into a clean intermediate vessel is one puncture rather than four. That is a workflow choice, and only sensible when the transfer is prompt.",
      ],
      list: [
        "New sterile needle for every entry, discarded after use.",
        "Stopper swabbed with alcohol and allowed to dry before the needle goes in.",
        "Entry at a slight angle, bevel up, at a fresh point on the stopper.",
        "The date of first puncture written on the vial before the first draw.",
        "Any visible rubber fragment in the liquid means the vial is discarded.",
      ],
    },
    {
      heading: "How many vials do you need for a planned run of work?",
      paragraphs: [
        `Two calculations, and the answer is the larger. By volume: total millilitres across the run, divided by the roughly ${usableMl} ml usable per vial. By time: days of work divided by ${FACTS.openedLimitDays}, rounded up, because every ${FACTS.openedLimitDays}-day window in which any draw is made needs its own vial.`,
        `Take a ${runWeeks}-week run drawing 2 ml once a week. By volume that is ${runWeeks * 2} ml, or ${Math.ceil((runWeeks * 2) / usableMl)} vials. By time it is ${windowsInRun} windows of ${weeksInLimit} weeks, so ${windowsInRun} vials. The two agree.`,
        `Now take the same ${runWeeks}-week run drawing 0.5 ml once a week. By volume that is ${runWeeks * 0.5} ml, which one vial holds comfortably. By time it is still ${windowsInRun} windows, so still ${windowsInRun} vials, and most of each will be discarded. That is where buying by volume goes wrong: the run needs ${windowsInRun} sealed vials opened one at a time, not one vial nursed past its limit.`,
        `This is why a laboratory ordering for a run counts vials rather than millilitres, and why packs are sold by the vial, from 1 to 100. A pack of ${windowsInRun} covers the ${runWeeks}-week example; a larger pack covers a longer run or parallel work, each vial staying sealed until it is opened. A spare on the shelf is cheap insurance against a short last draw or a vial discarded early.`,
      ],
      list: [
        `Vials by volume: total ml needed, divided by ${usableMl} ml, rounded up.`,
        `Vials by time: days of work divided by ${FACTS.openedLimitDays}, rounded up.`,
        "Order the larger of the two, plus one spare for a long or important run.",
      ],
    },
    {
      heading: "When does a 3 ml or 30 ml vial make more sense?",
      paragraphs: [
        "A 3 ml vial suits work that needs a millilitre or two in total and then stops: three draws of 1 ml and it is empty well inside the in-use window with nothing thrown away. The trade is that the glass, stopper and crimp cost the same as on a bigger vial, and a run of any length means opening a new vial every few days.",
        `A 30 ml vial suits the opposite case: large, frequent draws that would empty a ${FACTS.vialMl} ml vial in two or three days, so one vial replaces several. At 5 ml a draw, a ${FACTS.vialMl} ml vial gives ${drawsAt5ml} draws and a 30 ml vial gives six. The condition is unchanged: all 30 ml has to be used within ${FACTS.openedLimit}, or the leftover is discarded and the size advantage disappears.`,
        `Between those cases sits most laboratory work, with draws of 0.5 ml to 2 ml made daily or a few times a week. There the ${FACTS.vialMl} ml vial fits the ${FACTS.openedLimitDays}-day limit with the least left over, which is why it is the common UK laboratory size and the one BacLab sells.`,
      ],
    },
    {
      heading: "When should a vial be discarded whatever is left in it?",
      paragraphs: [
        `The count of draws is a planning figure, not a licence to keep going. A vial is discarded when any of the following applies, however much of the ${FACTS.vialMl} ml remains. Appearance overrides the date, and the date overrides the volume.`,
      ],
      list: [
        `More than ${FACTS.openedLimitDays} days since first puncture, or an opened vial with no date written on it.`,
        `Any change from ${FACTS.appearance.toLowerCase()}: cloudiness, a tint, a surface film, or particles floating or settled.`,
        "Rubber fragments from the stopper, or a stopper that no longer reseals and weeps when the vial is inverted.",
        "A crimp or stopper that is loose, damaged or shows any sign of tampering.",
        "A draw made with a needle that touched anything unsterile or had already been used.",
        "A sealed vial past its printed expiry, or one that has been frozen or left in heat.",
      ],
    },
  ],
  faq: [
    {
      q: "How many times can you use a vial of bacteriostatic water?",
      a: `As many draws as the volume allows, within ${FACTS.openedLimit}. A ${FACTS.vialMl} ml vial gives ${drawsAt1ml} draws of 1 ml or ${drawsAtHalfMl} of 0.5 ml on paper, and one fewer in practice. After ${FACTS.openedLimitDays} days it is discarded whatever is left.`,
    },
    {
      q: `How many 1 ml draws are in a ${FACTS.vialMl} ml vial?`,
      a: `${drawsAt1ml} by arithmetic. Plan on ${drawsAt1ml - 1}, because a standard syringe and needle leave a few hundredths of a millilitre behind on every draw.`,
    },
    {
      q: "How much bacteriostatic water do I need for a run of work?",
      a: `Work it out twice. Divide the total millilitres by about ${usableMl} ml usable per vial, and divide the days of work by ${FACTS.openedLimitDays}. Round both up and order the larger figure, plus a spare if the run matters.`,
    },
    {
      q: "Does a smaller draw volume mean more draws?",
      a: `Up to the point where the in-use limit takes over. Draws of 0.25 ml give ${drawsAtQuarterMl} by arithmetic, but at one a day the vial reaches ${FACTS.openedLimitDays} days first, and dead volume takes a larger share of each small draw.`,
    },
    {
      q: "Can you puncture the stopper as many times as you like?",
      a: "Each puncture is a contamination opportunity and wears the stopper, so fewer is better. Use a fresh sterile needle every time, swab the stopper, enter at a fresh point, and discard the vial if rubber fragments appear.",
    },
    {
      q: "Does refrigerating the vial give you more draws?",
      a: `No. Refrigeration at 2 to 8 °C is sensible for an opened vial, but the in-use limit is still ${FACTS.openedLimit} and the volume is still ${FACTS.vialMl} ml. Cold storage supports the limit; it does not extend it.`,
    },
  ],
  related: ["bacteriostatic-water-vial-sizes", "how-long-does-bacteriostatic-water-last"],
};
