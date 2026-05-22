import { Suspense } from 'react'
import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '年間ボーナス・賞与が高い職種ランキング2025 | AIリクルート',
  description: '2025年調査・年間賞与・特別給与額が高い職種ランキング。賃金構造基本統計調査に基づき、ボーナスが多い職種を一覧で確認できます。',
  keywords: ['ボーナス 高い', '賞与 ランキング', '年間賞与', '特別給与', 'ボーナス 多い 職種'],
  path: '/salary/ranking/bonus',
})

export default function BonusRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <Suspense>
        <RankingPageClient config={{
          type: 'bonus',
          title: '年間ボーナスが高い職種ランキング',
          description: '年間賞与・特別給与額が高い職種を上位から表示しています。賃金構造基本統計調査に基づくデータです。',
          sortKey: 'annual_bonus',
          sortLabel: '年間賞与',
          primaryColor: '#F4B400',
          primaryBg: '#FFFBEB',
        }} />
      </Suspense>
    </div>
  )
}
