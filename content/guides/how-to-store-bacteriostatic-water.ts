import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const howToStore: Guide = {
  slug: "how-to-store-bacteriostatic-water",
  title: "How to store bacteriostatic water",
  metaTitle: "How to Store Bacteriostatic Water: Temperature and Limits",
  description:
    "Where to keep bacteriostatic water before and after opening, whether it needs refrigerating, why not to freeze it, and the signs to discard a vial.",
  quickAnswer: `Store unopened bacteriostatic water upright at room temperature, away from direct light, and follow the label. Once the stopper has been punctured, many laboratories refrigerate the vial at 2–8 °C, but the in-use limit of ${FACTS.openedLimit} applies either way. Do not freeze it. Discard any vial that is cloudy, discoloured or past its limit.`,
  updated: "2026-09-08",
  sections: [
    {
      heading: "How should unopened bacteriostatic water be stored?",
      paragraphs: [
        `An unopened vial is a closed system. The rubber stopper and crimped collar keep the contents sterile, and the preservative has nothing to do until the seal is broken. Storage before opening is therefore about protecting the glass, the seal and the label, not about slowing anything down.`,
        "Keep sealed vials at controlled room temperature, in the original carton or a closed drawer, away from direct sunlight and away from anything that runs hot such as a radiator, a windowsill or the top of a piece of equipment. Light and heat are the two things that shorten the printed shelf life. Neither is dramatic day to day, but a vial that sits in a sunny window for a year is not the vial the manufacturer tested.",
        "Store vials upright so the liquid sits away from the stopper. That keeps the underside of the stopper dry, which matters later when it is punctured. If the label on your vial states a specific temperature range, the label governs; some manufacturers print a refrigerated range and some print a room-temperature range, and you should follow whichever appears on the vial in front of you.",
      ],
      list: [
        "Controlled room temperature unless the label states otherwise",
        "Out of direct light, ideally in the carton it arrived in",
        "Upright, with the stopper at the top",
        "Away from freezers, radiators and heat-generating equipment",
        "Unopened until it is needed, with the printed expiry as the limit",
      ],
    },
    {
      heading: "Does bacteriostatic water need to be refrigerated once opened?",
      paragraphs: [
        `Once the stopper has been punctured the vial is in use, and the preservative is doing the job it is there for: inhibiting the growth of bacteria that may have been introduced through the stopper. The preservative does not sterilise, so the question of where to keep the vial is really a question of how much help to give it.`,
        "Many laboratories refrigerate opened vials at 2–8 °C. Cooling slows the metabolism of any organism that got through the stopper, so it is a sensible second line of defence behind the preservative. It is not a requirement in the same way that the in-use limit is a requirement. A vial kept at room temperature, away from light, with the stopper swabbed before each draw, is still within specification for the full in-use period.",
        `What refrigeration does not do is extend that period. The in-use limit of ${FACTS.openedLimit} is a conventional limit written on the label, and it applies regardless of temperature. A refrigerated vial opened on the first of the month is discarded on the same day as a room-temperature vial opened on the first of the month.`,
        "Whichever you choose, choose it once. Moving a vial between a fridge and a bench several times a day produces condensation on the outside of the glass and on the stopper, and repeated warming and cooling gives the preservative nothing extra while giving the seal more work to do.",
      ],
    },
    {
      heading: "Can bacteriostatic water be frozen?",
      paragraphs: [
        "Freezing is not recommended, and there are three separate reasons.",
        "The first is the glass. Water expands by about nine per cent when it freezes. A vial is filled with a small headspace, and the ice may or may not have room to expand into it. Even where the glass survives, the stress can produce a hairline crack that is invisible until the vial is handled.",
        "The second is the seal. The rubber stopper is held in compression by the aluminium collar, and that compression is what keeps the contents closed. Rubber stiffens and shrinks in the cold, the ice pushes against it from below, and on thawing the stopper may no longer sit as it did. A vial whose seal has been disturbed is no longer a sealed vial, whatever it looks like.",
        `The third is that there is nothing to gain. The diluent is sterile water with a bacteriostatic preservative. Freezing does not preserve it further, does not reset the in-use limit and does not extend the printed expiry. A frozen and thawed vial can also show a faint haze that was not there before. If a vial has been frozen, whether in transit or in a laboratory freezer, treat it as compromised and discard it.`,
      ],
    },
    {
      heading: "What temperature and limit apply at each stage?",
      paragraphs: [
        "The table below sets out the conventional storage conditions for each state a vial can be in. It is a summary of general laboratory practice; the label on the vial is the final authority and overrides anything here.",
      ],
      table: {
        caption: "Storage conditions for bacteriostatic water by state of the vial",
        columns: ["State", "Temperature", "Limit"],
        rows: [
          [
            "Unopened, sealed",
            "Controlled room temperature, away from direct light, or the range stated on the label",
            "Printed expiry date on the vial",
          ],
          [
            "Opened, stopper punctured",
            "Many laboratories refrigerate at 2–8 °C; room temperature away from light is also acceptable",
            `${FACTS.openedLimit}, whichever temperature is used`,
          ],
          [
            "Frozen at any point",
            "Below 0 °C",
            "Not recommended; discard the vial",
          ],
          [
            "Cloudy, discoloured or containing particles",
            "Any",
            "Discard immediately, regardless of date",
          ],
        ],
      },
    },
    {
      heading: "How do you handle a vial so it lasts the full in-use period?",
      paragraphs: [
        "Most of the risk to an opened vial comes from handling rather than from storage. The preservative can inhibit a small number of organisms introduced through a clean puncture; it cannot deal with a stopper that is contaminated every time it is used. A few habits protect the vial for the whole of its in-use period.",
      ],
      list: [
        "Swab the stopper with an alcohol wipe and let it dry before every puncture, including the first one after the flip cap is removed. The cap keeps the stopper clean in transit; it does not keep it sterile.",
        "If the vial has been refrigerated, let it stand until it reaches room temperature before puncturing. A cold stopper in warm air collects condensation, and water on the outside of the stopper is carried through on the point of the needle.",
        "Use a fresh sterile needle for each draw and never leave a needle sitting in the stopper. An open channel into the vial defeats the seal entirely, and the preservative is not designed to cope with a continuous route in.",
        "Puncture the stopper at its centre, where the rubber is thickest and designed to reseal, rather than at the edge near the collar.",
        "Write the date of first puncture on the vial or its carton as soon as the stopper is broken. The in-use limit is counted from that day, and a vial with no date on it cannot be shown to be within it.",
        "Keep the vial upright between uses so the liquid does not sit against the stopper, and return it to its carton or the fridge promptly after each draw.",
      ],
    },
    {
      heading: "How can you tell if bacteriostatic water has gone bad?",
      paragraphs: [
        `Good bacteriostatic water is ${FACTS.appearance.toLowerCase()}. Anything else is a reason to discard the vial, and there is no test you can perform on the bench that will let you keep it. Hold the vial up against a plain background in good light and look for the following.`,
      ],
      list: [
        "**Cloudiness or haze.** A clear diluent that has turned cloudy has either grown something or precipitated something. Either way it is finished.",
        "**Visible particles.** Specks, threads or floating material of any kind, whether or not they settle. A tiny fleck of rubber cored from the stopper is a particle too.",
        "**Colour change.** The liquid should be colourless. A yellow or brown tint indicates degradation or contamination.",
        "**A cracked vial or a loose seal.** Check the glass for chips and hairline cracks, and check that the aluminium collar is tight and the stopper cannot be turned. A vial with a loose collar is not sealed.",
        `**Past the in-use limit.** Once ${FACTS.openedLimit} has passed, the vial is discarded even if it looks perfect. The limit exists because contamination is not always visible.`,
        "**Past the printed expiry.** An unopened vial beyond its expiry date is discarded on the same principle.",
        "**Any history of freezing or overheating.** If you know the vial was frozen or left in a hot vehicle, do not rely on appearance to clear it.",
      ],
    },
    {
      heading: "How are BacLab's vials supplied?",
      paragraphs: [
        `BacLab supplies one product: a ${FACTS.vialMl} ml glass vial of bacteriostatic water, sold as a laboratory and research diluent. Each vial is sealed with a rubber stopper under a crimped aluminium collar and a flip-off cap, so the stopper is protected until the moment you remove the cap and any interference with the seal is visible before you open it.`,
        "Vials are packed upright in protective packaging and dispatched by tracked courier, so they travel at ambient temperature for a short period, which is well within the conditions an unopened vial tolerates. On arrival, check the cap is intact, the collar is tight and the liquid is clear, then store the vials as described above until they are needed. Packs run from a single vial to one hundred, so you can hold a working stock without keeping more open vials than you will use within the in-use limit.",
      ],
    },
  ],
  faq: [
    {
      q: "Does bacteriostatic water need to be refrigerated?",
      a: "Unopened, no: room temperature away from light is the norm unless the label says otherwise. Once the stopper has been punctured, many laboratories refrigerate at 2–8 °C as a precaution, but it is not a requirement and it does not change the in-use limit.",
    },
    {
      q: "Can bacteriostatic water be frozen?",
      a: "It is not recommended. Freezing can crack the glass, disturb the stopper seal and cause a faint haze on thawing, and it does not extend the shelf life or the in-use period. A vial that has been frozen should be discarded.",
    },
    {
      q: `Does refrigerating an opened vial extend the ${FACTS.openedLimitDays}-day limit?`,
      a: `No. The in-use limit of ${FACTS.openedLimit} applies at any storage temperature. Refrigeration adds a margin of safety within that period; it does not lengthen it.`,
    },
    {
      q: "Why has my bacteriostatic water gone cloudy?",
      a: "Cloudiness means something has grown in the vial or something has come out of solution, most often after contamination through the stopper or after freezing. There is no way to recover a cloudy vial. Discard it and open a fresh one.",
    },
    {
      q: "Can an opened vial be stored on its side?",
      a: "Upright is better. Storing a vial upright keeps the liquid away from the underside of the stopper, which reduces the chance of leakage through the puncture and keeps the stopper surface dry for the next draw.",
    },
    {
      q: "What if the vials were warm when they arrived?",
      a: "A short spell at ambient temperature in transit is within what a sealed vial tolerates, and it is not a reason to discard. Check the seal and the clarity of the liquid on arrival, then store the vials at room temperature out of direct light as normal.",
    },
  ],
  related: [
    "how-long-does-bacteriostatic-water-last",
    "bacteriostatic-water-vs-sterile-water",
  ],
};
