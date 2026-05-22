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
  large:  '1000人以上の企業',
  medium: '100〜999人の企業',
  small:  '10〜99人の企業',
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

  const sexLabel  = sex  ? SEX_LABEL[sex]   ?? null : null
  const sizeLabel = size ? SIZE_LABEL[size]  ?? null : null
  const yearLabel = year ? `${year}年`       : null

  const parts: string[] = []
  if (sexLabel)  parts.push(sexLabel)
  if (sizeLabel) parts.push(sizeLabel)

  const yearStr  = yearLabel ?? '最新'
  const filterStr = parts.length > 0 ? `・${parts.join('・')}` : ''

  const title       = `職種別平均年収ランキング${yearStr}${filterStr} | AIリクルート`
  const description = `${yearStr}調査・賃金構造基本統計調査に基づく職種別平均年収ランキング${filterStr}。年収・月給・賞与・残業時間などを職種ごとに比較できます。`

  const paramsStr   = new URLSearchParams(
    Object.fromEntries(Object.entries({ sex, size, year }).filter(([, v]) => v != null) as [string, string][])
  ).toString()
  const canonicalPath = paramsStr ? `${BASE_PATH}?${paramsStr}` : BASE_PATH

  return buildMetadata({
    title,
    description,
    keywords: [
      '職種別年収',
      ...(sexLabel  ? [`${sexLabel} 年収`, `${sexLabel} 職種ランキング`] : []),
      ...(sizeLabel ? [`${sizeLabel} 年収`]                               : []),
      ...(yearLabel ? [`${yearLabel} 年収ランキング`]                      : []),
    ],
    path: canonicalPath,
  })
}

export default async function OccupationRankingPage(
  { searchParams }: { searchParams: SearchParams }
) {
  const { sex, size, year } = await searchParams

  const sexLabel  = sex  ? SEX_LABEL[sex]   ?? null : null
  const sizeLabel = size ? SIZE_LABEL[size]  ?? null : null
  const yearStr   = year ? `${year}年`       : '2025年'
  const filterStr = [sexLabel, sizeLabel].filter(Boolean).join('・')

  const jsonLdTitle = `職種別平均年収ランキング${yearStr}${filterStr ? `・${filterStr}` : ''}`
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
      />
    </div>
  )
}
