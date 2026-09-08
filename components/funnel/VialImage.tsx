import Image from "next/image";
import { PRODUCT_IMAGES, PRODUCT, VIAL_ML } from "@/config/funnel";

/**
 * Product photography, or a drawn vial at the correct aspect ratio when
 * there is none.
 *
 * The placeholder is a drawn vial, not a grey box: it holds the exact shape
 * and proportion the real photograph will occupy, so dropping the photo in
 * later changes nothing about the layout.
 *
 * It is drawn to the product's own facts rather than as generic decoration —
 * a crimped cap, a graduated body, a meniscus at the fill line, and a label
 * panel carrying the volume. `cyan` is the liquid, `primary` the cap and seal.
 * The amber accent deliberately does not appear: it means "act here", and a
 * picture is not a call to action.
 */
export function VialImage({ priority = false }: { priority?: boolean }) {
  const hero = PRODUCT_IMAGES[0];

  if (hero) {
    return (
      // Rendered at the photograph's own aspect ratio. The shot is a portrait
      // of a single upright vial, so cropping it to a square would cut the cap
      // off the top and the base off the bottom — the two parts that say
      // "sealed vial" rather than "tube of liquid".
      //
      // next/image rather than a bare <img>: the source is 1122px wide but
      // the slot is 564 CSS px at most, so a phone was downloading four times
      // the pixels it could show. `sizes` mirrors the hero grid (five of
      // twelve columns from `lg`, a 24rem card below that, full width on a
      // phone) so the srcset picks a fitting variant. `priority` emits the
      // preload and fetchpriority=high the old markup carried by hand.
      <Image
        src={hero.src}
        alt={hero.alt}
        width={hero.width}
        height={hero.height}
        sizes="(min-width: 1024px) 36vw, (min-width: 640px) 24rem, 100vw"
        priority={priority}
        style={{ aspectRatio: `${hero.width} / ${hero.height}` }}
        className="h-auto w-full rounded-panel object-cover"
      />
    );
  }

  // Graduation ticks up the body. Long tick every 5ml, short every 1ml.
  // The body runs from y=346 (0ml) to y=196 (VIAL_ML), so 150px spans the fill.
  const TICKS = Array.from({ length: VIAL_ML + 1 }, (_, ml) => ({
    ml,
    major: ml % 5 === 0,
    y: 346 - (ml / VIAL_ML) * 150,
  }));

  return (
    <div
      className="aspect-square w-full"
      role="img"
      aria-label={`Illustration of a sealed ${PRODUCT.size}. Product photography is not yet available.`}
    >
      <svg viewBox="-40 0 400 400" className="h-full w-full" aria-hidden="true">
        {/* ── Cap: crimped aluminium collar over a rubber septum ── */}
        <rect x="126" y="44" width="68" height="10" rx="3" fill="var(--color-primary-deep)" />
        <rect x="118" y="54" width="84" height="40" rx="5" fill="var(--color-primary)" />
        {/* Crimp flutes — the ridges around a real vial collar. */}
        {[128, 140, 152, 164, 176, 188].map((x) => (
          <rect
            key={x}
            x={x}
            y="60"
            width="3"
            height="28"
            rx="1.5"
            fill="var(--color-primary-deep)"
            opacity="0.4"
          />
        ))}
        <rect x="124" y="94" width="72" height="10" rx="2" fill="var(--color-primary-deep)" opacity="0.75" />

        {/* ── Glass body: short neck, flared shoulder, rounded base ── */}
        <path
          id="vial-outline"
          d="M130 104v24l-30 32v184a16 16 0 0 0 16 16h88a16 16 0 0 0 16-16V160l-30-32v-24"
          fill="var(--color-surface)"
          stroke="var(--color-line-strong)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* ── The liquid, with a meniscus at the fill line ── */}
        {/* Clipped to the body so it can never paint outside the glass. */}
        <clipPath id="vial-body">
          <path d="M130 104v24l-30 32v184a16 16 0 0 0 16 16h88a16 16 0 0 0 16-16V160l-30-32v-24z" />
        </clipPath>
        <g clipPath="url(#vial-body)">
          <rect x="96" y="196" width="128" height="176" fill="var(--color-cyan)" opacity="0.5" />
          {/* Meniscus: water curves up where it meets the glass. */}
          <path d="M96 198q64 -14 128 0v8q-64 -14 -128 0z" fill="var(--color-cyan)" opacity="0.85" />
          {/* Specular highlight down the left of the glass. */}
          <rect x="112" y="168" width="9" height="190" rx="4.5" fill="var(--color-surface)" opacity="0.7" />
        </g>

        {/* ── Graduation scale ── */}
        <g stroke="var(--color-ink)" strokeWidth="1.5" strokeLinecap="round" opacity="0.35">
          {TICKS.map((t) => (
            <line key={t.ml} x1="104" y1={t.y} x2={t.major ? 124 : 114} y2={t.y} />
          ))}
        </g>

        {/* ── Label panel ── */}
        <rect
          x="106"
          y="248"
          width="108"
          height="72"
          rx="5"
          fill="var(--color-surface)"
          stroke="var(--color-line)"
          strokeWidth="1.5"
        />
        <text
          x="118"
          y="284"
          fill="var(--color-ink)"
          fontSize="28"
          fontWeight="700"
          fontFamily="var(--font-display-face), sans-serif"
        >
          {VIAL_ML}ml
        </text>
        <g fill="var(--color-ink)" opacity="0.28">
          <rect x="118" y="296" width="84" height="4" rx="2" />
          <rect x="118" y="306" width="58" height="4" rx="2" />
        </g>

        {/* The fill line, called out. Dashed so it reads as a measurement
            mark rather than an edge of the object. */}
        <line
          x1="76"
          y1="198"
          x2="244"
          y2="198"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          strokeDasharray="6 7"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}
