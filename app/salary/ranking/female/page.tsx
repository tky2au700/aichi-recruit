import { Suspense } from 'react'
import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '女性の平均年収が高い職種ランキング2025 | AIリクルート',
  description: '2025年調査・女性労働者の平均年収が高い職種ランキング。賃金構造基本統計調査に基づく女性年収データを職種別に比較。男女格差の確認にも。',
  keywords: ['女性 年収', '女性 平均年収', '女性 年収ランキング', '女性 高収入', '男女格差'],
  path: '/salary/ranking/female',
})

export default function FemaleRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <Suspense>
        <RankingPageClient config={{
          type: 'female',
          title: '女性の年収が高い職種ランキング',
          description: '女性労働者の推定年収が高い職種を上位から表示しています。賃金構造基本統計調査に基づくデータです。',
          sortKey: 'annual_income',
          sortLabel: '女性年収',
          primaryColor: '#DB4437',
          primaryBg: '#FCECEA',
        }} />
      </Suspense>
    </div>
  )
}
