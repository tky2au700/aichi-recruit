import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'

export const metadata = {
  title: '男性の平均年収が高い職種ランキング | 年収DB',
  description: '賃金構造基本統計調査をもとにした男性の平均年収ランキング。職種ごとの男性年収データを一覧で確認できます。',
}

export default function MaleRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <RankingPageClient config={{
        type: 'male',
        title: '男性の年収が高い職種ランキング',
        description: '男性労働者の推定年収が高い職種を上位から表示しています。賃金構造基本統計調査に基づくデータです。',
        sortKey: 'annual_income',
        sortLabel: '男性年収',
        primaryColor: '#1a73e8',
        primaryBg: '#EBF3FE',
      }} />
    </div>
  )
}
