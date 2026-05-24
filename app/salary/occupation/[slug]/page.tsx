import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Nav } from '@/components/nav'
import { OccupationDetailClient } from './client'
import { OccupationJsonLd } from '@/components/json-ld'
import { query } from '@/lib/db'

interface Props {
  params: Promise<{ slug: string }>
}

// 静的パラメータ生成（ビルド時にすべての職種ページを生成）
export async function generateStaticParams() {
  try {
    const rows = await query(
      `SELECT DISTINCT occupation_name FROM occupation_wages
       WHERE sex = '計' AND enterprise_size = '企業規模計'
       ORDER BY occupation_name LIMIT 500`
    ) as Array<{ occupation_name: string }>
    return rows.map(r => ({ slug: encodeURIComponent(r.occupation_name) }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params
  let slug: string
  try { slug = decodeURIComponent(rawSlug) } catch { slug = rawSlug }

  const BASE_URL = 'https://ai-recruit.jp'

  try {
    // occupation_name で直接検索（occupation_slug 列依存を廃止）
    const rows = await query(
      `SELECT ow.occupation_name,
              ow.annual_income,
              ow.scheduled_wage,
              ow.annual_bonus,
              d.survey_year
       FROM occupation_wages ow
       JOIN datasets d ON ow.dataset_id = d.id
       WHERE ow.occupation_name = ?
         AND ow.sex = '計'
         AND ow.enterprise_size = '企業規模計'
       ORDER BY d.survey_year DESC
       LIMIT 1`,
      [slug]
    ) as Array<{
      occupation_name: string
      annual_income: number | null
      scheduled_wage: number | null
      annual_bonus: number | null
      survey_year: number
    }>

    if (rows.length === 0) return { title: '職種が見つかりません | AIリクルート' }

    const { occupation_name: name, annual_income, scheduled_wage, annual_bonus, survey_year } = rows[0]
    // DBは千円単位 → 万円に変換
    const incomeWan   = annual_income  != null ? Math.round(annual_income  / 10) : null
    const monthlyWan  = scheduled_wage != null ? Math.round(scheduled_wage / 10) : null
    const bonusWan    = annual_bonus   != null ? Math.round(annual_bonus   / 10) : null

    const incomePart  = incomeWan  != null ? `推定年収${incomeWan.toLocaleString()}万円` : ''
    const monthlyPart = monthlyWan != null ? `月給${monthlyWan.toLocaleString()}万円` : ''
    const bonusPart   = bonusWan   != null ? `年間賞与${bonusWan.toLocaleString()}万円` : ''
    const dataParts   = [incomePart, monthlyPart, bonusPart].filter(Boolean).join('・')

    const title        = `${name}の平均年収${incomeWan != null ? `${incomeWan.toLocaleString()}万円` : ''}【${survey_year}年】| AIリクルート`
    const description  = `${name}の${survey_year}年調査データ。${dataParts}。企業規模別・男女別の詳細年収データを賃金構造基本統計調査をもとに掲載しています。`
    const canonicalUrl = `${BASE_URL}/salary/occupation/${rawSlug}`
    const ogImage      = `${BASE_URL}/og-default.jpg`

    return {
      title,
      description,
      keywords: [
        `${name} 年収`, `${name} 平均年収`, `${name} 給与`, `${name} 月収`,
        '賃金構造基本統計調査', 'e-Stat', '年収データ',
      ],
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: 'article',
        locale: 'ja_JP',
        url: canonicalUrl,
        siteName: 'AIリクルート 年収データベース',
        title,
        description,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    }
  } catch {
    return { title: '職種詳細 | AIリクルート' }
  }
}

export default async function OccupationDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params
  let slug: string
  try { slug = decodeURIComponent(rawSlug) } catch { slug = rawSlug }

  // JSON-LD用にサーバーサイドで基本データを取得
  let jsonLdData: {
    occupationName: string
    annualIncomeWan: number | null
    monthlyWageWan: number | null
    annualBonusWan: number | null
    surveyYear: number
  } | null = null

  try {
    const rows = await query(
      `SELECT ow.occupation_name, ow.annual_income, ow.scheduled_wage, ow.annual_bonus, d.survey_year
       FROM occupation_wages ow
       JOIN datasets d ON ow.dataset_id = d.id
       WHERE ow.occupation_name = ?
         AND ow.sex = '計' AND ow.enterprise_size = '企業規模計'
       ORDER BY d.survey_year DESC LIMIT 1`,
      [slug]
    ) as Array<{ occupation_name: string; annual_income: number | null; scheduled_wage: number | null; annual_bonus: number | null; survey_year: number }>

    if (rows.length > 0) {
      const r = rows[0]
      jsonLdData = {
        occupationName: r.occupation_name,
        annualIncomeWan: r.annual_income != null ? Math.round(r.annual_income / 10) : null,
        monthlyWageWan:  r.scheduled_wage != null ? Math.round(r.scheduled_wage / 10) : null,
        annualBonusWan:  r.annual_bonus != null ? Math.round(r.annual_bonus / 10) : null,
        surveyYear: r.survey_year,
      }
    }
  } catch {
    // JSON-LDは取得失敗してもページ表示には影響させない
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {jsonLdData && (
        <OccupationJsonLd
          occupationName={jsonLdData.occupationName}
          annualIncomeWan={jsonLdData.annualIncomeWan}
          monthlyWageWan={jsonLdData.monthlyWageWan}
          annualBonusWan={jsonLdData.annualBonusWan}
          surveyYear={jsonLdData.surveyYear}
          slug={rawSlug}
        />
      )}
      <Nav />
      <OccupationDetailClient slug={rawSlug} />
    </div>
  )
}
