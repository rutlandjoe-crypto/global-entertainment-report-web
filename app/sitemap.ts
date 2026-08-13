import type { MetadataRoute } from "next";
import { getEditorialItems, parsePublishedDate, SITE_URL } from "./lib/editorial-archive";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items = await getEditorialItems();
  const latestPublished = items.reduce<Date | undefined>((latest, item) => {
    const published = parsePublishedDate(item.published);
    if (!published) return latest;
    return !latest || published > latest ? published : latest;
  }, undefined);

  return [
    {
      url: `${SITE_URL}/`,
      ...(latestPublished ? { lastModified: latestPublished } : {}),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/archive`,
      ...(latestPublished ? { lastModified: latestPublished } : {}),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...items.map((item) => ({
      url: `${SITE_URL}/editorial/${item.slug}`,
      ...(parsePublishedDate(item.published)
        ? { lastModified: parsePublishedDate(item.published) as Date }
        : {}),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
