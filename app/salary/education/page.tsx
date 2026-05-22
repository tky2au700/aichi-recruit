import { Nav } from '@/components/nav'
import { EducationClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '学歴別平均年収ランキング2025 | AIリクルート',
  description: '2025年調査・学歴別の平均年収ランキングと推移グラフ。大卒・高卒・院卒・高専卒の年収差を賃金構造基本統計調査データで比較。学歴による年収への影響を確認できます。',
  keywords: ['学歴 年収', '大卒 年収', '高卒 年収', '院卒 年収', '学歴 給与差', '最終学歴 年収'],
  path: '/salary/education',
})

export default function EducationPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <EducationClient />
    </div>
  )
}
