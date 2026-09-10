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
import { checkCompliance, checkGuideStructure, guideProse } from "@/lib/content-rules";

const SLUGS = new Set(GUIDES.map((g) => g.slug));

async function main() {
  // Gate every write on the same rules the admin publish button enforces.
  // This script writes status: "PUBLISHED" directly - it is the one place
  // that skips the admin path entirely and the documented disaster-recovery
  // route, so nothing here may depend on someone remembering to run
  // `check:guides` first. Checked for every guide BEFORE the first write: a
  // partially-seeded table (some guides live, some missing) is worse than an
  // unseeded one, so any violation aborts the whole run.
  let failures = 0;
  for (const g of GUIDES) {
    const violations = [...checkCompliance(guideProse(g)), ...checkGuideStructure(g, SLUGS)];
    for (const v of violations) {
      console.error(`  ✗ ${g.slug}: ${JSON.stringify(v.match)} — ${v.why}`);
      failures++;
    }
  }
  if (failures) {
    console.error(`\n${failures} violation(s) across ${GUIDES.length} guides. Nothing was written.`);
    process.exit(1);
  }

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
