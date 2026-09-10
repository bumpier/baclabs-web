/**
 * Exports published guides and posts as WordPress WXR (WordPress eXtended
 * RSS), for import through Tools > Import in the WordPress admin.
 *
 * Run with `npm run export:wxr [file]`. Defaults to baclab-wxr.xml.
 *
 * WXR rather than a bespoke importer because the operator has WordPress
 * admin access only - no shell, so no WP-CLI. WordPress's own official
 * importer plugin reads this format in the browser, and WXR carries custom
 * post types, slugs, dates and custom fields, which is everything a guide
 * needs. Nothing has to be installed on the server.
 *
 * The slug in <wp:post_name> is authoritative and must survive the import
 * unchanged: the storefront 301s /guides/<slug> to the same path on the new
 * domain, so a slug WordPress uniquifies turns a redirect into a soft 404.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";

/** Meta keys the theme reads. Must match inc/guide-post-type.php exactly. */
const META = {
  metaTitle: "_baclab_meta_title",
  description: "_baclab_description",
  quickAnswer: "_baclab_quick_answer",
  sections: "_baclab_sections",
  faq: "_baclab_faq",
  related: "_baclab_related",
  updated: "_baclab_updated",
  sortOrder: "_baclab_sort_order",
} as const;

/**
 * CDATA cannot contain the sequence "]]>". Guide copy is prose so it never
 * will, but the JSON columns are machine-generated and a future table cell
 * could. Splitting the sequence across two CDATA blocks is the standard
 * escape and keeps the value byte-identical once parsed.
 */
function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function meta(key: string, value: string): string {
  return `\t\t\t<wp:postmeta>\n\t\t\t\t<wp:meta_key>${cdata(key)}</wp:meta_key>\n\t\t\t\t<wp:meta_value>${cdata(value)}</wp:meta_value>\n\t\t\t</wp:postmeta>`;
}

/** WordPress wants "YYYY-MM-DD HH:MM:SS", not an ISO string with a T and Z. */
function wpDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function rfc822(d: Date): string {
  return d.toUTCString();
}

async function main() {
  const site = (process.env.BLOG_ORIGIN || "https://blog.baclab.co.uk").replace(/\/+$/, "");
  const author = process.env.WXR_AUTHOR || "admin";

  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const items: string[] = [];
  let postId = 1000;
  let guideCount = 0;
  let postCount = 0;

  for (const row of rows) {
    postId += 1;
    const published = row.publishedAt ?? new Date();
    const isGuide = row.type === "GUIDE";
    const path = isGuide ? `/guides/${row.slug}` : `/blog/${row.slug}`;

    // Guides carry no post body: every word lives in the structured meta the
    // theme renders. Posts keep their markdown, which the theme renders
    // through the same allowances as the storefront.
    const body = isGuide ? "" : row.markdown;

    const metas = isGuide
      ? [
          meta(META.metaTitle, row.metaTitle),
          meta(META.description, row.description),
          meta(META.quickAnswer, row.quickAnswer),
          meta(META.sections, row.sections),
          meta(META.faq, row.faq),
          meta(META.related, row.related),
          meta(META.updated, row.updated),
          meta(META.sortOrder, String(row.sortOrder)),
        ]
      : [meta(META.metaTitle, row.metaTitle), meta(META.description, row.description), meta(META.updated, row.updated)];

    if (isGuide) guideCount += 1;
    else postCount += 1;

    items.push(
      [
        "\t\t<item>",
        `\t\t\t<title>${cdata(row.title)}</title>`,
        `\t\t\t<link>${site}${path}</link>`,
        `\t\t\t<pubDate>${rfc822(published)}</pubDate>`,
        `\t\t\t<dc:creator>${cdata(author)}</dc:creator>`,
        `\t\t\t<guid isPermaLink="false">${site}${path}</guid>`,
        "\t\t\t<description></description>",
        `\t\t\t<content:encoded>${cdata(body)}</content:encoded>`,
        `\t\t\t<excerpt:encoded>${cdata(isGuide ? "" : row.excerpt)}</excerpt:encoded>`,
        `\t\t\t<wp:post_id>${postId}</wp:post_id>`,
        `\t\t\t<wp:post_date>${cdata(wpDate(published))}</wp:post_date>`,
        `\t\t\t<wp:post_date_gmt>${cdata(wpDate(published))}</wp:post_date_gmt>`,
        "\t\t\t<wp:comment_status><![CDATA[closed]]></wp:comment_status>",
        "\t\t\t<wp:ping_status><![CDATA[closed]]></wp:ping_status>",
        `\t\t\t<wp:post_name>${cdata(row.slug)}</wp:post_name>`,
        "\t\t\t<wp:status><![CDATA[publish]]></wp:status>",
        "\t\t\t<wp:post_parent>0</wp:post_parent>",
        `\t\t\t<wp:menu_order>${isGuide ? row.sortOrder : 0}</wp:menu_order>`,
        `\t\t\t<wp:post_type>${cdata(isGuide ? "guide" : "post")}</wp:post_type>`,
        "\t\t\t<wp:post_password><![CDATA[]]></wp:post_password>",
        "\t\t\t<wp:is_sticky>0</wp:is_sticky>",
        ...metas,
        "\t\t</item>",
      ].join("\n")
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
\txmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
\txmlns:content="http://purl.org/rss/1.0/modules/content/"
\txmlns:wfw="http://wellformedweb.org/CommentAPI/"
\txmlns:dc="http://purl.org/dc/elements/1.1/"
\txmlns:wp="http://wordpress.org/export/1.2/"
>
\t<channel>
\t\t<title>BacLab</title>
\t\t<link>${site}</link>
\t\t<description>Guides and blog</description>
\t\t<pubDate>${rfc822(new Date())}</pubDate>
\t\t<language>en-GB</language>
\t\t<wp:wxr_version>1.2</wp:wxr_version>
\t\t<wp:base_site_url>${site}</wp:base_site_url>
\t\t<wp:base_blog_url>${site}</wp:base_blog_url>
\t\t<wp:author>
\t\t\t<wp:author_id>1</wp:author_id>
\t\t\t<wp:author_login>${cdata(author)}</wp:author_login>
\t\t\t<wp:author_email>${cdata(`${author}@example.invalid`)}</wp:author_email>
\t\t\t<wp:author_display_name>${cdata(author)}</wp:author_display_name>
\t\t\t<wp:author_first_name><![CDATA[]]></wp:author_first_name>
\t\t\t<wp:author_last_name><![CDATA[]]></wp:author_last_name>
\t\t</wp:author>
${items.join("\n")}
\t</channel>
</rss>
`;

  const target = process.argv[2] || "baclab-wxr.xml";
  writeFileSync(target, xml);
  console.error(`✓ wrote ${guideCount} guides and ${postCount} posts to ${target}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
