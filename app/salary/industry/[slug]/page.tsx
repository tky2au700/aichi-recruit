import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Nav } from '@/components/nav'
import { IndustryDetailClient } from './client'
import { IndustryJsonLd } from '@/components/json-ld'
import { buildMetadata } from '@/lib/seo'
import { query } from '@/lib/db'

// 日本語産業名をURLエンコードするとパスが長くなりすぎるため動的レンダリングに統一
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://ai-recruit.jp'

type Params = Promise<{ slug: string }>

// アルファベット分類記号を除いた表示名に変換
function toDisplayName(industryName: string) {
  return industryName
    .replace(/^[A-ZＡ-Ｚ]\s*/, '')
    .replace(/^\(民[＋+]公\)\s*[A-ZＡ-Ｚ]?\s*/, '(民+公) ')
    .trim()
}

// 産業の基本データをDBから取得（generateMetadata とページ本体で共通利用）
async function fetchIndustryBasic(industryName: string) {
  try {
    const rows = await query(
      `SELECT w.annual_income, w.monthly_wage, w.annual_bonus, w.overtime_hours, w.workers,
              d.survey_year
       FROM industry_wages w
       JOIN datasets d ON d.id = w.dataset_id
       JOIN dataset_groups dg ON dg.id = d.group_id
       WHERE w.industry_name = ?
         AND w.sex = '計' AND w.enterprise_size = '企業規模計' AND w.education = '学歴計'
         AND dg.target_table = 'industry_wages'
       ORDER BY d.survey_year DESC, w.workers DESC
       LIMIT 1`,
      [industryName]
    ) as Array<{
      annual_income: number | null; monthly_wage: number | null
      annual_bonus: number | null; overtime_hours: number | null
      workers: number | null; survey_year: number
    }>
    return rows[0] ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const industryName = decodeURIComponent(slug)
  const displayName  = toDisplayName(industryName)

  const row = await fetchIndustryBasic(industryName)
  const surveyYear  = row?.survey_year ?? 2025
  const incomeWan   = row?.annual_income  != null ? Math.round(row.annual_income  / 10) : null
  const monthlyWan  = row?.monthly_wage   != null ? Math.round(row.monthly_wage   / 10) : null
  const bonusWan    = row?.annual_bonus   != null ? Math.round(row.annual_bonus   / 10) : null

  const incomePart  = incomeWan  != null ? `平均年収${incomeWan.toLocaleString()}万円` : ''
  const monthlyPart = monthlyWan != null ? `月給${monthlyWan.toLocaleString()}万円` : ''
  const bonusPart   = bonusWan   != null ? `年間賞与${bonusWan.toLocaleString()}万円` : ''
  const dataParts   = [incomePart, monthlyPart, bonusPart].filter(Boolean).join('・')

  const title       = `${displayName}の平均年収${incomeWan != null ? `${incomeWan.toLocaleString()}万円` : ''}【${surveyYear}年】| AIリクルート`
  const description = `${displayName}の${surveyYear}年平均年収データ。${dataParts}。性別・企業規模別・年齢階級別の詳細を賃金構造基本統計調査データで掲載。`

  return buildMetadata({
    title,
    description,
    keywords: [
      `${displayName} 年収`, `${displayName} 平均年収`, `${displayName} 給与`,
      `${displayName} 月収`, '産業別 年収', '業界 年収', '賃金構造基本統計調査',
    ],
    path: `/salary/industry/${slug}`,
  })
}

export default async function IndustryDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  const industryName = decodeURIComponent(slug)
  const displayName  = toDisplayName(industryName)

  // JSON-LD 用にサーバーサイドで基本データを取得
  const row = await fetchIndustryBasic(industryName)

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {row && (
        <IndustryJsonLd
          industryName={displayName}
          annualIncomeWan={row.annual_income != null ? Math.round(row.annual_income / 10) : null}
          monthlyWageWan={row.monthly_wage  != null ? Math.round(row.monthly_wage  / 10) : null}
          annualBonusWan={row.annual_bonus  != null ? Math.round(row.annual_bonus  / 10) : null}
          surveyYear={row.survey_year}
          slug={slug}
        />
      )}
      <Nav />
      <Suspense fallback={<div style={{ padding: 80, textAlign: 'center', color: '#94A3B8' }}>読み込み中...</div>}>
        <IndustryDetailClient slug={slug} />
      </Suspense>
    </div>
  )
}
