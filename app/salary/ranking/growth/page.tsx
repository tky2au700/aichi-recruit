import { Nav } from '@/components/nav'
import { GrowthRankingClient } from './client'

export const metadata = {
  title: '年収増加率ランキング（5年間） | 年収DB',
  description: '過去5年間で年収が最も伸びた職種ランキング。賃金構造基本統計調査の時系列データをもとに年収成長率を算出しています。',
}

export default function GrowthRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <GrowthRankingClient />
    </div>
  )
}
