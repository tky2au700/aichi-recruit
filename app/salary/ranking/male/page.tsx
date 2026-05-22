import { Suspense } from 'react'
import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '男性の平均年収が高い職種ランキング2025 | AIリクルート',
  description: '2025年調査・男性労働者の平均年収が高い職種ランキング。賃金構造基本統計調査に基づく男性年収データを職種別に比較できます。',
  keywords: ['男性 年収', '男性 平均年収', '男性 年収ランキング', '男性 高収入'],
  path: '/salary/ranking/male',
})

export default function MaleRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <Suspense>
        <RankingPageClient config={{
          type: 'male',
          title: '男性の年収が高い職種ランキング',
          description: '男性労働者の推定年収が高い職種を上位から表示しています。賃金構造基本統計調査に基づくデータです。',
          sortKey: 'annual_income',
          sortLabel: '男性年収',
          primaryColor: '#1a73e8',
          primaryBg: '#EBF3FE',
        }} />
      </Suspense>
    </div>
  )
}
