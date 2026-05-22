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

const BASE_URL = 'https://ai-recruit.jp'
const BASE_PATH = '/salary/ranking/occupation'

type SearchParams = Promise<{ sex?: string; size?: string; year?: string }>

export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const { sex, size, year } = await searchParams

  // 何も選んでいない場合はデフォルト
  if (!sex && !size && !year) {
    return buildMetadata({
      title: '職種別平均年収ランキング2025 | AIリクルート',
      description: '2025年調査の賃金構造基本統計調査に基づく職種別平均年収ランキング。医師・弁護士・エンジニアなど145職種の年収を性別・企業規模別で比較できます。',
      keywords: ['職種別年収', '職種別ランキング', '職種 平均年収', '高収入 職種', '2025年 年収'],
      path: BASE_PATH,
    })
  }

  const sexLabel      = sex  ? SEX_LABEL[sex]           ?? null : null
  const sizeLabel     = size ? SIZE_LABEL[size]          ?? null : null
  const sizePageLabel = size ? SIZE_PAGE_LABEL[size]     ?? null : null
  const yearStr       = year ? `${year}年`               : '最新'

  // タイトル例：
  //   小規模企業の職種別平均年収ランキング2025年・男性
  //   男性の職種別平均年収ランキング2025年
  //   職種別平均年収ランキング2025年・男性（企業規模なし）
  let pageTitle: string
  if (sizePageLabel) {
    // 企業規模あり → 「〇〇の職種別平均年収ランキング」形式
    const sexSuffix = sexLabel ? `・${sexLabel}` : ''
    pageTitle = `${sizePageLabel}の職種別平均年収ランキング${yearStr}${sexSuffix}`
  } else if (sexLabel) {
    // 性別のみ
    pageTitle = `${sexLabel}の職種別平均年収ランキング${yearStr}`
  } else {
    // 調査年のみ
    pageTitle = `職種別平均年収ランキング${yearStr}`
  }

  const filterDesc = [sizePageLabel ? `${sizePageLabel}（${size === 'large' ? '1000人以上' : size === 'medium' ? '100〜999人' : '10〜99人'}）` : null, sexLabel].filter(Boolean).join('・')
  const description = `${yearStr}調査の賃金構造基本統計調査に基づく${filterDesc ? filterDesc + 'の' : ''}職種別平均年収ランキング。年収・月給・賞与・残業時間などを職種ごとに比較できます。`

  const paramsStr = new URLSearchParams(
    Object.fromEntries(Object.entries({ sex, size, year }).filter(([, v]) => v != null) as [string, string][])
  ).toString()
  const canonicalPath = paramsStr ? `${BASE_PATH}?${paramsStr}` : BASE_PATH

  return buildMetadata({
    title: `${pageTitle} | AIリクルート`,
    description,
    keywords: [
      '職種別年収', '職種別ランキング',
      ...(sexLabel      ? [`${sexLabel} 年収`, `${sexLabel} 職種ランキング`]           : []),
      ...(sizePageLabel ? [`${sizePageLabel} 年収`, `${sizePageLabel} 職種別年収`]     : []),
      ...(year          ? [`${year}年 年収ランキング`, `${year}年 職種別平均年収`]      : []),
    ],
    path: canonicalPath,
  })
}

export default async function OccupationRankingPage(
  { searchParams }: { searchParams: SearchParams }
) {
  const { sex, size, year } = await searchParams

  const sexLabel      = sex  ? SEX_LABEL[sex]       ?? null : null
  const sizePageLabel = size ? SIZE_PAGE_LABEL[size] ?? null : null
  const yearStr       = year ? `${year}年`           : '2025年'

  // ページ内見出し（h1）
  let pageHeading: string
  if (sizePageLabel) {
    const sexSuffix = sexLabel ? `・${sexLabel}` : ''
    pageHeading = `${sizePageLabel}の職種別平均年収ランキング${yearStr}${sexSuffix}`
  } else if (sexLabel) {
    pageHeading = `${sexLabel}の職種別平均年収ランキング${yearStr}`
  } else if (year) {
    pageHeading = `職種別平均年収ランキング${yearStr}`
  } else {
    pageHeading = '職種別平均年収ランキング'
  }

  // ページ内解説文
  const sizeRange = size === 'large' ? '1000人以上' : size === 'medium' ? '100〜999人' : size === 'small' ? '10〜99人' : null
  const filterDesc = [sizePageLabel ? `${sizePageLabel}（${sizeRange}）` : null, sexLabel].filter(Boolean).join('・')
  const pageDescription = (sex || size || year)
    ? `${yearStr}調査の賃金構造基本統計調査に基づく${filterDesc ? filterDesc + 'の' : ''}職種別平均年収データです。`
    : null  // デフォルト時はクライアント側の動的解説を使用

  const filterStr = [sexLabel, sizePageLabel].filter(Boolean).join('・')
  const jsonLdTitle = pageHeading
  const jsonLdDesc  = `${yearStr}調査・${filterStr ? filterStr + 'の' : ''}職種別平均年収ランキング。賃金構造基本統計調査データをもとに145職種の年収を比較。`
  const jsonLdUrl   = `${BASE_URL}${BASE_PATH}${
    sex || size || year
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries({ sex, size, year }).filter(([, v]) => v != null) as [string, string][])).toString()
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
        pageHeading={pageHeading}
        pageDescription={pageDescription ?? undefined}
      />
    </div>
  )
}
