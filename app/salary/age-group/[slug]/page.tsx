import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { AgeGroupDetailClient } from './client'
import { AgeGroupJsonLd } from '@/components/json-ld'
import { query } from '@/lib/db'
import { buildMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params
  let slug: string
  try { slug = decodeURIComponent(rawSlug) } catch { slug = rawSlug }

  try {
    const rows = await query(
      `SELECT aw.annual_income, aw.scheduled_wage, aw.annual_bonus, d.survey_year
       FROM age_wages aw
       JOIN datasets d ON aw.dataset_id = d.id
       WHERE aw.age_group = ? AND aw.education = '学歴計'
         AND aw.sex = '計' AND aw.enterprise_size = '企業規模計'
       ORDER BY d.survey_year DESC LIMIT 1`,
      [slug]
    ) as Array<{ annual_income: number | null; scheduled_wage: number | null; annual_bonus: number | null; survey_year: number }>

    if (rows.length === 0) return { title: '年齢階級が見つかりません | AIリクルート' }

    const { annual_income, scheduled_wage, annual_bonus, survey_year } = rows[0]
    const incomeWan  = annual_income  != null ? Math.round(annual_income  / 10) : null
    const monthlyWan = scheduled_wage != null ? Math.round(scheduled_wage / 10) : null
    const bonusWan   = annual_bonus   != null ? Math.round(annual_bonus   / 10) : null

    const dataParts = [
      incomeWan  != null ? `推定年収${incomeWan.toLocaleString()}万円`  : '',
      monthlyWan != null ? `月給${monthlyWan.toLocaleString()}万円`     : '',
      bonusWan   != null ? `年間賞与${bonusWan.toLocaleString()}万円`   : '',
    ].filter(Boolean).join('・')

    return buildMetadata({
      title: `${slug}の平均年収${incomeWan != null ? `${incomeWan.toLocaleString()}万円` : ''}【${survey_year}年】| AIリクルート`,
      description: `${slug}の${survey_year}年調査データ。${dataParts}。企業規模別・男女別の詳細年収データを賃金構造基本統計調査をもとに掲載しています。`,
      keywords: [`${slug} 年収`, `${slug} 平均年収`, '年齢別 年収', '賃金構造基本統計調査'],
      path: `/salary/age-group/${rawSlug}`,
    })
  } catch {
    return { title: '年齢別年収詳細 | AIリクルート' }
  }
}

export default async function AgeGroupDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params
  let slug: string
  try { slug = decodeURIComponent(rawSlug) } catch { slug = rawSlug }

  let jsonLdData: { annual_income: number | null; scheduled_wage: number | null; annual_bonus: number | null; survey_year: number } | null = null
  try {
    const rows = await query(
      `SELECT aw.annual_income, aw.scheduled_wage, aw.annual_bonus, d.survey_year
       FROM age_wages aw JOIN datasets d ON aw.dataset_id = d.id
       WHERE aw.age_group = ? AND aw.education = '学歴計' AND aw.sex = '計' AND aw.enterprise_size = '企業規模計'
       ORDER BY d.survey_year DESC LIMIT 1`,
      [slug]
    ) as Array<{ annual_income: number | null; scheduled_wage: number | null; annual_bonus: number | null; survey_year: number }>
    jsonLdData = rows[0] ?? null
  } catch { /* no-op */ }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {jsonLdData && (
        <AgeGroupJsonLd
          ageGroup={slug}
          annualIncomeWan={jsonLdData.annual_income  != null ? Math.round(jsonLdData.annual_income  / 10) : null}
          monthlyWageWan={jsonLdData.scheduled_wage  != null ? Math.round(jsonLdData.scheduled_wage  / 10) : null}
          annualBonusWan={jsonLdData.annual_bonus    != null ? Math.round(jsonLdData.annual_bonus    / 10) : null}
          surveyYear={jsonLdData.survey_year}
          slug={rawSlug}
        />
      )}
      <Nav />
      <AgeGroupDetailClient slug={rawSlug} />
    </div>
  )
}
