import { Suspense } from 'react'
import { RoleDetailClient } from './client'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const roleName = decodeURIComponent(slug)
  return {
    title: `${roleName}の年収・給与データ | 賃金構造基本統計調査`,
    description: `${roleName}の年収・月給・賞与・勤続年数別給与推移を企業規模・性別で詳細比較。厚生労働省 賃金構造基本統計調査データ。`,
  }
}

export default async function RoleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>読み込み中...</div>}>
      <RoleDetailClient slug={slug} />
    </Suspense>
  )
}
