'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ---- カラーパレット ----
const COLORS = {
  total:  '#1a73e8',
  male:   '#0891b2',
  female: '#e8336d',
  // 年齢階級別
  age: ['#1a73e8','#0891b2','#16a34a','#f59e0b','#7c3aed','#e8336d','#d97706','#0ea5e9','#64748b','#dc2626','#2dd4bf','#a855f7'],
  // 企業規模別
  size: ['#1a73e8','#16a34a','#f59e0b','#e8336d'],
  // 学歴別
  edu:  ['#1a73e8','#0891b2','#16a34a','#f59e0b','#e8336d','#7c3aed'],
}

interface TrendData {
  years: number[]
  overall: { year: number; total: number | null; male: number | null; female: number | null }[]
  ageGroups: string[]
  byAge: Record<string, any>[]
  sizes: string[]
  bySize: Record<string, any>[]
  educations: string[]
  byEducation: Record<string, any>[]
  error?: string
}

// 万円単位フォーマット
function fmtY(v: number) { return `${Math.round(v)}万` }
function fmtTip(v: number) { return `${v.toFixed(1)}万円` }

// 最新年からの変化率バッジ
function GrowthBadge({ data, key1, key2 }: { data: Record<string, any>[]; key1: string; key2?: string }) {
  const k = key2 ?? key1
  if (!data || data.length < 2) return null
  const first = data[0]?.[k]
  const last  = data[data.length - 1]?.[k]
  if (!first || !last) return null
  const pct = ((last - first) / first) * 100
  const pos = pct >= 0
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ml-2"
      style={{ background: pos ? '#dcfce7' : '#fee2e2', color: pos ? '#16a34a' : '#dc2626' }}
    >
      {pos ? <TrendingUp size={10} /> : pct === 0 ? <Minus size={10} /> : <TrendingDown size={10} />}
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// セクションカード
function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 pt-5 pb-3 border-b border-gray-100">
        <span className="text-[15px] font-bold text-gray-900">{title}</span>
        {badge}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

// 共通折れ線グラフ
function TrendLineChart({
  data, lines, colors, unit = '万円',
}: {
  data: Record<string, any>[]
  lines: { key: string; label: string; color: string }[]
  unit?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="year"
          tickFormatter={v => `${v}年`}
          tick={{ fontSize: 12, fill: '#64748b' }}
        />
        <YAxis
          tickFormatter={fmtY}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={54}
        />
        <Tooltip
          formatter={(v: any) => [fmtTip(Number(v)), '']}
          labelFormatter={l => `${l}年`}
          contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          labelStyle={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {lines.map(({ key, label, color }) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={label}
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 4, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// KPIカード
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-[26px] font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  )
}

export function TrendClient() {
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/salary/trend')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ years: [], overall: [], ageGroups: [], byAge: [], sizes: [], bySize: [], educations: [], byEducation: [], error: 'データ取得に失敗しました' }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500">
        {data?.error ?? 'データがありません'}
      </div>
    )
  }

  const latestYear  = data.years[data.years.length - 1]
  const latestTotal = data.overall.find(r => r.year === latestYear)
  const latestMale  = latestTotal?.male
  const latestFemale = latestTotal?.female

  // 年齢別: 主要年齢帯のみ表示（絞り込み）
  const mainAgeGroups = ['20～24歳','25～29歳','30～34歳','35～39歳','40～44歳','45～49歳','50～54歳','55～59歳']
  const ageGroupsToShow = data.ageGroups.filter(ag => mainAgeGroups.includes(ag))

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold text-[#1a73e8] uppercase tracking-widest">賃金構造基本統計調査 2021〜2025年</p>
            <h1 className="text-2xl font-bold text-gray-900 text-balance">年収推移グラフ</h1>
            <p className="text-sm text-gray-500 mt-1">
              e-Statの賃金構造基本統計調査に基づく日本の年収トレンドデータです。全体・男女別・年齢階級別・企業規模別・学歴別の推移を可視化しています。
            </p>
          </div>
          {/* KPIカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <KpiCard
              label={`${latestYear}年 全体平均`}
              value={latestTotal?.total ? `${latestTotal.total.toFixed(1)}万円` : '−'}
              sub="男女計・企業規模計"
              color="#1a73e8"
            />
            <KpiCard
              label={`${latestYear}年 男性平均`}
              value={latestMale ? `${latestMale.toFixed(1)}万円` : '−'}
              sub="全年齢・企業規模計"
              color="#0891b2"
            />
            <KpiCard
              label={`${latestYear}年 女性平均`}
              value={latestFemale ? `${latestFemale.toFixed(1)}万円` : '−'}
              sub="全年齢・企業規模計"
              color="#e8336d"
            />
            <KpiCard
              label="調査対象期間"
              value={`${data.years[0]}〜${latestYear}年`}
              sub={`${data.years.length}年分のデータ`}
              color="#16a34a"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8 flex flex-col gap-6">

        {/* 1. 全体の年収推移 */}
        <SectionCard
          title="全体の年収推移"
          badge={<GrowthBadge data={data.overall} key1="total" />}
        >
          <TrendLineChart
            data={data.overall.map(r => ({ year: r.year, '男女計': r.total }))}
            lines={[{ key: '男女計', label: '男女計', color: COLORS.total }]}
          />
        </SectionCard>

        {/* 2. 男性・女性の年収推移 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard
            title="男性の年収推移"
            badge={<GrowthBadge data={data.overall} key1="male" />}
          >
            <TrendLineChart
              data={data.overall.map(r => ({ year: r.year, '男性': r.male }))}
              lines={[{ key: '男性', label: '男性', color: COLORS.male }]}
            />
          </SectionCard>
          <SectionCard
            title="女性の年収推移"
            badge={<GrowthBadge data={data.overall} key1="female" />}
          >
            <TrendLineChart
              data={data.overall.map(r => ({ year: r.year, '女性': r.female }))}
              lines={[{ key: '女性', label: '女性', color: COLORS.female }]}
            />
          </SectionCard>
        </div>

        {/* 3. 男女比較（同グラフ） */}
        <SectionCard title="男女別年収推移の比較">
          <TrendLineChart
            data={data.overall.map(r => ({ year: r.year, '男性': r.male, '女性': r.female, '男女計': r.total }))}
            lines={[
              { key: '男女計', label: '男女計', color: COLORS.total },
              { key: '男性',   label: '男性',   color: COLORS.male },
              { key: '女性',   label: '女性',   color: COLORS.female },
            ]}
          />
        </SectionCard>

        {/* 4. 年齢階級別の年収推移 */}
        <SectionCard title="年齢階級別の年収推移">
          <p className="text-[12px] text-gray-400 mb-3">20〜59歳の主要年齢帯（男女計・企業規模計）</p>
          <TrendLineChart
            data={data.byAge}
            lines={ageGroupsToShow.map((ag, i) => ({
              key: ag,
              label: ag,
              color: COLORS.age[i % COLORS.age.length],
            }))}
          />
        </SectionCard>

        {/* 5. 企業規模別の年収推移 */}
        <SectionCard title="企業規模別の年収推移">
          <p className="text-[12px] text-gray-400 mb-3">男女計・全学歴</p>
          <TrendLineChart
            data={data.bySize}
            lines={data.sizes.map((s, i) => ({
              key: s,
              label: s,
              color: COLORS.size[i % COLORS.size.length],
            }))}
          />
        </SectionCard>

        {/* 6. 学歴別の年収推移 */}
        <SectionCard title="学歴別の年収推移">
          <p className="text-[12px] text-gray-400 mb-3">男女計・企業規模計</p>
          <TrendLineChart
            data={data.byEducation}
            lines={data.educations.map((e, i) => ({
              key: e,
              label: e,
              color: COLORS.edu[i % COLORS.edu.length],
            }))}
          />
        </SectionCard>

        {/* フッター注記 */}
        <p className="text-[11px] text-gray-400 text-center pb-4">
          出典: 厚生労働省「賃金構造基本統計調査」（e-Stat）　単位: 万円　推定年収 = 月給 × 12 + 年間賞与
        </p>
      </div>
    </main>
  )
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-8 bg-gray-200 rounded w-64 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-full max-w-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-24" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8 flex flex-col gap-6 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl h-80" />
        ))}
      </div>
    </main>
  )
}
