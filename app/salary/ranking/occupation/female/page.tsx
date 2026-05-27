import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { OccupationRankingClient } from '../client'
import { buildMetadata } from '@/lib/seo'

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours' | 'hourly_wage'
type SortDir  = 'asc' | 'desc'
type SearchParams = Promise<{ size?: string; year?: string; sort?: string; dir?: string }>

const SORT_LABEL: Record<string, string> = {
  annual_income: '年収', monthly_wage: '月給', annual_bonus: '賞与',
  age: '平均年齢', tenure_years: '勤続年数', overtime_hours: '残業時間', hourly_wage: '時給',
}
const PARAM_TO_SIZE: Record<string, string> = {
  large: '1000人以上', medium: '100～999人', small: '10～99人',
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { year } = await searchParams
  const yearStr = year ? `${year}年` : '2025年'
  return buildMetadata({
    title: `女性の職種別平均年収ランキング${yearStr} | AIリクルート`,
    description: `${yearStr}調査の賃金構造基本統計調査に基づく女性の職種別平均年収ランキング。各職種の女性労働者の年収・月給・賞与・勤続年数を比較できます。`,
    keywords: ['女性 職種別年収', '女性 職種 年収ランキング', '女性労働者 職種別', '女性 職業別年収'],
    path: '/salary/ranking/occupation/female',
  })
}

export default async function OccupationFemaleRankingPage({ searchParams }: { searchParams: SearchParams }) {
  const { size, year, sort, dir } = await searchParams
  const validSort = (sort && sort in SORT_LABEL ? sort : 'annual_income') as SortKey
  const validDir  = (dir === 'asc' ? 'asc' : 'desc') as SortDir
  const yearStr   = year ? `${year}年` : '2025年'
  const sortLabel = SORT_LABEL[validSort] ?? '年収'
  const sizeLabel = size ? (PARAM_TO_SIZE[size] ?? null) : null
  const sizeLabelMap: Record<string, string> = { '1000人以上': '大企業', '100～999人': '中規模企業', '10～99人': '小規模企業' }
  const sizeName  = sizeLabel ? (sizeLabelMap[sizeLabel] ?? null) : null
  const pageHeading = sizeName
    ? `${sizeName}の女性職種別平均${sortLabel}ランキング${yearStr}`
    : `女性の職種別平均${sortLabel}ランキング${yearStr}`

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <OccupationRankingClient
        fixedSex="女"
        initialSize={size}
        initialYear={year ? Number(year) : null}
        initialSort={validSort}
        initialDir={validDir}
        pageHeading={pageHeading}
      />
    </div>
  )
}
