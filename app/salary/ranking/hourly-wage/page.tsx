import { Nav } from '@/components/nav'
import { RankingPageClient } from '@/components/ranking-page-client'

export const metadata = {
  title: '時給換算が高い職種ランキング | 年収DB',
  description: '月給を月160時間で割った時給換算額が高い職種ランキング。時間効率のよい仕事を職種別に確認できます。',
}

export default function HourlyWageRankingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <RankingPageClient config={{
        type: 'hourly-wage',
        title: '時給換算が高い職種ランキング',
        description: '月給÷160時間で算出した時給換算額が高い職種を上位から表示。賃金構造基本統計調査に基づくデータです。',
        sortKey: 'hourly_wage',
        sortLabel: '時給換算',
        primaryColor: '#0F9D58',
        primaryBg: '#E6F4EA',
      }} />
    </div>
  )
}
