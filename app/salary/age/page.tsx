import { Nav } from '@/components/nav'
import { AgeClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: '年齢・勤続年数別平均年収2025 | AIリクルート',
  description: '2025年調査・年齢階級別・勤続年数別の平均年収データ。20代〜60代の年収推移と、経験年数による給与の伸びを賃金構造基本統計調査データで確認できます。',
  keywords: ['年齢別 年収', '勤続年数 年収', '20代 年収', '30代 年収', '40代 年収', '年収 推移'],
  path: '/salary/age',
})

export default function AgePage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <AgeClient />
    </div>
  )
}
