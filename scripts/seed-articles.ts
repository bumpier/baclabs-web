/**
 * Imports the TypeScript guide modules into the Article table.
 *
 * Idempotent by slug, so it is safe to re-run: it is the disaster-recovery
 * path as much as the migration path. content/guides/*.ts stays in git as the
 * baseline this reads, but stops rendering anything once the routes read the
 * database.
 *
 * Run with `npm run db:seed:articles`, always BEFORE the new image starts
 * serving - between the migration and this script the table is empty and 13
 * ranking URLs would 404.
 */
import { GUIDES } from "@/content/guides";
import { prisma } from "@/lib/db";

async function main() {
  let created = 0;
  let updated = 0;

  for (const [i, g] of GUIDES.entries()) {
    const data = {
      type: "GUIDE",
      status: "PUBLISHED",
      title: g.title,
      metaTitle: g.metaTitle,
      description: g.description,
      // Preserved, never stamped with today: re-stamping 13 pages as freshly
      // modified is exactly the fake lastmod signal app/sitemap.ts refuses to
      // emit.
      updated: g.updated,
      // Not new Date(): we do not know each guide's true first-publication
      // date, and stamping "now" made datePublished later than dateModified
      // in the emitted Article schema - an article published after it was
      // last edited. `updated` is the best available approximation and
      // guarantees datePublished <= dateModified. Set on both the create and
      // update path so re-running this script self-corrects any row already
      // seeded with the old, wrong "now" value.
      publishedAt: new Date(g.updated),
      quickAnswer: g.quickAnswer,
      sections: JSON.stringify(g.sections),
      faq: JSON.stringify(g.faq),
      related: JSON.stringify(g.related),
      // The index page order is a deliberate teaching sequence. Keep it.
      sortOrder: i,
    };

    const existing = await prisma.article.findUnique({ where: { slug: g.slug } });
    if (existing) {
      await prisma.article.update({ where: { slug: g.slug }, data });
      updated++;
    } else {
      await prisma.article.create({
        data: { ...data, slug: g.slug },
      });
      created++;
    }
  }

  const total = await prisma.article.count({ where: { type: "GUIDE", status: "PUBLISHED" } });
  console.log(`✓ seeded guides: ${created} created, ${updated} updated, ${total} published`);

  if (total < GUIDES.length) {
    console.error(`Expected at least ${GUIDES.length} published guides, found ${total}`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
