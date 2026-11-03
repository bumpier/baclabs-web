/**
 * Which brand a new row belongs to (a campaign, a subscriber, free vials).
 * The options come in as props (brandOptions() in lib/admin/brand-scope.ts),
 * so client forms can use it without importing the registry. Required: a
 * row always has a brand, and the server action checks it is registered.
 */
export function BrandSelect({
  id,
  options,
  defaultValue,
  name = "brand",
  className = "field",
}: {
  id: string;
  options: readonly { id: string; label: string }[];
  defaultValue: string;
  name?: string;
  className?: string;
}) {
  return (
    <select id={id} name={name} required defaultValue={defaultValue} className={className}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
