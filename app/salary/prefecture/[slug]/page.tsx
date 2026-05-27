import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { PrefectureDetailClient } from './client'
import { PrefectureJsonLd } from '@/components/json-ld'
import { buildMetadata } from '@/lib/seo'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

async function fetchPrefectureBasic(name: string) {
  try {
    const rows = await query(
      `SELECT pw.annual_income, pw.monthly_wage, pw.annual_bonus, d.survey_year
       FROM prefecture_wages pw
       JOIN datasets d ON pw.dataset_id = d.id
       WHERE pw.prefecture = ? AND pw.sex = '計' AND pw.enterprise_size = '企業規模計'
       ORDER BY d.survey_year DESC LIMIT 1`,
      [name]
    ) as Array<{ annual_income: number | null; monthly_wage: number | null; annual_bonus: number | null; survey_year: number }>
    return rows[0] ?? null
  } catch { return null }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  let name: string
  try { name = decodeURIComponent(slug) } catch { name = slug }

  return buildMetadata({
    title: `${name}の平均年収 | 都道府県別年収ランキング | AIリクルート`,
    description: `${name}の平均年収・月給・賞与・残業時間を賃金構造基本統計調査データで解説。全国との比較や年度別推移もわかります。`,
    keywords: [`${name} 年収`, `${name} 平均年収`, '都道府県 年収', '地域別 賃金'],
    path: `/salary/prefecture/${slug}`,
  })
}

export default async function PrefectureDetailPage({ params }: Props) {
  const { slug } = await params
  let prefectureName: string
  try { prefectureName = decodeURIComponent(slug) } catch { prefectureName = slug }

  const row = await fetchPrefectureBasic(prefectureName)

  return (
    <div className="min-h-screen bg-background">
      {row && (
        <PrefectureJsonLd
          prefectureName={prefectureName}
          annualIncomeWan={row.annual_income != null ? Math.round(row.annual_income / 10) : null}
          monthlyWageWan={row.monthly_wage  != null ? Math.round(row.monthly_wage  / 10) : null}
          annualBonusWan={row.annual_bonus  != null ? Math.round(row.annual_bonus  / 10) : null}
          surveyYear={row.survey_year}
          slug={slug}
        />
      )}
      <Nav />
      <PrefectureDetailClient prefectureName={prefectureName} />
    </div>
  )
}
