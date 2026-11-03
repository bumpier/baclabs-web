import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publishedPostBySlug } from "@/lib/articles";
import { PostArticle } from "@/components/blog/PostArticle";

// Same reasoning as /guides/[slug]: no build-time database. See Dockerfile:65.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await publishedPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.metaTitle,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.metaTitle,
      description: post.description,
      url: `/blog/${post.slug}`,
      modifiedTime: post.updated,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await publishedPostBySlug(slug);
  if (!post) notFound();
  return <PostArticle post={post} />;
}
