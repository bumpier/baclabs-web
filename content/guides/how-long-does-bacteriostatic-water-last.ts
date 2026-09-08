import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const howLongDoesItLast: Guide = {
  slug: "how-long-does-bacteriostatic-water-last",
  title: "How long does bacteriostatic water last?",
  metaTitle: "How Long Does Bacteriostatic Water Last? 28 Days Opened",
  description: `Opened bacteriostatic water lasts ${FACTS.openedLimit}; sealed, it lasts until the printed expiry. Why the two limits differ and when to discard a vial.`,
  quickAnswer: `An opened vial of bacteriostatic water lasts ${FACTS.openedLimit}. That is the in-use limit and it does not reset. An unopened vial lasts until the expiry date printed on its label, typically around two years from manufacture. Discard a vial early if it turns cloudy, changes colour or shows particles, whatever the date says.`,
  updated: "2026-09-08",
  sections: [
    {
      heading: "How long does bacteriostatic water last once opened?",
      paragraphs: [
        `Once the rubber stopper has been punctured, a vial of bacteriostatic water is good for **${FACTS.openedLimit}**. After ${FACTS.openedLimitDays} days the vial should be discarded, even if most of the ${FACTS.vialMl} ml is still inside and the liquid looks perfectly clear.`,
        `The ${FACTS.openedLimitDays}-day figure is not arbitrary. It is the standard in-use period for a multi-dose vial, meaning a vial that is designed to be punctured and drawn from more than once rather than emptied in a single go. Every puncture carries a small chance of introducing microorganisms from the air, the stopper surface or the syringe. The preservative is there to inhibit the growth of anything that gets in.`,
        `The key word is inhibit. Preservative efficacy is tested by deliberately challenging the solution with microorganisms and checking that their numbers are held down over a defined window. The label limit reflects that window. It is validated to hold growth off for ${FACTS.openedLimitDays} days of repeated access, not indefinitely, and the further past that window a vial goes, the less confidence there is in what the preservative is still doing.`,
      ],
    },
    {
      heading: "Does unopened bacteriostatic water expire?",
      paragraphs: [
        "Yes. A sealed vial carries an expiry date printed on the label or the crimp cap, and that date is the unopened shelf life. For bacteriostatic water it is typically around two years from the date of manufacture, though the exact figure depends on the manufacturer's stability testing and the label always governs.",
        "The expiry date assumes the vial has been stored as the label directs, which for most products means at controlled room temperature, protected from light, and not frozen. A vial that has been left in a hot vehicle or a freezer has not been stored under the conditions the expiry was tested against, and the printed date no longer says much about it.",
        "Until the stopper is punctured, the contents are sealed from the outside world. The expiry is about the slow change of the solution and its container over time, not about contamination. That is why the sealed limit is measured in years and the opened limit in days.",
      ],
    },
    {
      heading: "Why are the opened and unopened limits different?",
      paragraphs: [
        "The two limits answer two different questions. The printed expiry asks how long a sealed, sterile solution stays within specification while nothing can get in. The in-use limit asks how long the preservative can be trusted to keep growth in check once something can.",
        `Sealed, the vial was sterilised at manufacture and the closure keeps it that way. There is nothing for the preservative to fight. Opened, the stopper has been breached at least once, and each further draw is another opportunity for contamination. The preservative was validated against that scenario for ${FACTS.openedLimitDays} days, so ${FACTS.openedLimitDays} days is the limit.`,
        `The two clocks do not add together. If a vial is opened with eighteen months left on its printed expiry, it is still discarded ${FACTS.openedLimit}. The expiry date only tells you the latest point at which a vial may be opened. Opening it starts the shorter clock immediately.`,
      ],
    },
    {
      heading: "Which limit applies to my vial?",
      paragraphs: [
        "Work through the vial's condition in this order: check the appearance first, then whether it has been punctured, then the relevant date. Appearance overrides everything else.",
      ],
      table: {
        caption: "What applies to a vial of bacteriostatic water in each situation",
        columns: ["Situation", "What applies", "Action"],
        rows: [
          [
            "Unopened, before the printed expiry",
            "Printed expiry date",
            "Fine to open. Store as the label directs until then.",
          ],
          [
            "Unopened, past the printed expiry",
            "Printed expiry date has passed",
            "Discard. Sterility and preservative strength are no longer guaranteed by the manufacturer.",
          ],
          [
            `Opened, within ${FACTS.openedLimitDays} days of first puncture`,
            `In-use limit (${FACTS.openedLimit})`,
            "Fine to keep drawing from, provided the liquid is still clear and colourless.",
          ],
          [
            `Opened, more than ${FACTS.openedLimitDays} days since first puncture`,
            "In-use limit has passed",
            "Discard, regardless of how much remains or how the liquid looks.",
          ],
          [
            "Cloudy, discoloured or containing particles, at any time",
            "Appearance overrides both dates",
            "Discard immediately. Do not draw from it.",
          ],
        ],
      },
    },
    {
      heading: "Does the water expiring mean whatever is dissolved in it has also expired?",
      paragraphs: [
        "No, and it is worth keeping the two questions separate. The limits on this page describe the diluent only: how long the water and its preservative can be relied upon. They say nothing about the stability of a research compound that has been reconstituted in it.",
        `A solute has its own chemistry. Some compounds are stable in solution for weeks, others begin to degrade within hours or days, and temperature, light and pH can matter more to the solute than to the water. The diluent's ${FACTS.openedLimitDays}-day limit is a ceiling, not a guarantee: a reconstituted solution cannot be kept longer than the diluent allows, but it may need to be discarded much sooner because of the solute.`,
        "When working out how long a reconstituted solution can be kept, take the shorter of the two figures. The in-use limit of the bacteriostatic water is one, and the stability data for the compound in question is the other. Neither figure extends the other.",
      ],
    },
    {
      heading: "What is the simplest way to keep track of the 28 days?",
      paragraphs: [
        "Write the date of first puncture on the vial. A fine permanent marker on the label, or a small piece of tape on the flip-cap collar, is enough. Some laboratories also write the discard date next to it so nobody has to count forward.",
        `The reason this matters is that the in-use limit runs from the first puncture, not the most recent one, and a vial in a fridge or drawer gives no visual clue as to when that was. Without a date, the only honest options are to remember or to guess, and a guess in the wrong direction turns a ${FACTS.openedLimitDays}-day vial into a six-week one.`,
      ],
      list: [
        "Date the vial the moment the cap is flipped off, before the first draw.",
        `Write the discard date alongside it: first puncture plus ${FACTS.openedLimitDays} days.`,
        "Keep opened vials separate from sealed stock so an undated vial stands out.",
        "If an opened vial turns up with no date on it, treat it as expired.",
      ],
    },
    {
      heading: "What are the signs a vial should be discarded?",
      paragraphs: [
        `Bacteriostatic water should look like a ${FACTS.appearance.toLowerCase()}, and it should keep looking that way for the whole of its life. Any departure from that is a reason to discard, whatever the date says.`,
        "The in-use limit exists precisely because contamination is not always visible. A vial can be past the point of trusting the preservative and still look perfectly clear, which is why the date is checked as well as the appearance, not instead of it.",
      ],
      list: [
        "Cloudiness, haze or a visible film on the surface of the liquid.",
        "Any tint or colour change from clear and colourless.",
        "Particles, flecks or sediment, whether floating or settled.",
        "A crimp cap or stopper that is loose, damaged or shows signs of tampering.",
        "Signs of freezing, such as a cracked vial or a stopper that has been pushed upward.",
        `More than ${FACTS.openedLimitDays} days since first puncture, or an opened vial with no date on it.`,
        "A printed expiry date that has passed on a sealed vial.",
      ],
    },
  ],
  faq: [
    {
      q: "Can you use expired bacteriostatic water?",
      a: "It is not recommended. The printed expiry is the limit of the manufacturer's stability testing, and beyond it neither sterility nor preservative strength is guaranteed. A fresh vial is inexpensive compared with the cost of contaminating a piece of research work.",
    },
    {
      q: "Does bacteriostatic water go bad?",
      a: `Yes, in two ways. A sealed vial slowly drifts out of specification and reaches its printed expiry. An opened vial can become contaminated, and the preservative is only validated to hold growth off for ${FACTS.openedLimit}.`,
    },
    {
      q: "Is the 28-day rule exact, or is day 29 fine?",
      a: `Treat it as a hard limit. Nothing dramatic happens overnight on day ${FACTS.openedLimitDays + 1}, but the preservative was validated for ${FACTS.openedLimitDays} days of repeated access and there is no data supporting anything longer. Discarding on time is the point of the rule.`,
    },
    {
      q: "Does refrigerating an opened vial extend the 28 days?",
      a: `No. Refrigeration at 2 to 8 °C slows the growth of many organisms and is common practice for opened vials, but the in-use limit is still ${FACTS.openedLimit}. Cold storage supports the limit; it does not lengthen it.`,
    },
    {
      q: "If a vial was only punctured once, does the 28-day limit still apply?",
      a: "Yes. The clock starts at the first puncture, not on the number of punctures. A single draw is enough to breach the closure, and the limit runs from that moment.",
    },
    {
      q: "How long does bacteriostatic water last unopened?",
      a: "Until the expiry date printed on the label, which is typically around two years from manufacture. Check the vial rather than assuming, and store it as the label directs so that the printed date remains meaningful.",
    },
  ],
  related: ["how-to-store-bacteriostatic-water", "what-is-bacteriostatic-water"],
};
