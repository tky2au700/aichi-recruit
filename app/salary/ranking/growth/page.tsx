import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { GrowthRankingClient } from './client'
import { buildMetadata } from '@/lib/seo'
import { RankingJsonLd } from '@/components/json-ld'

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const SORT_LABEL: Record<string, string> = {
  growth_rate:    '年収増加率',
  growth_amount:  '年収増加額',
  annual_income:  '最新年収',
  base_income:    '基準年収',
  monthly_wage:   '月給',
  annual_bonus:   '賞与',
  age:            '平均年齢',
  tenure_years:   '勤続年数',
  overtime_hours: '残業時間',
}

const SEX_LABEL: Record<string, string> = { male: '男性', female: '女性' }
const SIZE_PAGE_LABEL: Record<string, string> = {
  large: '大企業', medium: '中規模企業', small: '小規模企業',
}

type SortKey = 'growth_rate' | 'growth_amount' | 'annual_income' | 'base_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours'
type SortDir = 'asc' | 'desc'

const BASE_URL  = 'https://ai-recruit.jp'
const BASE_PATH = '/salary/ranking/growth'

type SearchParams = Promise<{ years?: string; sex?: string; size?: string; sort?: string; dir?: string }>

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------
export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const { years, sex, size, sort } = await searchParams

  const sortLabel     = sort ? (SORT_LABEL[sort] ?? '年収増加率') : '年収増加率'
  const yearsLabel    = years ? `${years}年間` : '5年間'
  const sexLabel      = sex  ? (SEX_LABEL[sex]       ?? null) : null
  const sizePageLabel = size ? (SIZE_PAGE_LABEL[size] ?? null) : null

  // デフォルト（パラメーターなし）
  if (!years && !sex && !size && !sort) {
    return buildMetadata({
      title: '職種別平均年収増加率ランキング（5年間） | AIリクルート',
      description: '賃金構造基本統計調査に基づく職種別の年収増加率ランキング。過去5年間で年収が最も伸びた職種を比較できます。',
      keywords: ['年収増加率', '職種別年収増加', '給与増加 職種', '賃上げ 職種', '年収 伸び率'],
      path: BASE_PATH,
    })
  }

  const baseTitle = `職種別平均${sortLabel}ランキング（${yearsLabel}）`
  let pageTitle: string
  if (sizePageLabel) {
    pageTitle = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageTitle = `${sexLabel}の${baseTitle}`
  } else {
    pageTitle = baseTitle
  }

  const filterDesc = [sizePageLabel, sexLabel].filter(Boolean).join('・')
  const description = `賃金構造基本統計調査に基づく${yearsLabel}間の${filterDesc ? filterDesc + 'の' : ''}${sortLabel}ランキング。年収・賞与・月給などの伸び率を職種ごとに比較できます。`

  const paramsStr = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ years, sex, size, sort }).filter(([, v]) => v != null) as [string, string][]
    )
  ).toString()

  return buildMetadata({
    title: `${pageTitle} | AIリクルート`,
    description,
    keywords: [
      `職種別${sortLabel}`, '年収増加率ランキング',
      ...(sexLabel      ? [`${sexLabel} ${sortLabel}`, `${sexLabel} 年収増加`]                     : []),
      ...(sizePageLabel ? [`${sizePageLabel} ${sortLabel}`, `${sizePageLabel} 年収増加率`]         : []),
      ...(years         ? [`${years}年間 年収増加`, `${years}年 給与増加率`]                       : []),
      ...(sort && sort !== 'growth_rate' ? [`職種別${sortLabel}ランキング`]                        : []),
    ],
    path: paramsStr ? `${BASE_PATH}?${paramsStr}` : BASE_PATH,
  })
}

// ---------------------------------------------------------------------------
// ページコンポーネント
// ---------------------------------------------------------------------------
export default async function GrowthRankingPage(
  { searchParams }: { searchParams: SearchParams }
) {
  const { years, sex, size, sort, dir } = await searchParams

  const validYears = Math.min(Math.max(1, Number(years ?? 5)), 10)
  const validSort  = (sort && sort in SORT_LABEL ? sort : 'growth_rate') as SortKey
  const validDir   = (dir === 'asc' ? 'asc' : 'desc') as SortDir

  const sortLabel     = SORT_LABEL[validSort]
  const yearsLabel    = `${validYears}年間`
  const sexLabel      = sex  ? (SEX_LABEL[sex]       ?? null) : null
  const sizePageLabel = size ? (SIZE_PAGE_LABEL[size] ?? null) : null

  // ページ内見出し（h1）
  const baseTitle = `職種別平均${sortLabel}ランキング（${yearsLabel}）`
  let pageHeading: string
  if (sizePageLabel) {
    pageHeading = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageHeading = `${sexLabel}の${baseTitle}`
  } else if (years || sex || size || sort) {
    pageHeading = baseTitle
  } else {
    pageHeading = '職種別平均年収増加率ランキング'
  }

  // ページ内解説文
  const filterDesc = [sizePageLabel, sexLabel].filter(Boolean).join('・')
  const pageDescription = (years || sex || size || sort)
    ? `賃金構造基本統計調査に基づく${yearsLabel}間の${filterDesc ? filterDesc + 'の' : ''}${sortLabel}データです。`
    : null

  const jsonLdUrl = `${BASE_URL}${BASE_PATH}${
    years || sex || size || sort || dir
      ? '?' + new URLSearchParams(
          Object.fromEntries(
            Object.entries({ years, sex, size, sort, dir }).filter(([, v]) => v != null) as [string, string][]
          )
        ).toString()
      : ''
  }`

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <RankingJsonLd
        title={pageHeading}
        description={pageDescription ?? '賃金構造基本統計調査に基づく職種別年収増加率ランキング。'}
        url={jsonLdUrl}
        breadcrumbs={[
          { name: '年収ランキング', url: `${BASE_URL}/salary/ranking/occupation` },
          { name: '年収増加率ランキング', url: `${BASE_URL}${BASE_PATH}` },
        ]}
      />
      <Nav />
      <GrowthRankingClient
        initialYears={validYears}
        initialSex={sex}
        initialSize={size}
        initialSort={validSort}
        initialDir={validDir}
        pageHeading={pageHeading}
        pageDescription={pageDescription ?? undefined}
      />
    </div>
  )
}
