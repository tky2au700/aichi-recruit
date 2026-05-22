import { Suspense } from 'react'
import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '時給換算が高い職種ランキング2025 | AIリクルート',
  description: '2025年調査・月給÷160時間で算出した時給換算額が高い職種ランキング。時間あたりの収入が高い職種を賃金構造基本統計調査データで確認できます。',
  keywords: ['時給 高い', '時給換算 職種', '時給 ランキング', '高時給 仕事', '時間効率 年収'],
  path: '/salary/ranking/hourly-wage',
})

export default function HourlyWageRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <Suspense>
        <RankingPageClient config={{
          type: 'hourly-wage',
          title: '時給換算が高い職種ランキング',
          description: '月給÷160時間で算出した時給換算額が高い職種を上位から表示。賃金構造基本統計調査に基づくデータです。',
          sortKey: 'hourly_wage',
          sortLabel: '時給換算',
          primaryColor: '#0F9D58',
          primaryBg: '#E6F4EA',
        }} />
      </Suspense>
    </div>
  )
}
