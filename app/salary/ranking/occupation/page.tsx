import { Nav } from '@/components/nav'
import { OccupationRankingClient } from './client'

export const metadata = {
  title: '職種別平均年収ランキング | 年収データベース',
  description: '賃金構造基本統計調査に基づく職種別の平均年収ランキング。性別・企業規模・調査年でフィルタリングできます。',
}

export default function OccupationRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <OccupationRankingClient />
    </div>
  )
}
