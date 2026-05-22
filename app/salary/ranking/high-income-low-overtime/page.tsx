import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '残業少なく年収が高い職種ランキング2025 | AIリクルート',
  description: '2025年調査・月残業10時間以下で年収が高い職種ランキング。ワークライフバランスと高収入を両立できる職種を賃金構造基本統計調査データで確認。',
  keywords: ['残業少ない 年収', 'ホワイト 高収入', 'ワークライフバランス 年収', '残業なし 高給', '定時 高収入'],
  path: '/salary/ranking/high-income-low-overtime',
})

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
