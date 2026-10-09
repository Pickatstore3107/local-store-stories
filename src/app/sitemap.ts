import type { MetadataRoute } from "next";
import { memoryPath } from "@/lib/memories";
import { loadPublicMemories } from "@/lib/server/wall";
import { SITE_URL } from "@/lib/site";

/**
 * The pages search engines may list: Home, the map, sharing, the two notices,
 * and every approved memory shared with everyone. Memories shared by link,
 * profiles and invites stay out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const at = (path: string) => new URL(path, SITE_URL).toString();
  const data = await loadPublicMemories();
  const memories = (data?.stories ?? []).map((story) => ({
    url: at(memoryPath(story.id)),
    lastModified: story.approvedAt ? new Date(story.approvedAt) : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [
    { url: at("/"), changeFrequency: "daily", priority: 1 },
    { url: at("/map"), changeFrequency: "daily", priority: 0.8 },
    { url: at("/share"), changeFrequency: "yearly", priority: 0.5 },
    { url: at("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: at("/terms"), changeFrequency: "yearly", priority: 0.2 },
    ...memories,
  ];
}
