import { requireAdmin } from "@/lib/adminAuth";
import { ProductForm } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Catalogue</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Add product
      </h1>
      <div className="card mt-8 p-8">
        <ProductForm
          values={{
            name: "",
            slug: "",
            description: "",
            priceGbp: "",
            stock: 0,
            weightGrams: 0,
            supplyDays: 0,
            active: true,
            currentImage: null,
          }}
        />
      </div>
    </div>
  );
}
