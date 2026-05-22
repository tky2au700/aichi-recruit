import { Nav } from '@/components/nav'
import { IndustryClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '産業別平均年収ランキング2025 | AIリクルート',
  description: '2025年調査・産業別の平均年収ランキングと推移グラフ。IT・金融・製造・医療・建設など業界ごとの年収を賃金構造基本統計調査データで比較できます。',
  keywords: ['産業別 年収', '業界別 年収', '業界 平均年収', 'IT 年収', '金融 年収', '製造業 年収', '医療 年収'],
  path: '/salary/industry',
})

export default function IndustryPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <IndustryClient />
    </div>
  )
}
