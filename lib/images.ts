// Product image URLs (server and client safe). The API stores images either as plain URLs or
// as objects carrying the URL under `url`, `src` or `href`.

function imageUrl(item: unknown): string | null {
  if (typeof item === "string") return item.startsWith("http") ? item : null;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["url", "src", "href"]) {
      const value = record[key];
      if (typeof value === "string" && value.startsWith("http")) return value;
    }
  }
  return null;
}

// Distinct image URLs, in catalog order.
export function productImages(images: unknown[] | null | undefined): string[] {
  return [...new Set((images ?? []).map(imageUrl).filter((u): u is string => Boolean(u)))];
}

export function firstImage(images: unknown[] | null | undefined): string | null {
  return productImages(images)[0] ?? null;
}
