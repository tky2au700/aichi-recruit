import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { IndustryRankingClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title:       '産業別平均年収ランキング2025 | AIリクルート',
  description: '2025年調査・賃金構造基本統計調査に基づく産業別平均年収ランキング。製造業・IT・金融・医療・建設など20産業の年収・月給・賞与・残業時間を性別・企業規模・学歴別で比較できます。',
  keywords:    ['産業別年収ランキング', '業界別平均年収', '産業別 年収 2025', '製造業 年収', '金融業 年収', 'IT 年収', '医療 年収'],
  path:        '/salary/ranking/industry',
})

export default function IndustryRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <IndustryRankingClient />
    </div>
  )
}
