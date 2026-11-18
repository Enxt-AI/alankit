/**
 * Server-rendered JSON-LD structured data.
 *
 * Renders a <script type="application/ld+json"> tag directly into the HTML
 * so crawlers and AI answer engines can read it without executing JavaScript.
 *
 * Usage (server components only):
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", ... }} />
 *
 * Do not import from "use client" components. If the data is only available
 * client-side, render JSON-LD from the nearest server parent (layout or page)
 * instead.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // Escape characters that can break out of a <script> context or out of a
  // JSON string literal in older engines. `JSON.stringify` leaves these
  // untouched, so a field containing `</script>` would terminate the tag and
  // turn the following content into executable HTML (stored XSS when the
  // field is CMS-editable, e.g. article summary/author/FAQ copy).
  // See: https://react.dev/reference/react-dom/components/script
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
