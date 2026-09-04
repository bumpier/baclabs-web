import { requireAdminRole } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { toggleSubuserAction } from "@/app/admin/subusers/actions";
import SubuserForm from "./SubuserForm";
import DeleteSubuserButton from "./DeleteSubuserButton";

export const dynamic = "force-dynamic";

export default async function SubusersPage() {
  await requireAdminRole("ADMIN");

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Access control</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Team members
      </h1>

      {users.length > 0 && (
        <div className="card mt-10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-tint/40">
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-5 py-3 text-ink-soft">{u.email}</td>
                  <td className="px-5 py-3 capitalize text-ink-soft">
                    {u.role.toLowerCase()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        u.active
                          ? "bg-brand-tint text-brand-deep"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {u.active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <form action={toggleSubuserAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(u.active)} />
                        <button
                          type="submit"
                          className="text-sm font-semibold text-ink-soft hover:text-brand"
                        >
                          {u.active ? "Suspend" : "Reinstate"}
                        </button>
                      </form>
                      <DeleteSubuserButton id={u.id} name={u.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card mt-10 p-6">
        <h2 className="font-display text-xl font-medium text-brand-deep">
          Add team member
        </h2>
        <SubuserForm />
      </div>
    </div>
  );
}
