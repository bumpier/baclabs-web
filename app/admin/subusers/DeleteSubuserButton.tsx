"use client";

import { deleteSubuserAction } from "@/app/admin/subusers/actions";

export default function DeleteSubuserButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <form
      action={deleteSubuserAction}
      onSubmit={(e) => {
        if (!confirm(`Remove ${name}? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm font-semibold text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
