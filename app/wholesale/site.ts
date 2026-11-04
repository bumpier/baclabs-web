import { wholesaleProfile } from "@/brands/wholesale/profile";

/**
 * This brand's site settings, shared by its layout and its metadata routes.
 * Everything under app/wholesale/ is this brand's alone: it is reached only
 * through the host rewrite in middleware.ts, and never imports BacLab's
 * components, config or stylesheet.
 */
export const brand = wholesaleProfile();

/**
 * TODO(launch): true once the brand is live. Until then robots.txt
 * disallows everything and every page is noindex.
 */
export const LIVE = false;

export const DESCRIPTION = "Coming soon.";

/** Every public page, for the sitemap. */
export const PAGES: readonly string[] = ["/"];
