'use client'

import { useEffect, useState } from 'react'
import { SalaryPageLayout } from '@/components/salary-page-layout'

interface AgeData {
  ageData: { name: string; annual: number | null }[]
  ranking: { name: string; annual: number | null }[]
  surveyYear: string
  source: string
  error?: string
}

export function AgeClient() {
  const [data, setData] = useState<AgeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/salary/age')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ageData: [], ranking: [], surveyYear: '', source: '', error: 'データ取得に失敗しました' }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  return (
    <SalaryPageLayout
      title="年齢・経験年数別年収"
      description="賃金構造基本統計調査に基づく年齢階級別の平均年収データです。年齢が上がるにつれて年収がどのように変化するかを確認できます。"
      ranking={data?.ranking ?? []}
      barData={data?.ageData}
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
