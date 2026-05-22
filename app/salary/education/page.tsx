import { Nav } from '@/components/nav'
import { EducationClient } from './client'

export const metadata = {
  title: '学歴別年収ランキング | AIリクルート',
  description: '賃金構造基本統計調査による労働者種類別・学歴別の平均年収ランキングと推移グラフ。',
}

export default function EducationPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <EducationClient />
    </div>
  )
}
