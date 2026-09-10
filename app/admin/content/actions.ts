"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Article } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdminSession, requireAdminRole } from "@/lib/adminAuth";
import { articleViolations } from "@/lib/articles";
import type { FormState } from "@/lib/form-state";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const tableSchema = z.object({
  caption: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const sectionSchema = z.object({
  heading: z.string(),
  paragraphs: z.array(z.string()),
  list: z.array(z.string()).optional(),
  table: tableSchema.optional(),
});

const faqSchema = z.object({ q: z.string(), a: z.string() });

const saveSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(SLUG_RE, "Slug must be lowercase words separated by hyphens"),
  title: z.string().min(1, "Title is required"),
  metaTitle: z.string().min(1, "Meta title is required"),
  description: z.string(),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  quickAnswer: z.string(),
  sections: z.array(sectionSchema),
  faq: z.array(faqSchema),
  related: z.array(z.string()),
  markdown: z.string(),
  excerpt: z.string(),
  // z.coerce.number() turns "" and "   " into 0, so an editor who cleared this
  // field would silently move the guide to the front of the index instead of
  // seeing an error. Reject a blank value before coercion reaches it.
  sortOrder: z
    .string()
    .trim()
    .min(1, "Position in the guides index is required")
    .pipe(z.coerce.number().int("Position must be a whole number")),
});

