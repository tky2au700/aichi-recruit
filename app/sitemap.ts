import type { MetadataRoute } from 'next'
import { query } from '@/lib/db'

const BASE_URL = 'https://ai-recruit.jp'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                             lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/salary/ranking/occupation`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/salary/ranking/male`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/salary/ranking/female`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/salary/ranking/bonus`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/salary/ranking/hourly-wage`,            lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/salary/ranking/growth`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/ranking/high-income-low-overtime`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/industry`,                       lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/salary/prefecture`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/salary/education`,                      lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/age`,                            lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ]

  // 職種詳細ページ（動的）
  let dynamicPages: MetadataRoute.Sitemap = []
  try {
    // occupation_slug がある場合は slug で、ない場合は occupation_name でURL生成
    const colCheck = await query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'occupation_wages'
         AND COLUMN_NAME = 'occupation_slug'`
    ) as Array<{ COLUMN_NAME: string }>

    if (colCheck.length > 0) {
      const rows = await query(
        `SELECT DISTINCT occupation_slug, occupation_name FROM occupation_wages
         WHERE occupation_slug IS NOT NULL ORDER BY occupation_name LIMIT 500`
      ) as Array<{ occupation_slug: string; occupation_name: string }>
      dynamicPages = rows.map(r => ({
        url: `${BASE_URL}/salary/occupation/${r.occupation_slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    } else {
      const rows = await query(
        `SELECT DISTINCT occupation_name FROM occupation_wages ORDER BY occupation_name LIMIT 500`
      ) as Array<{ occupation_name: string }>
      dynamicPages = rows.map(r => ({
        url: `${BASE_URL}/salary/occupation/${encodeURIComponent(r.occupation_name)}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    }
  } catch {
    // DB未接続時はスキップ
  }

  return [...staticPages, ...dynamicPages]
}
