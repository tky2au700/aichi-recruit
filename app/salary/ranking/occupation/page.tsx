import { Nav } from '@/components/nav'
import { OccupationRankingClient } from './client'
import { buildMetadata } from '@/lib/seo'
import { RankingJsonLd } from '@/components/json-ld'

export const metadata = buildMetadata({
  title: '職種別平均年収ランキング2025 | AIリクルート',
  description: '2025年調査の賃金構造基本統計調査に基づく職種別平均年収ランキング。医師・弁護士・エンジニアなど145職種の年収を性別・企業規模別で比較できます。',
  keywords: ['職種別年収', '職種別ランキング', '職種 平均年収', '高収入 職種', '2025年 年収'],
  path: '/salary/ranking/occupation',
})

const BASE_URL = 'https://ai-recruit.jp'

export default function OccupationRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <RankingJsonLd
        title="職種別平均年収ランキング2025"
        description="2025年調査の賃金構造基本統計調査に基づく職種別平均年収ランキング。145職種の年収データを性別・企業規模別で比較できます。"
        url={`${BASE_URL}/salary/ranking/occupation`}
        breadcrumbs={[{ name: '職種別年収ランキング', url: `${BASE_URL}/salary/ranking/occupation` }]}
      />
      <Nav />
      <OccupationRankingClient />
    </div>
  )
}
