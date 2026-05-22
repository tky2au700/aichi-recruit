import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'

export const metadata = {
  title: '女性の平均年収が高い職種ランキング | AIリクルート',
  description: '賃金構造基本統計調査をもとにした女性の平均年収ランキング。職種ごとの女性年収データを一覧で確認できます。',
}

export default function FemaleRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <RankingPageClient config={{
        type: 'female',
        title: '女性の年収が高い職種ランキング',
        description: '女性労働者の推定年収が高い職種を上位から表示しています。賃金構造基本統計調査に基づくデータです。',
        sortKey: 'annual_income',
        sortLabel: '女性年収',
        primaryColor: '#DB4437',
        primaryBg: '#FCECEA',
      }} />
    </div>
  )
}
