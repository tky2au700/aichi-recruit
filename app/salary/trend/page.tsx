import { Nav } from '@/components/nav'
import { TrendClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '年収推移グラフ2021〜2025年 | 日本の年収トレンド | AIリクルート',
  description: '賃金構造基本統計調査に基づく日本の年収推移グラフ。全体・男女別・年齢階級別・企業規模別・学歴別の年収トレンドを2021〜2025年の5年間データで可視化。',
  keywords: ['年収推移', '年収トレンド', '賃金推移', '平均年収推移', '年収グラフ', '年収変化'],
  path: '/salary/trend',
})

export default function TrendPage() {
  return (
    <>
      <Nav />
      <TrendClient />
    </>
  )
}
