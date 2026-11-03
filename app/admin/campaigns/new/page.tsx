import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import { adminBrandScope, defaultBrandFor } from "@/lib/admin/brand-scope";
import { ActionForm } from "@/components/admin/ActionForm";
import { saveCampaignAction } from "@/app/admin/campaigns/actions";
import { CampaignFields } from "@/app/admin/campaigns/CampaignFields";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  await requireAdminRole("ADMIN");
  // Starts in the admin's brand scope, or BacLab's while every brand is in scope.
  const defaultBrand = defaultBrandFor(await adminBrandScope((await searchParams).brand));
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/admin/campaigns" className="text-sm text-ink-soft hover:text-ink">
        ← Campaigns
      </Link>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-brand-deep">New campaign</h1>
      <p className="mt-2 text-ink-soft">
        Save a draft first. You can then add a discount code, preview it, send yourself a test, and send it.
      </p>
      <div className="card mt-8 p-6">
        <ActionForm action={saveCampaignAction} submitLabel="Save draft">
          <CampaignFields defaultBrand={defaultBrand} />
        </ActionForm>
      </div>
    </div>
  );
}
