/**
 * Emits one JSON-LD block. The only reason this is a component rather than an
 * inline <script> in each page is the escape: JSON.stringify leaves `<` alone,
 * so a `</script>` inside any authored string (an FAQ answer, a review body)
 * would end the block early and hand the rest of the string to the HTML
 * parser. Escaping `<` as `\\u003c` is valid JSON and inert in HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
