import type { MetadataRoute } from 'next'
import { query } from '@/lib/db'

const BASE_URL = 'https://ai-recruit.jp'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/salary/trend`,                                        lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/salary/ranking/occupation`,                           lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/salary/ranking/industry`,                             lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/salary/ranking/role`,                                 lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/salary/ranking/age-group`,                            lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/salary/ranking/education`,                            lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
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

  // 職種・産業・都道府県・学歴・年齢・役職のスラッグページを並列取得
  const [occupationRows, industryRows, prefectureRows, educationRows, ageGroupRows, roleRows] = await Promise.all([
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
    query(
      `SELECT DISTINCT prefecture FROM prefecture_wages
       WHERE sex = '計' AND enterprise_size = '企業規模計'
       ORDER BY prefecture LIMIT 100`
    ).catch(() => []) as Promise<Array<{ prefecture: string }>>,
    query(
      `SELECT DISTINCT education FROM age_wages
       WHERE sex = '計' AND enterprise_size = '企業規模計' AND age_group = '学歴計'
         AND education != '学歴計'
       ORDER BY education LIMIT 20`
    ).catch(() => []) as Promise<Array<{ education: string }>>,
    query(
      `SELECT DISTINCT age_group FROM age_wages
       WHERE sex = '計' AND enterprise_size = '企業規模計' AND education = '学歴計'
         AND age_group != '学歴計'
       ORDER BY age_group LIMIT 30`
    ).catch(() => []) as Promise<Array<{ age_group: string }>>,
    query(
      `SELECT DISTINCT role_name FROM role_wages
       WHERE sex = '計'
       ORDER BY role_name LIMIT 20`
    ).catch(() => []) as Promise<Array<{ role_name: string }>>,
  ])

  const occupationPages: MetadataRoute.Sitemap = occupationRows.map(r => ({
    url: `${BASE_URL}/salary/occupation/${encodeURIComponent(r.occupation_name)}`,
    lastModified: now, changeFrequency: 'monthly', priority: 0.8,
  }))

  const industryPages: MetadataRoute.Sitemap = industryRows.map(r => ({
    url: `${BASE_URL}/salary/industry/${encodeURIComponent(r.industry_name)}`,
    lastModified: now, changeFrequency: 'monthly', priority: 0.75,
  }))

  const prefecturePages: MetadataRoute.Sitemap = prefectureRows.map(r => ({
    url: `${BASE_URL}/salary/prefecture/${encodeURIComponent(r.prefecture)}`,
    lastModified: now, changeFrequency: 'monthly', priority: 0.75,
  }))

  const educationPages: MetadataRoute.Sitemap = educationRows.map(r => ({
    url: `${BASE_URL}/salary/education/${encodeURIComponent(r.education)}`,
    lastModified: now, changeFrequency: 'monthly', priority: 0.7,
  }))

  const ageGroupPages: MetadataRoute.Sitemap = ageGroupRows.map(r => ({
    url: `${BASE_URL}/salary/age-group/${encodeURIComponent(r.age_group)}`,
    lastModified: now, changeFrequency: 'monthly', priority: 0.7,
  }))

  const rolePages: MetadataRoute.Sitemap = roleRows.map(r => ({
    url: `${BASE_URL}/salary/role/${encodeURIComponent(r.role_name)}`,
    lastModified: now, changeFrequency: 'monthly', priority: 0.7,
  }))

  return [
    ...staticPages,
    ...occupationPages,
    ...industryPages,
    ...prefecturePages,
    ...educationPages,
    ...ageGroupPages,
    ...rolePages,
  ]
}
