import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { RoleDetailClient } from './client'
import { RoleJsonLd } from '@/components/json-ld'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params
  let roleName: string
  try { roleName = decodeURIComponent(rawSlug) } catch { roleName = rawSlug }

  const BASE_URL = 'https://ai-recruit.jp'

  try {
    const rows = await query(
      `SELECT rw.annual_income, rw.scheduled_wage, rw.annual_bonus, d.survey_year
       FROM role_wages rw
       JOIN datasets d ON rw.dataset_id = d.id
       WHERE rw.role_name = ? AND rw.sex = '計' AND rw.enterprise_size = '10人以上'
         AND rw.education = '学歴計' AND rw.age_group = '学歴計'
         AND rw.tenure_category = '勤続年数計'
       ORDER BY d.survey_year DESC LIMIT 1`,
      [roleName]
    ) as Array<{ annual_income: number | null; scheduled_wage: number | null; annual_bonus: number | null; survey_year: number }>

    if (rows.length === 0) return { title: '役職が見つかりません | AIリクルート' }

    const { annual_income, scheduled_wage, annual_bonus, survey_year } = rows[0]
    const incomeWan  = annual_income  != null ? Math.round(Number(annual_income)  / 10) : null
    const monthlyWan = scheduled_wage != null ? Math.round(Number(scheduled_wage) / 10) : null
    const bonusWan   = annual_bonus   != null ? Math.round(Number(annual_bonus)   / 10) : null

    const parts = [
      incomeWan  != null ? `推定年収${incomeWan.toLocaleString()}万円` : '',
      monthlyWan != null ? `月給${monthlyWan.toLocaleString()}万円` : '',
      bonusWan   != null ? `年間賞与${bonusWan.toLocaleString()}万円` : '',
    ].filter(Boolean).join('・')

    const title       = `${roleName}の平均年収${incomeWan != null ? `${incomeWan.toLocaleString()}万円` : ''}【${survey_year}年】| AIリクルート`
    const description = `${roleName}の${survey_year}年調査データ。${parts}。企業規模別・勤続年数別の詳細年収データを賃金構造基本統計調査をもとに掲載しています。`
    const canonicalUrl = `${BASE_URL}/salary/role/${rawSlug}`
    const ogImage      = `${BASE_URL}/og-default.jpg`

    return {
      title,
      description,
      keywords: [`${roleName} 年収`, `${roleName} 平均年収`, `${roleName} 給与`, '賃金構造基本統計調査', '役職別年収'],
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: 'article', locale: 'ja_JP', url: canonicalUrl,
        siteName: 'AIリクルート 年収データベース', title, description,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
    }
  } catch {
    return { title: '役職詳細 | AIリクルート' }
  }
}

export default async function RoleDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params
  let roleName: string
  try { roleName = decodeURIComponent(rawSlug) } catch { roleName = rawSlug }

  let jsonLdData: { annual_income: number | null; scheduled_wage: number | null; annual_bonus: number | null; survey_year: number } | null = null
  try {
    const rows = await query(
      `SELECT rw.annual_income, rw.scheduled_wage, rw.annual_bonus, d.survey_year
       FROM role_wages rw JOIN datasets d ON rw.dataset_id = d.id
       WHERE rw.role_name = ? AND rw.sex = '計' AND rw.enterprise_size = '10人以上'
         AND rw.education = '学歴計' AND rw.age_group = '学歴計' AND rw.tenure_category = '勤続年数計'
       ORDER BY d.survey_year DESC LIMIT 1`,
      [roleName]
    ) as Array<{ annual_income: number | null; scheduled_wage: number | null; annual_bonus: number | null; survey_year: number }>
    jsonLdData = rows[0] ?? null
  } catch { /* no-op */ }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {jsonLdData && (
        <RoleJsonLd
          roleName={roleName}
          annualIncomeWan={jsonLdData.annual_income  != null ? Math.round(Number(jsonLdData.annual_income)  / 10) : null}
          monthlyWageWan={jsonLdData.scheduled_wage  != null ? Math.round(Number(jsonLdData.scheduled_wage) / 10) : null}
          annualBonusWan={jsonLdData.annual_bonus    != null ? Math.round(Number(jsonLdData.annual_bonus)   / 10) : null}
          surveyYear={jsonLdData.survey_year}
          slug={rawSlug}
        />
      )}
      <Nav />
      <RoleDetailClient slug={rawSlug} />
    </div>
  )
}
