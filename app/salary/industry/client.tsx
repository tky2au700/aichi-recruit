'use client'

import { useEffect, useState } from 'react'
import { SalaryPageLayout } from '@/components/salary-page-layout'

interface IndustryData {
  ranking: { name: string; annual: number | null }[]
  trend: { year: string; annual: number | null }[]
  surveyYear: string
  source: string
  error?: string
}

export function IndustryClient() {
  const [data, setData] = useState<IndustryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/salary/industry')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ranking: [], trend: [], surveyYear: '', source: '', error: 'データ取得に失敗しました' }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  return (
    <SalaryPageLayout
      title="産業別年収ランキング"
      description="賃金構造基本統計調査に基づく産業別の平均年収ランキングです。所定内給与額と年間賞与から推定年収を算出しています。"
      ranking={data?.ranking ?? []}
      trend={data?.trend}
      surveyYear={data?.surveyYear}
      source={data?.source}
      error={data?.error}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
      <div className="h-8 bg-muted rounded w-64 mb-3" />
      <div className="h-4 bg-muted rounded w-96 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 bg-card border border-border rounded-xl" />
        <div className="h-96 bg-card border border-border rounded-xl" />
      </div>
    </div>
  )
}
