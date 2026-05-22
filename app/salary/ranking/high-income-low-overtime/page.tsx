import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'

export const metadata = {
  title: '残業が少なくて年収が高い職種ランキング | AIリクルート',
  description: '月残業10時間以下で年収が高い職種ランキング。ワークライフバランスと収入を両立できる仕事を賃金構造基本統計調査のデータで確認できます。',
}

export default function HighIncomeLowOvertimePage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <RankingPageClient config={{
        type: 'high-income-low-overtime',
        title: '残業が少なくて年収が高い職種ランキング',
        description: '月残業10時間以下の職種に絞り、年収が高い順に表示しています。ワークライフバランスと収入を両立できる職種を確認できます。',
        sortKey: 'annual_income',
        sortLabel: '年収',
        primaryColor: '#0F9D58',
        primaryBg: '#E6F4EA',
      }} />
    </div>
  )
}
