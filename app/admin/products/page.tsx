import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { formatPrice } from "@/config/brand";
import { priceIn } from "@/lib/fx";
import { fetchFxRates } from "@/lib/fx-rates";
import { parseImages } from "@/lib/catalog";
import { deleteProductAction } from "@/app/admin/actions";
import { ProductImage } from "@/components/ProductImage";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdmin();

  const products = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  const rates = await fetchFxRates();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
            Products
          </h1>
        </div>
        <Link href="/admin/products/new" className="btn-primary">
          Add product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-sm text-ink-soft">
          No products yet. Add your first one.
        </p>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">Price (GBP)</th>
                <th className="px-5 py-3 font-semibold">Price (PKR)</th>
                <th className="px-5 py-3 font-semibold">Stock</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-brand-tint/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg border border-line bg-brand-tint">
                        <ProductImage
                          src={parseImages(p)[0] ?? null}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-ink-soft">/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{formatPrice(p.priceGbp.toString(), "GBP")}</td>
                  <td className="px-5 py-3">
                    <span className={p.stock <= 5 ? "font-semibold text-amber-700" : ""}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.active ? "bg-brand-tint text-brand-deep" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {p.active ? "active" : "hidden"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="text-sm font-semibold text-brand hover:text-brand-deep"
                      >
                        Edit
                      </Link>
                      {p.active && (
                        <form action={deleteProductAction}>
                          <input type="hidden" name="productId" value={p.id} />
                          <button
                            type="submit"
                            className="text-sm text-ink-soft/60 hover:text-red-700"
                          >
                            Hide
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
