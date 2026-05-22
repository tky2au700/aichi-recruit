import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { OvertimeWageRankingClient } from './client'
import { buildMetadata } from '@/lib/seo'
import { RankingJsonLd } from '@/components/json-ld'

const SORT_LABEL: Record<string, string> = {
  overtime_hours:  '残業時間',
  scheduled_hours: '実労働時間',
  total_hours:     '合計労働時間',
  annual_income:   '推定年収',
  hourly_wage:     '時給',
}
const SEX_LABEL: Record<string, string> = { male: '男性', female: '女性' }
const SIZE_PAGE_LABEL: Record<string, string> = {
  large: '大企業', medium: '中規模企業', small: '小規模企業',
}

type SortKey = 'overtime_hours' | 'scheduled_hours' | 'total_hours' | 'annual_income' | 'hourly_wage'
type SortDir = 'asc' | 'desc'

const BASE_URL  = 'https://ai-recruit.jp'
const BASE_PATH = '/salary/ranking/overtime-wage'

type SearchParams = Promise<{ sex?: string; size?: string; year?: string; sort?: string; dir?: string }>

export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const { sex, size, year, sort } = await searchParams

  const sortLabel     = sort ? (SORT_LABEL[sort] ?? '残業時間') : '残業時間'
  const sexLabel      = sex  ? (SEX_LABEL[sex]       ?? null) : null
  const sizePageLabel = size ? (SIZE_PAGE_LABEL[size] ?? null) : null
  const yearStr       = year ? `${year}年` : '最新'

  if (!sex && !size && !year && !sort) {
    return buildMetadata({
      title: '職種別残業時間・時給ランキング | AIリクルート',
      description: '賃金構造基本統計調査に基づく職種別の残業時間・時給換算ランキング。残業が多い職種・少ない職種、時給の高い職種を比較できます。',
      keywords: ['残業時間 職種', '時給 職種ランキング', '労働時間 職種', '残業 多い 職種', '時給換算 年収'],
      path: BASE_PATH,
    })
  }

  const baseTitle = `職種別平均${sortLabel}ランキング${yearStr}`
  let pageTitle: string
  if (sizePageLabel) {
    pageTitle = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageTitle = `${sexLabel}の${baseTitle}`
  } else {
    pageTitle = baseTitle
  }

  const filterDesc = [sizePageLabel, sexLabel].filter(Boolean).join('・')
  const description = `${yearStr}調査の賃金構造基本統計調査に基づく${filterDesc ? filterDesc + 'の' : ''}${sortLabel}ランキング。残業時間・時給・労働時間を職種ごとに比較できます。`

  const paramsStr = new URLSearchParams(
    Object.fromEntries(Object.entries({ sex, size, year, sort }).filter(([, v]) => v != null) as [string, string][])
  ).toString()

  return buildMetadata({
    title: `${pageTitle} | AIリクルート`,
    description,
    keywords: [
      `職種別${sortLabel}`, '残業時間ランキング', '時給ランキング',
      ...(sexLabel      ? [`${sexLabel} 残業時間`, `${sexLabel} 時給`]                     : []),
      ...(sizePageLabel ? [`${sizePageLabel} 残業時間`, `${sizePageLabel} 時給`]           : []),
      ...(year          ? [`${year}年 残業時間ランキング`, `${year}年 職種別労働時間`]      : []),
    ],
    path: paramsStr ? `${BASE_PATH}?${paramsStr}` : BASE_PATH,
  })
}

export default async function OvertimeWageRankingPage(
  { searchParams }: { searchParams: SearchParams }
) {
  const { sex, size, year, sort, dir } = await searchParams

  const sortLabel     = sort ? (SORT_LABEL[sort] ?? '残業時間') : '残業時間'
  const sexLabel      = sex  ? (SEX_LABEL[sex]       ?? null) : null
  const sizePageLabel = size ? (SIZE_PAGE_LABEL[size] ?? null) : null
  const yearStr       = year ? `${year}年` : '最新'
  const validSort     = (sort && sort in SORT_LABEL ? sort : 'overtime_hours') as SortKey
  const validDir      = (dir === 'asc' ? 'asc' : 'desc') as SortDir

  const baseTitle = `職種別平均${sortLabel}ランキング${yearStr}`
  let pageHeading: string
  if (sizePageLabel) {
    pageHeading = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageHeading = `${sexLabel}の${baseTitle}`
  } else if (sex || size || year || sort) {
    pageHeading = baseTitle
  } else {
    pageHeading = '職種別残業・時給ランキング'
  }

  const filterDesc = [sizePageLabel, sexLabel].filter(Boolean).join('・')
  const pageDescription = (sex || size || year || sort)
    ? `賃金構造基本統計調査に基づく${yearStr}${filterDesc ? filterDesc + 'の' : ''}${sortLabel}データです。`
    : null

  const jsonLdUrl = `${BASE_URL}${BASE_PATH}${
    sex || size || year || sort
      ? '?' + new URLSearchParams(
          Object.fromEntries(Object.entries({ sex, size, year, sort, dir }).filter(([, v]) => v != null) as [string, string][])
        ).toString()
      : ''
  }`

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <RankingJsonLd
        title={pageHeading}
        description={pageDescription ?? '賃金構造基本統計調査に基づく職種別残業時間・時給ランキング。'}
        url={jsonLdUrl}
        breadcrumbs={[
          { name: '職種別年収ランキング', url: `${BASE_URL}/salary/ranking/occupation` },
          { name: '残業・時給ランキング', url: `${BASE_URL}${BASE_PATH}` },
        ]}
      />
      <Nav />
      <OvertimeWageRankingClient
        initialSex={sex}
        initialSize={size}
        initialYear={year ? Number(year) : null}
        initialSort={validSort}
        initialDir={validDir}
        pageHeading={pageHeading}
        pageDescription={pageDescription ?? undefined}
      />
    </div>
  )
}
