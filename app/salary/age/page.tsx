import { Nav } from '@/components/nav'
import { AgeClient } from './client'

export const metadata = {
  title: '年齢・経験年数別年収 | AIリクルート 年収DB',
  description: '賃金構造基本統計調査による年齢階級別・勤続年数別の平均年収データ。年収の変化を年齢・経験年数から確認できます。',
}

export default function AgePage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <AgeClient />
    </div>
  )
}
