import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '労働者数が多くて年収が高い職種ランキング2025 | AIリクルート',
  description: '2025年調査・労働者数が多く年収も高い職種ランキング。就職・転職市場での需要と高収入を兼ね備えた職種を賃金構造基本統計調査データで確認できます。',
  keywords: ['労働者数 年収', '需要が高い 職種', '求人多い 高収入', '就職 有利 年収', '人気職種 年収ランキング'],
  path: '/salary/ranking/high-income-large-workforce',
})

export default function HighIncomeLargeWorkforcePage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <RankingPageClient config={{
        type: 'high-income-large-workforce',
        title: '労働者数が多くて年収が高い職種ランキング',
        description: '労働者数（市場規模）と年収の両方が高い職種を複合スコアで順位付けしています。需要と収入を兼ね備えた職種を確認できます。',
        sortKey: 'annual_income',
        sortLabel: '年収',
        primaryColor: '#7C3AED',
        primaryBg: '#F5F3FF',
      }} />
    </div>
  )
}
