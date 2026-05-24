import type { MetadataRoute } from 'next'
import { query } from '@/lib/db'

const BASE_URL = 'https://ai-recruit.jp'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/salary/ranking/occupation`,                           lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/salary/ranking/industry`,                             lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/salary/ranking/growth`,                               lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/salary/ranking/overtime-wage`,                        lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/salary/ranking/bonus`,                                lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/ranking/male`,                                 lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/ranking/female`,                               lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/ranking/hourly-wage`,                          lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/ranking/high-income-large-workforce`,          lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/ranking/high-income-low-overtime`,             lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/salary/age`,                                          lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/salary/education`,                                    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/salary/prefecture`,                                   lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]

  // 職種詳細ページ・産業詳細ページを並列取得
  const [occupationRows, industryRows] = await Promise.all([
    query(
      `SELECT DISTINCT occupation_name FROM occupation_wages
       WHERE sex = '計' AND enterprise_size = '企業規模計'
       ORDER BY occupation_name LIMIT 500`
    ).catch(() => []) as Promise<Array<{ occupation_name: string }>>,
    query(
      `SELECT DISTINCT industry_name FROM industry_wages
       WHERE sex = '計' AND enterprise_size = '企業規模計' AND education = '学歴計'
       ORDER BY industry_name LIMIT 100`
    ).catch(() => []) as Promise<Array<{ industry_name: string }>>,
  ])

  const occupationPages: MetadataRoute.Sitemap = occupationRows.map(r => ({
    url: `${BASE_URL}/salary/occupation/${encodeURIComponent(r.occupation_name)}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const industryPages: MetadataRoute.Sitemap = industryRows.map(r => ({
    url: `${BASE_URL}/salary/industry/${encodeURIComponent(r.industry_name)}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.75,
  }))

  return [...staticPages, ...occupationPages, ...industryPages]
}
