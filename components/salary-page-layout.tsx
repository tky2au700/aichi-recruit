'use client'

import { useState } from 'react'
import { RankingBarChart, SalaryBarChart, SalaryTrendChart } from './salary-chart'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface RankingItem {
  name: string
  annual: number | null
}

interface TrendItem {
  year: string
  annual: number | null
}

interface BarItem {
  name: string
  annual: number | null
  [key: string]: any
}

interface SalaryPageLayoutProps {
  title: string
  description: string
  ranking: RankingItem[]
  trend?: TrendItem[]
  barData?: BarItem[]
  surveyYear?: string
  source?: string
  error?: string
}

export function SalaryPageLayout({
  title,
  description,
  ranking,
  trend,
  barData,
  surveyYear,
  source,
  error,
}: SalaryPageLayoutProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          再読み込み
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* ページヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground text-balance">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
        {surveyYear && (
          <p className="text-xs text-muted-foreground mt-1">
            調査年: {surveyYear} ／ 出典: {source ?? '賃金構造基本統計調査（e-Stat）'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ランキング */}
        <div className="bg-card border border-border rounded-xl p-6">
          <RankingBarChart data={ranking} title="年収ランキング（推定年収・万円）" />
        </div>

        {/* グラフ */}
        <div className="flex flex-col gap-6">
          {trend && trend.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">年収推移（産業計・万円）</h3>
              <SalaryTrendChart data={trend} />
            </div>
          )}
          {barData && barData.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">年収分布（万円）</h3>
              <SalaryBarChart data={barData} />
            </div>
          )}
        </div>
      </div>

      {/* データ注記 */}
      <p className="mt-6 text-xs text-muted-foreground">
        ※ 年収 = 所定内給与額 × 12 + 年間賞与その他特別給与額。単位は千円から万円に換算。男女計の値を表示しています。
      </p>
    </div>
  )
}