// An absent or empty field is treated as malformed, not as "[]". Both
// editors always post a JSON string ("[]" for a genuinely empty list), so a
// missing value can only mean a client bug - never legitimate intent. Letting
// it through as [] would silently truncate the field it stands for.
function json(formData: FormData, field: string): unknown {
  const raw = formData.get(field);
  if (typeof raw !== "string" || raw === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Revalidate every surface that lists or renders this article. */
function revalidateFor(type: string, slug: string) {
  if (type === "GUIDE") {
    revalidatePath("/guides");
    revalidatePath(`/guides/${slug}`);
  } else {
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
  }
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/admin/content");
}

export async function createArticleAction(type: "GUIDE" | "POST"): Promise<void> {
  await requireAdminRole("ADMIN");
  const session = await getAdminSession();

  // A unique placeholder slug: the row must exist before the editor can load,
  // and two people can start a draft in the same second. Date.now() alone is
  // only probabilistically unique against the DB's @unique constraint, so a
  // random suffix backs it up.
  const slug = `untitled-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const today = new Date().toISOString().slice(0, 10);

  let row;
  try {
    row = await prisma.article.create({
      data: {
        type,
        status: "DRAFT",
        slug,
        title: "Untitled",
        metaTitle: type === "GUIDE" ? "Bacteriostatic water " : "",
        description: "",
        updated: today,
        authorId: session?.adminUserId ?? null,
      },
    });
  } catch (err) {
    console.error("[internal] creating article failed", err);
    throw new Error("Could not create the article. Please try again.");
  }

  redirect(`/admin/content/${row.id}`);
}

export async function saveArticleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const sections = json(formData, "sections");
  const faq = json(formData, "faq");
  const related = json(formData, "related");
  if (sections === null || faq === null || related === null)
    return { error: "The editor sent malformed data. Reload the page and try again." };

  const parsed = saveSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    metaTitle: formData.get("metaTitle"),
    description: formData.get("description") ?? "",
    updated: formData.get("updated"),
    quickAnswer: formData.get("quickAnswer") ?? "",
    sections,
    faq,
    related,
    markdown: formData.get("markdown") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    sortOrder: formData.get("sortOrder") ?? "0",
  });

  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission" };

  const input = parsed.data;
  const existing = await prisma.article.findUnique({ where: { id: input.id } });
  if (!existing) return { error: "That article no longer exists." };

  // A published article's slug is its URL. Changing it would 404 the old URL
  // and discard whatever ranking it held, and this site has no redirect table
  // to catch that. Enforced here, not merely disabled in the form.
  const slug = existing.publishedAt ? existing.slug : input.slug;
  if (existing.publishedAt && input.slug !== existing.slug)
    return { error: "The address of a published article cannot be changed." };

  if (slug !== existing.slug) {
    const clash = await prisma.article.findUnique({ where: { slug } });
    if (clash) return { error: "Another article already uses that address." };
  }

  const data = {
    slug,
    title: input.title,
    metaTitle: input.metaTitle,
    description: input.description,
    updated: input.updated,
    quickAnswer: input.quickAnswer,
    sections: JSON.stringify(input.sections),
    faq: JSON.stringify(input.faq),
    related: JSON.stringify(input.related),
    markdown: input.markdown,
    excerpt: input.excerpt,
    sortOrder: input.sortOrder,
  };

  // A published article is a live, indexed page. Draft saves must always
  // work so nobody loses work in progress, but an edit to a PUBLISHED row
  // that would break the site's own rules must never reach it - the rules
  // only ever covering an article's first publish was exactly the hole this
  // file exists to close. Build the row the edit would produce and re-run
  // every rule against that candidate before writing anything, exactly as
  // publishArticleAction does. No auto-unpublish, no partial rule tier: a
  // violation refuses the whole save.
  if (existing.status === "PUBLISHED") {
    const candidate: Article = { ...existing, ...data };
    const violations = await articleViolations(candidate);
    if (violations.length > 0) {
      return {
        error: `This article is live, and that change would break the rules: ${
          violations.length
        } issue${violations.length === 1 ? "" : "s"}. ${violations
          .map((v) => v.why)
          .join("; ")}. Unpublish it first if you need to make a change like this.`,
      };
    }
  }

  try {
    await prisma.article.update({
      where: { id: input.id },
      data,
    });
  } catch (err) {
    console.error("[internal] saving article failed", err);
    return { error: "Could not save. Please try again." };
  }

  // A live article that is edited must refresh on the storefront too.
  if (existing.status === "PUBLISHED") revalidateFor(existing.type, slug);
  revalidatePath(`/admin/content/${input.id}`);

  return { success: "Saved." };
}

/**
 * The enforcement point. Re-reads the row from the database and re-runs every
 * rule server-side: the editor's disabled Publish button is a courtesy, not a
 * control. There is no override.
 */
export async function publishArticleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Invalid submission" };

  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) return { error: "That article no longer exists." };

  const violations = await articleViolations(row);
  if (violations.length > 0) {
    return {
      error: `Cannot publish: ${violations.length} rule violation${
        violations.length === 1 ? "" : "s"
      }. ${violations.map((v) => v.why).join("; ")}.`,
    };
  }

  try {
    await prisma.article.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: row.publishedAt ?? new Date() },
    });
  } catch (err) {
    console.error("[internal] publishing article failed", err);
    return { error: "Could not publish. Please try again." };
  }

  revalidateFor(row.type, row.slug);
  revalidatePath(`/admin/content/${id}`);

  return { success: "Published. It is live now." };
}

export async function unpublishArticleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Invalid submission" };

  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) return { error: "That article no longer exists." };

  // publishedAt is deliberately kept: it is what locks the slug, and
  // unpublishing must not reopen a URL that has already been indexed.
  try {
    await prisma.article.update({ where: { id }, data: { status: "DRAFT" } });
  } catch (err) {
    console.error("[internal] unpublishing article failed", err);
    return { error: "Could not unpublish. Please try again." };
  }

  revalidateFor(row.type, row.slug);
  revalidatePath(`/admin/content/${id}`);

  return { success: "Unpublished. The page now returns 404." };
}

export async function deleteArticleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Invalid submission" };

  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) return { error: "That article no longer exists." };
  if (row.status === "PUBLISHED")
    return { error: "Unpublish it first, so you cannot delete a live page by accident." };

  try {
    await prisma.article.delete({ where: { id } });
  } catch (err) {
    console.error("[internal] deleting article failed", err);
    return { error: "Could not delete. Please try again." };
  }

  revalidateFor(row.type, row.slug);
  redirect("/admin/content");
}
