import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { TrendClient } from './client'

export const metadata: Metadata = {
  title: '年収推移グラフ | 日本の年収トレンド2021〜2025年',
  description: '賃金構造基本統計調査に基づく日本の年収推移グラフ。全体・男女別・年齢階級別・企業規模別・学歴別の年収トレンドを2021〜2025年のデータで可視化。',
  keywords: ['年収推移', '年収トレンド', '賃金推移', '平均年収推移', '年収グラフ'],
}

export default function TrendPage() {
  return (
    <>
      <Nav />
      <TrendClient />
    </>
  )
}
