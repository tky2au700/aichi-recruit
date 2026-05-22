import { Nav } from '@/components/nav'
import { PrefectureClient } from './client'

export const metadata = {
  title: '都道府県別年収ランキング | AIリクルート',
  description: '賃金構造基本統計調査による都道府県別の平均年収・初任給ランキング。地域ごとの賃金水準を比較できます。',
}

export default function PrefecturePage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <PrefectureClient />
    </div>
  )
}
