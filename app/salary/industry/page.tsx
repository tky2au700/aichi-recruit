import { Nav } from '@/components/nav'
import { IndustryClient } from './client'

export const metadata = {
  title: '産業別年収ランキング | AIリクルート 年収DB',
  description: '賃金構造基本統計調査による産業別の平均年収ランキングと推移グラフ。IT・金融・製造・医療など業界ごとの賃金データ。',
}

export default function IndustryPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <IndustryClient />
    </div>
  )
}
