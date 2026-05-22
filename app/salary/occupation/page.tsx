import { Nav } from '@/components/nav'
import { OccupationClient } from './client'

export const metadata = {
  title: '職種別年収ランキング | AIリクルート 年収DB',
  description: '賃金構造基本統計調査による職種別の年収ランキング。医師・エンジニア・営業など職種ごとの賃金データ。',
}

export default function OccupationPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <OccupationClient />
    </div>
  )
}
