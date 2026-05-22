import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'

export const metadata = {
  title: '年間ボーナスが高い職種ランキング | AIリクルート',
  description: '賃金構造基本統計調査をもとにした年間賞与・特別給与額が高い職種ランキング。ボーナスの多い仕事を職種別に確認できます。',
}

export default function BonusRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <RankingPageClient config={{
        type: 'bonus',
        title: '年間ボーナスが高い職種ランキング',
        description: '年間賞与・特別給与額が高い職種を上位から表示しています。賃金構造基本統計調査に基づくデータです。',
        sortKey: 'annual_bonus',
        sortLabel: '年間賞与',
        primaryColor: '#F4B400',
        primaryBg: '#FFFBEB',
      }} />
    </div>
  )
}
