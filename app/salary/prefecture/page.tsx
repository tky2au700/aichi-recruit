import { Nav } from '@/components/nav'
import { PrefectureClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: '都道府県別平均年収ランキング2025 | AIリクルート',
  description: '2025年調査・都道府県別の平均年収ランキング。東京・大阪・愛知など47都道府県の賃金水準を賃金構造基本統計調査データで比較。転職・地方移住の参考に。',
  keywords: ['都道府県 年収', '地域別 年収', '東京 年収', '地方 年収', '転職 年収', '地域格差 賃金'],
  path: '/salary/prefecture',
})

export default function PrefecturePage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <PrefectureClient />
    </div>
  )
}
