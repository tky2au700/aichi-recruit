import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { RoleRankingClient } from './client'
import { buildMetadata } from '@/lib/seo'
import { RankingJsonLd } from '@/components/json-ld'

// ---------------------------------------------------------------------------
// URLパラメーター → 日本語ラベルのマッピング（occupation と同じ設計）
// ---------------------------------------------------------------------------
const SEX_LABEL: Record<string, string> = {
  male:   '男性',
  female: '女性',
}
const SIZE_LABEL: Record<string, string> = {
  large:  '大企業（1000人以上）',
  medium: '中規模企業（100〜999人）',
  small:  '小規模企業（10〜99人）',
}

const SORT_LABEL: Record<string, string> = {
  annual_income: '年収',
  monthly_wage:  '月給',
  annual_bonus:  '賞与',
}

const BASE_URL  = 'https://ai-recruit.jp'
const BASE_PATH = '/salary/ranking/role'

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus'
type SortDir = 'asc' | 'desc'
type SearchParams = Promise<{ sex?: string; size?: string; tenure?: string; year?: string; sort?: string; dir?: string }>

export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const { sex, size, year, sort } = await searchParams

  const sortLabel = sort ? (SORT_LABEL[sort] ?? '年収') : '年収'

  if (!sex && !size && !year && !sort) {
    return buildMetadata({
      title: '役職別平均年収ランキング2025 | AIリクルート',
      description: '2025年調査の賃金構造基本統計調査に基づく役職別平均年収ランキング。部長級・課長級・係長級など役職ごとの年収を性別・企業規模・勤続年数別で比較。',
      keywords: ['役職別年収', '役職別ランキング', '部長級 年収', '課長級 年収', '役職 平均年収', '2025年 年収'],
      path: BASE_PATH,
    })
  }

  const sexLabel      = sex  ? SEX_LABEL[sex]   ?? null : null
  const sizePageLabel = size ? SIZE_LABEL[size]  ?? null : null
  const yearStr       = year ? `${year}年`       : '最新'

  const baseTitle = `役職別平均${sortLabel}ランキング${yearStr}`
  let pageTitle: string
  if (sizePageLabel) {
    pageTitle = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageTitle = `${sexLabel}の${baseTitle}`
  } else {
    pageTitle = baseTitle
  }

  const filterDesc = [sizePageLabel, sexLabel].filter(Boolean).join('・')
  const description = `${yearStr}調査の賃金構造基本統計調査に基づく${filterDesc ? filterDesc + 'の' : ''}${baseTitle}。部長・課長・係長など役職ごとの年収・月給・賞与を比較できます。`

  const paramsStr = new URLSearchParams(
    Object.fromEntries(Object.entries({ sex, size, year, sort }).filter(([, v]) => v != null) as [string, string][])
  ).toString()
  const canonicalPath = paramsStr ? `${BASE_PATH}?${paramsStr}` : BASE_PATH

  return buildMetadata({
    title: `${pageTitle} | AIリクルート`,
    description,
    keywords: [
      `役職別${sortLabel}`, '役職別ランキング',
      ...(sexLabel      ? [`${sexLabel} 役職${sortLabel}`, `${sexLabel} 役職ランキング`]           : []),
      ...(sizePageLabel ? [`${sizePageLabel} ${sortLabel}`, `${sizePageLabel} 役職別${sortLabel}`] : []),
      ...(year          ? [`${year}年 ${sortLabel}ランキング`, `${year}年 役職別平均${sortLabel}`]  : []),
    ],
    path: canonicalPath,
  })
}

export default async function RoleRankingPage(
  { searchParams }: { searchParams: SearchParams }
) {
  const { sex, size, tenure, year, sort, dir } = await searchParams

  const sexLabel      = sex  ? SEX_LABEL[sex]  ?? null : null
  const sizePageLabel = size ? SIZE_LABEL[size] ?? null : null
  const yearStr       = year ? `${year}年`      : '2025年'
  const sortLabel     = sort ? (SORT_LABEL[sort] ?? '年収') : '年収'
  const validSort     = (sort && sort in SORT_LABEL ? sort : 'annual_income') as SortKey
  const validDir      = (dir === 'asc' ? 'asc' : 'desc') as SortDir

  const baseTitle = `役職別平均${sortLabel}ランキング${yearStr}`
  let pageHeading: string
  if (sizePageLabel) {
    pageHeading = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageHeading = `${sexLabel}の${baseTitle}`
  } else if (sex || size || year || sort) {
    pageHeading = baseTitle
  } else {
    pageHeading = '役職別平均年収ランキング'
  }

  const filterDesc = [sizePageLabel, sexLabel].filter(Boolean).join('・')
  const pageDescription = (sex || size || year || sort)
    ? `${yearStr}調査の賃金構造基本統計調査に基づく${filterDesc ? filterDesc + 'の' : ''}${baseTitle}データです。`
    : null

  const jsonLdUrl = `${BASE_URL}${BASE_PATH}${
    sex || size || year || sort
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries({ sex, size, year, sort, dir }).filter(([, v]) => v != null) as [string, string][])).toString()
      : ''
  }`

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <RankingJsonLd
        title={pageHeading}
        description={`${yearStr}調査・${filterDesc ? filterDesc + 'の' : ''}${baseTitle}。賃金構造基本統計調査データをもとに役職別の${sortLabel}を比較。`}
        url={jsonLdUrl}
        breadcrumbs={[{ name: '役職別年収ランキング', url: `${BASE_URL}${BASE_PATH}` }]}
      />
      <Nav />
      <RoleRankingClient
        initialSex={sex}
        initialSize={size}
        initialTenure={tenure ? decodeURIComponent(tenure) : undefined}
        initialYear={year ? Number(year) : null}
        initialSort={validSort}
        initialDir={validDir}
        pageHeading={pageHeading}
        pageDescription={pageDescription ?? undefined}
      />
    </div>
  )
}
