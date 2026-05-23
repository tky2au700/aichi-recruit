import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { IndustryDetailClient } from './client'
import { buildMetadata } from '@/lib/seo'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const industryName = decodeURIComponent(slug)
  // アルファベット記号を除いた表示名
  const displayName = industryName.replace(/^[A-ZＡ-Ｚ]\s*/, '').replace(/^\(民[＋+]公\)\s*[A-ZＡ-Ｚ]?\s*/, '(民+公) ')
  return buildMetadata({
    title:       `${displayName}の平均年収2025 | AIリクルート`,
    description: `${displayName}の平均年収・月給・賞与・残業時間を賃金構造基本統計調査（2025年）データで比較。性別・企業規模別・年齢階級別のデータも掲載。`,
    keywords:    [`${displayName} 年収`, `${displayName} 平均年収`, `${displayName} 給与`, '産業別 年収', '業界 年収'],
    path:        `/salary/industry/${slug}`,
  })
}

export default async function IndustryDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <IndustryDetailClient slug={slug} />
    </div>
  )
}
