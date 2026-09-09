import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const vialHandlingAndContamination: Guide = {
  slug: "vial-handling-and-contamination",
  title: "Handling a bacteriostatic water vial without contaminating it",
  metaTitle: "Bacteriostatic water vial handling and contamination",
  description: `Keeping a multi-dose vial clean between entries: disinfecting the stopper, a fresh needle each time, and the signs a vial should be discarded.`,
  quickAnswer: `Disinfect the stopper before every entry, use a fresh needle each time, never return liquid to the vial, and store it as the label directs between uses. The preservative inhibits growth from a small challenge introduced under clean conditions. It does not clean up after poor handling.`,
  updated: "2026-09-09",
  sections: [
    {
      heading: "How does a vial become contaminated?",
      paragraphs: [
        `Almost always through the stopper. The contents arrive sterile and sealed, so anything that gets in comes through the one route that is opened deliberately, carried on a needle passing through the outer face of the elastomer.`,
        `That face is not sterile. It has been under a flip cap, which keeps dust off but is not a sterile barrier, and once the cap is removed the surface is exposed to the air and to whatever the vial rests on. Organisms sitting on it are pushed into the liquid by the next needle through.`,
        `The second route is the liquid itself. Anything drawn out and then pushed back in returns with whatever it has touched, which is why a syringe that has been anywhere else never goes back into the vial.`,
      ],
    },
    {
      heading: "Should the stopper be disinfected every time?",
      paragraphs: [
        `Yes, before every entry rather than only the first. The reasoning is simple: the surface is re-exposed between entries, so the disinfection done last week says nothing about the state of the stopper today.`,
        `Use a fresh alcohol wipe, cover the whole face rather than the centre, and let it dry. The drying is not a formality. The disinfectant needs contact time to work, and a needle pushed through a wet stopper carries the liquid, and anything suspended in it, straight through.`,
        `**Let it dry, then enter.** A few seconds of patience is the entire technique, and skipping it is the most common way a vial is compromised by someone who did disinfect the stopper.`,
      ],
    },
    {
      heading: "How many needles does one vial need?",
      paragraphs: [
        `One per entry. A needle that has been through the stopper once has been in the liquid and out through the elastomer, and its point is no longer in the condition it was supplied in.`,
        `Reusing a needle across entries carries whatever it picked up back into the vial, and it dulls the point, which matters more than it sounds. A blunt needle cores the stopper rather than parting it, pushing small fragments of elastomer into the liquid and leaving a hole that no longer reseals.`,
        `Coring is visible if you look for it. Fragments settle as small dark specks in the vial, and a vial showing them has both a particle problem and a stopper that has stopped doing its job.`,
      ],
    },
    {
      heading: "What should never go back into the vial?",
      paragraphs: [
        `Liquid that has left it. Once the contents of a syringe have been outside the vial they have been in contact with the syringe barrel, the air, and whatever the transfer touched. Returning them puts all of that into a vial that other entries will draw from later.`,
        `A needle that has been used elsewhere is the same problem with a shorter path. Enter the vial from a clean needle and nothing else, every time.`,
        `Where a draw turns out to be more than needed, the surplus is discarded rather than returned. The volume lost is smaller than the cost of compromising the rest of the vial.`,
      ],
    },
    {
      heading: "How should the vial be stored between entries?",
      paragraphs: [
        "As the storage line on the label directs. Storage conditions are part of what the stated shelf life assumes, and a vial kept outside them is outside the terms of its own label whether or not it looks any different.",
        `Replace the flip cap if it is the sort that refits, or cover the stopper, and keep the vial upright. The cap is a dust cover rather than a seal, but keeping debris off the face of the stopper means less to disinfect through at the next entry.`,
        `Write the date of first entry on the label at the time you make it. The in-use limit of ${FACTS.openedLimit} is only enforceable if the start date is visible, and a vial with no date is one nobody can vouch for.`,
      ],
    },
    {
      heading: "What are the signs a vial should be discarded?",
      paragraphs: [
        `Anything that departs from the appearance criterion, which for this product is ${FACTS.appearance.toLowerCase()}. Cloudiness, a change of colour or visible particles mean the contents are no longer what the specification describes, and no date on the label overrides that.`,
        `Discard also on the physical state of the vial. A stopper that no longer reseals, visible coring fragments, a lifted or damaged crimp, or a cracked vial all put it outside the conditions its documentation covers.`,
        `And discard on the dates: past the printed expiry, or past ${FACTS.openedLimitDays} days from first entry, whichever comes first.`,
      ],
      list: [
        "Cloudy, discoloured or containing visible particles",
        "Past the expiry printed on the label",
        `Past ${FACTS.openedLimit}`,
        "Stopper cored, damaged or no longer resealing",
        "Crimp lifted, seal broken or the vial cracked",
        "Label missing or illegible, so the batch and dates cannot be read",
      ],
    },
    {
      heading: "Does the preservative make careful handling unnecessary?",
      paragraphs: [
        `No, and treating it as though it does is the assumption the in-use limit exists to guard against. A bacteriostatic preservative inhibits the growth of bacteria introduced in small numbers under otherwise clean conditions. That is a narrow claim.`,
        `It does not act instantly, it does not kill what is already there, and it has no effect on particles, on fragments of stopper, or on anything introduced in quantity. A vial that has taken a real contamination is compromised, and the liquid will often look entirely normal.`,
        `The preservative buys a working period across several entries. Clean technique is what makes that period worth having.`,
      ],
    },
  ],
  faq: [
    {
      q: "Does the stopper need disinfecting before every entry?",
      a: "Yes. The surface is re-exposed between entries, so each one needs a fresh wipe. Let the alcohol dry before the needle goes through, or it is carried into the liquid.",
    },
    {
      q: "Can the same needle be used twice on one vial?",
      a: "No. A used needle carries what it picked up back in, and a dulled point cores the stopper, leaving fragments in the liquid and a hole that no longer reseals.",
    },
    {
      q: "What is coring?",
      a: "Punching a fragment out of the stopper rather than parting it, usually from a blunt or reused needle. The fragments settle in the vial as small dark specks and the stopper stops sealing properly.",
    },
    {
      q: "Can unused liquid be returned to the vial?",
      a: "No. Anything that has left the vial has been in contact with the syringe and the air. Discard the surplus rather than putting it back where later entries will draw from it.",
    },
    {
      q: "Does the preservative clean up a contaminated vial?",
      a: "No. It inhibits growth from a small challenge introduced under clean conditions. It does not kill what is present and cannot make a contaminated vial usable, which is why appearance is checked at every entry.",
    },
  ],
  related: ["how-to-store-bacteriostatic-water", "how-many-draws-from-a-vial"],
};
