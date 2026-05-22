import { Nav } from '@/components/nav'
import { GrowthRankingClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '年収増加率ランキング（5年間）2021-2025 | AIリクルート',
  description: '2021年→2025年で年収が最も伸びた職種ランキング。賃金構造基本統計調査の時系列データから5年間の年収成長率を算出・比較できます。',
  keywords: ['年収 増加', '年収 伸び率', '将来性 職種', '年収 上がる 仕事', '給与 成長率'],
  path: '/salary/ranking/growth',
})

export default function GrowthRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <GrowthRankingClient />
    </div>
  )
}
