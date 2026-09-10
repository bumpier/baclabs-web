/**
 * The blog AND the guides move to a WordPress site on their own domain.
 *
 * The switch is a RUNTIME environment variable, not a build-time constant, so
 * the code can ship before WordPress is live and be turned on with a restart
 * rather than a rebuild. That ordering matters: enabling redirects before the
 * destination exists would send thirteen ranking URLs to nothing.
 *
 * Set BLOG_ORIGIN to the new origin (for example https://blog.baclab.co.uk)
 * once the WordPress site is serving those pages. Leave it unset and the
 * storefront keeps serving /guides and /blog itself, exactly as before.
 */

/** The migration target, or null while the content still lives here. */
export function blogOrigin(): string | null {
  const raw = process.env.BLOG_ORIGIN?.trim();
  if (!raw) return null;
  // Trailing slashes would double up when a path is appended.
  return raw.replace(/\/+$/, "");
}

/** True once the content has moved and this site should redirect instead. */
export function isBlogMigrated(): boolean {
  return blogOrigin() !== null;
}

/**
 * Paths this site hands over once migrated: both hubs and everything beneath
 * them. Kept here so the redirect, the sitemap, llms.txt and every internal
 * link cannot disagree about what has moved.
 */
export function isMigratedPath(pathname: string): boolean {
  return (
    pathname === "/guides" ||
    pathname.startsWith("/guides/") ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/")
  );
}

/**
 * The href to use for a path that has moved.
 *
 * Before the move it is the local path, exactly as today. After it, the
 * absolute URL on the new domain - NOT the local path relying on the 301.
 * A redirect works, but every internal link would then cost a round trip
 * and pass its ranking signal through a hop rather than directly. Links the
 * site controls should point at the final URL.
 *
 * Paths that are not moving (/faq, /calculator) come back untouched, so this
 * is safe to apply to a whole link list.
 */
export function contentHref(path: string): string {
  const origin = blogOrigin();
  if (origin && isMigratedPath(path)) return `${origin}${path}`;
  return path;
}
