import { brand } from "@/config/brand";

/**
 * The official Trustpilot logo (brand-assets 4.1.0, served from /public/brand)
 * linking to our profile. Unaltered and at its own aspect ratio, as
 * Trustpilot's brand guidelines require. The link reads "BacLab on Trustpilot"
 * rather than "our reviews", which stays true however many reviews exist.
 */
export function TrustpilotLogoLink({
  onDark = false,
  className,
}: {
  /** White logo for dark backgrounds such as the footer. */
  onDark?: boolean;
  className?: string;
}) {
  const { profileUrl } = brand.trustpilot;
  if (!profileUrl) return null;

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${brand.name} on Trustpilot (opens in a new tab)`}
      className={`inline-block transition-opacity duration-150 hover:opacity-80${className ? ` ${className}` : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/brand/trustpilot-logo-${onDark ? "white" : "black"}.svg`}
        alt=""
        width={98}
        height={24}
        className="h-6 w-auto"
      />
    </a>
  );
}
