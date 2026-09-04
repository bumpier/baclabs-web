import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { parseImages } from "@/lib/catalog";
import { ProductImage } from "@/components/ProductImage";
import { ProductForm } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  const image = parseImages(product)[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Catalogue</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Edit product
      </h1>

      {image && (
        <div className="mt-6 h-28 w-28 overflow-hidden rounded-xl border border-line bg-brand-tint">
          <ProductImage src={image} alt={product.name} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="card mt-6 p-8">
        <ProductForm
          values={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            priceGbp: product.priceGbp.toString(),
            stock: product.stock,
            weightGrams: product.weightGrams,
            supplyDays: product.supplyDays,
            active: product.active,
            currentImage: image,
          }}
        />
      </div>
    </div>
  );
}
