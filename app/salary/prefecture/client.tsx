'use client'

import { useEffect, useState } from 'react'
import { SalaryPageLayout } from '@/components/salary-page-layout'

interface PrefectureData {
  ranking: { name: string; annual: number | null }[]
  surveyYear: string
  source: string
  note?: string
  error?: string
}

export function PrefectureClient() {
  const [data, setData] = useState<PrefectureData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/salary/prefecture')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ranking: [], surveyYear: '', source: '', error: 'データ取得に失敗しました' }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  return (
    <>
      <SalaryPageLayout
        title="都道府県別年収ランキング"
        description="賃金構造基本統計調査（新規学卒者・初任給）に基づく都道府県別のランキングです。大学卒の初任給 × 12ヶ月で年収を概算しています。"
        ranking={data?.ranking ?? []}
        surveyYear={data?.surveyYear}
        source={data?.source}
        error={data?.error}
      />
      {data?.note && (
        <p className="mx-auto max-w-7xl px-4 pb-4 text-xs text-muted-foreground">{data.note}</p>
      )}
    </>
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
