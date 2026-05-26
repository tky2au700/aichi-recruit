import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { PrefectureDetailClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  let name: string
  try { name = decodeURIComponent(slug) } catch { name = slug }

  return buildMetadata({
    title: `${name}の平均年収 | 都道府県別年収ランキング | AIリクルート`,
    description: `${name}の平均年収・月給・賞与・残業時間を賃金構造基本統計調査データで解説。全国との比較や年度別推移もわかります。`,
    keywords: [`${name} 年収`, `${name} 平均年収`, '都道府県 年収', '地域別 賃金'],
    path: `/salary/prefecture/${slug}`,
  })
}

export default async function PrefectureDetailPage({ params }: Props) {
  const { slug } = await params
  let prefectureName: string
  try { prefectureName = decodeURIComponent(slug) } catch { prefectureName = slug }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <PrefectureDetailClient prefectureName={prefectureName} />
    </div>
  )
}
