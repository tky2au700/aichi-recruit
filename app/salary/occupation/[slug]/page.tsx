import { notFound } from 'next/navigation'
import { Nav } from '@/components/nav'
import { OccupationDetailClient } from './client'
import { query } from '@/lib/db'

interface Props {
  params: Promise<{ slug: string }>
}

// 静的パラメータ生成（ビルド時にすべての職種ページを生成）
export async function generateStaticParams() {
  try {
    const rows = await query(
      `SELECT DISTINCT occupation_slug FROM occupation_wages WHERE occupation_slug IS NOT NULL LIMIT 500`
    ) as Array<{ occupation_slug: string }>
    return rows.map(r => ({ slug: r.occupation_slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  try {
    const rows = await query(
      `SELECT occupation_name FROM occupation_wages WHERE occupation_slug = ? LIMIT 1`,
      [slug]
    ) as Array<{ occupation_name: string }>
    if (rows.length === 0) return { title: '職種が見つかりません' }
    const name = rows[0].occupation_name
    return {
      title: `${name}の平均年収・給与データ | 年収DB`,
      description: `${name}の平均年収・月給・賞与・時給・企業規模別データを賃金構造基本統計調査をもとに掲載。男女別・企業規模別の詳細データも確認できます。`,
    }
  } catch {
    return { title: '職種詳細 | 年収DB' }
  }
}

export default async function OccupationDetailPage({ params }: Props) {
  const { slug } = await params
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />
      <OccupationDetailClient slug={slug} />
    </div>
  )
}
