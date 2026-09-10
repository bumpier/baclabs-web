/**
 * The blog and the guides are moving to a WordPress site on their own domain.
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
 * Paths this site hands over once migrated: the two hubs and everything
 * beneath them. Kept here so the redirect, the sitemap and llms.txt cannot
 * disagree about what has moved.
 */
export function isMigratedPath(pathname: string): boolean {
  return (
    pathname === "/guides" ||
    pathname.startsWith("/guides/") ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/")
  );
}
