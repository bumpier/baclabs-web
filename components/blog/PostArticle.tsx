import ReactMarkdown from "react-markdown";
import type { Post } from "@/content/posts/types";
import { JsonLd } from "@/components/JsonLd";
import { BuyCard } from "@/components/guides/GuideArticle";
import { pageBreadcrumbSchema } from "@/lib/guide-seo";

/**
 * Renders one post. Deliberately plainer than GuideArticle: a post has no
 * quick answer, no FAQ and no related links, so it emits no Article schema
 * beyond the breadcrumb.
 *
 * Markdown comes from an authenticated admin, but it is still database
 * content rendered into a page, so raw HTML stays off: react-markdown ignores
 * HTML unless rehype-raw is added, and it must not be. `allowedElements` is a
 * second, explicit boundary on top of that.
 */
const ALLOWED = [
  "h2", "h3", "h4", "p", "ul", "ol", "li",
  "strong", "em", "blockquote", "code", "pre",
  "table", "thead", "tbody", "tr", "th", "td", "hr", "br",
];

export function PostArticle({ post }: { post: Post }) {
  const updated = new Date(post.updated).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema(post.title, `/blog/${post.slug}`)} />
      <h1 className="text-3xl sm:text-4xl">{post.title}</h1>
      <p className="mt-3 text-sm text-ink-soft">Updated {updated}</p>
      <div className="post-body measure mt-8 text-base text-ink-soft">
        <ReactMarkdown allowedElements={ALLOWED} unwrapDisallowed>
          {post.markdown}
        </ReactMarkdown>
      </div>
      <BuyCard />
    </article>
  );
}
