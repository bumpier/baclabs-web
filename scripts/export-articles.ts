/**
 * Exports every published guide and post as JSON, for import into the
 * WordPress site that now hosts them.
 *
 * Run with `npm run export:articles`. Writes to stdout unless a path is
 * given as the first argument.
 *
 * The shape is deliberately the render contract plus the two fields the
 * mappers drop - `sortOrder` and the real `publishedAt` - because the
 * importer needs both: the guides index is in a curated teaching order that
 * is neither alphabetical nor chronological, and a first-publication date
 * that moved would throw away each page's age signal on the new domain.
 *
 * Slugs are exported verbatim and MUST be imported verbatim. The storefront
 * 301s /guides/<slug> and /blog/<slug> to the same path on the new domain,
 * so a slug that changes in transit turns a redirect into a soft 404.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";

async function main() {
  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const guides = rows
    .filter((r) => r.type === "GUIDE")
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      metaTitle: r.metaTitle,
      description: r.description,
      quickAnswer: r.quickAnswer,
      updated: r.updated,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      sortOrder: r.sortOrder,
      sections: JSON.parse(r.sections),
      faq: JSON.parse(r.faq),
      related: JSON.parse(r.related),
    }));

  const posts = rows
    .filter((r) => r.type === "POST")
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      metaTitle: r.metaTitle,
      description: r.description,
      excerpt: r.excerpt,
      markdown: r.markdown,
      updated: r.updated,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    }));

  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), guides, posts },
    null,
    2
  );

  const target = process.argv[2];
  if (target) {
    writeFileSync(target, payload);
    console.error(`✓ exported ${guides.length} guides and ${posts.length} posts to ${target}`);
  } else {
    console.log(payload);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
