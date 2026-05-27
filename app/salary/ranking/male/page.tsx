import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { GenderRankingClient } from '../gender/client'
import { buildMetadata } from '@/lib/seo'

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours' | 'hourly_wage'
type SortDir  = 'asc' | 'desc'
type SearchParams = Promise<{ size?: string; year?: string; sort?: string; dir?: string }>

const SORT_LABEL: Record<string, string> = {
  annual_income: '年収', monthly_wage: '月給', annual_bonus: '賞与',
  age: '平均年齢', tenure_years: '勤続年数', overtime_hours: '残業時間', hourly_wage: '時給',
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { year } = await searchParams
  const yearStr = year ? `${year}年` : '2025年'
  return buildMetadata({
    title: `男性の年齢階級別平均年収ランキング${yearStr} | AIリクルート`,
    description: `${yearStr}調査の賃金構造基本統計調査に基づく男性の年齢階級別平均年収ランキング。10代から70代以上まで男性の年収・月給・賞与・勤続年数を年齢帯ごとに比較できます。`,
    keywords: ['男性 年収', '男性 年齢別年収', '男性 平均年収ランキング', '男性労働者 年収'],
    path: '/salary/ranking/male',
  })
}

export default async function MaleRankingPage({ searchParams }: { searchParams: SearchParams }) {
  const { size, year, sort, dir } = await searchParams
  const PARAM_TO_SIZE: Record<string, string> = { large: '1,000人以上', medium: '100～999人', small: '10～99人' }
  const sizeLabelMap: Record<string, string> = { '1,000人以上': '大企業', '100～999人': '中規模企業', '10～99人': '小規模企業' }
  const validSort = (sort && sort in SORT_LABEL ? sort : 'annual_income') as SortKey
  const validDir  = (dir === 'asc' ? 'asc' : 'desc') as SortDir
  const yearStr   = year ? `${year}年` : '2025年'
  const sortLabel = SORT_LABEL[validSort] ?? '年収'
  const sizeLabel = size ? (PARAM_TO_SIZE[size] ?? null) : null
  const sizeName  = sizeLabel ? (sizeLabelMap[sizeLabel] ?? null) : null
  const pageHeading = sizeName
    ? `${sizeName}の男性年齢階級別平均${sortLabel}ランキング${yearStr}`
    : `男性の年齢階級別平均${sortLabel}ランキング${yearStr}`

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <GenderRankingClient
        fixedSex="男"
        initialSize={size}
        initialYear={year ? Number(year) : null}
        initialSort={validSort}
        initialDir={validDir}
        pageHeading={pageHeading}
      />
    </div>
  )
}
