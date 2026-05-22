import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { OccupationRankingClient } from './client'
import { buildMetadata } from '@/lib/seo'
import { RankingJsonLd } from '@/components/json-ld'

// ---------------------------------------------------------------------------
// URLパラメーター → 日本語ラベルのマッピング
// ---------------------------------------------------------------------------
const SEX_LABEL: Record<string, string> = {
  male:   '男性',
  female: '女性',
}
const SIZE_LABEL: Record<string, string> = {
  large:  '大企業',
  medium: '中規模企業',
  small:  '小規模企業',
}
// SEOタイトル用（「〇〇の職種別平均年収ランキング」）
const SIZE_PAGE_LABEL: Record<string, string> = {
  large:  '大企業',
  medium: '中規模企業',
  small:  '小規模企業',
}

// ソートキー → 指標名（日本語）
const SORT_LABEL: Record<string, string> = {
  annual_income:  '年収',
  monthly_wage:   '月給',
  annual_bonus:   '賞与',
  age:            '平均年齢',
  tenure_years:   '勤続年数',
  overtime_hours: '残業時間',
  hourly_wage:    '時給',
}

const BASE_URL = 'https://ai-recruit.jp'
const BASE_PATH = '/salary/ranking/occupation'

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours' | 'hourly_wage'
type SortDir = 'asc' | 'desc'
type SearchParams = Promise<{ sex?: string; size?: string; year?: string; sort?: string; dir?: string }>

export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const { sex, size, year, sort } = await searchParams

  const sortLabel     = sort ? (SORT_LABEL[sort] ?? '年収') : '年収'

  // 何も選んでいない場合はデフォルト
  if (!sex && !size && !year && !sort) {
    return buildMetadata({
      title: '職種別平均年収ランキング2025 | AIリクルート',
      description: '2025年調査の賃金構造基本統計調査に基づく職種別平均年収ランキング。医師・弁護士・エンジニアなど145職種の年収を性別・企業規模別で比較できます。',
      keywords: ['職種別年収', '職種別ランキング', '職種 平均年収', '高収入 職種', '2025年 年収'],
      path: BASE_PATH,
    })
  }

  const sexLabel      = sex  ? SEX_LABEL[sex]       ?? null : null
  const sizePageLabel = size ? SIZE_PAGE_LABEL[size] ?? null : null
  const yearStr       = year ? `${year}年`           : '最新'

  // 「職種別平均〇〇ランキング」形式
  const baseTitle = `職種別平均${sortLabel}ランキング${yearStr}`
  let pageTitle: string
  if (sizePageLabel) {
    pageTitle = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageTitle = `${sexLabel}の${baseTitle}`
  } else {
    pageTitle = baseTitle
  }

  const sizeRange  = size === 'large' ? '1000人以上' : size === 'medium' ? '100〜999人' : size === 'small' ? '10〜99人' : null
  const filterDesc = [sizePageLabel ? `${sizePageLabel}（${sizeRange}）` : null, sexLabel].filter(Boolean).join('・')
  const description = `${yearStr}調査の賃金構造基本統計調査に基づく${filterDesc ? filterDesc + 'の' : ''}${baseTitle}。年収・月給・賞与・残業時間などを職種ごとに比較できます。`

  const paramsStr = new URLSearchParams(
    Object.fromEntries(Object.entries({ sex, size, year, sort }).filter(([, v]) => v != null) as [string, string][])
  ).toString()
  const canonicalPath = paramsStr ? `${BASE_PATH}?${paramsStr}` : BASE_PATH

  return buildMetadata({
    title: `${pageTitle} | AIリクルート`,
    description,
    keywords: [
      `職種別${sortLabel}`, '職種別ランキング',
      ...(sexLabel      ? [`${sexLabel} ${sortLabel}`, `${sexLabel} 職種ランキング`]           : []),
      ...(sizePageLabel ? [`${sizePageLabel} ${sortLabel}`, `${sizePageLabel} 職種別${sortLabel}`] : []),
      ...(year          ? [`${year}年 ${sortLabel}ランキング`, `${year}年 職種別平均${sortLabel}`]  : []),
    ],
    path: canonicalPath,
  })
}

export default async function OccupationRankingPage(
  { searchParams }: { searchParams: SearchParams }
) {
  const { sex, size, year, sort, dir } = await searchParams

  const sexLabel      = sex  ? SEX_LABEL[sex]       ?? null : null
  const sizePageLabel = size ? SIZE_PAGE_LABEL[size] ?? null : null
  const yearStr       = year ? `${year}年`           : '2025年'
  const sortLabel     = sort ? (SORT_LABEL[sort] ?? '年収') : '年収'
  const validSort     = (sort && sort in SORT_LABEL ? sort : 'annual_income') as SortKey
  const validDir      = (dir === 'asc' ? 'asc' : 'desc') as SortDir

  // ページ内見出し（h1）
  const baseTitle = `職種別平均${sortLabel}ランキング${yearStr}`
  let pageHeading: string
  if (sizePageLabel) {
    pageHeading = `${sizePageLabel}の${baseTitle}${sexLabel ? `・${sexLabel}` : ''}`
  } else if (sexLabel) {
    pageHeading = `${sexLabel}の${baseTitle}`
  } else if (sex || size || year || sort) {
    pageHeading = baseTitle
  } else {
    pageHeading = '職種別平均年収ランキング'
  }

  // ページ内解説文
  const sizeRange = size === 'large' ? '1000人以上' : size === 'medium' ? '100〜999人' : size === 'small' ? '10〜99人' : null
  const filterDesc = [sizePageLabel ? `${sizePageLabel}（${sizeRange}）` : null, sexLabel].filter(Boolean).join('・')
  const pageDescription = (sex || size || year || sort)
    ? `${yearStr}調査の賃金構造基本統計調査に基づく${filterDesc ? filterDesc + 'の' : ''}${baseTitle}データです。`
    : null

  const filterStr = [sexLabel, sizePageLabel].filter(Boolean).join('・')
  const jsonLdTitle = pageHeading
  const jsonLdDesc  = `${yearStr}調査・${filterStr ? filterStr + 'の' : ''}${baseTitle}。賃金構造基本統計調査データをもとに145職種の${sortLabel}を比較。`
  const jsonLdUrl   = `${BASE_URL}${BASE_PATH}${
    sex || size || year || sort
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries({ sex, size, year, sort, dir }).filter(([, v]) => v != null) as [string, string][])).toString()
      : ''
  }`

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <RankingJsonLd
        title={jsonLdTitle}
        description={jsonLdDesc}
        url={jsonLdUrl}
        breadcrumbs={[{ name: '職種別年収ランキング', url: `${BASE_URL}${BASE_PATH}` }]}
      />
      <Nav />
      <OccupationRankingClient
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
