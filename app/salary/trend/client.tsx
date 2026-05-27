'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ---- カラーパレット ----
const C = {
  total:  '#1a73e8',
  male:   '#0891b2',
  female: '#e8336d',
  age:    ['#1a73e8','#0891b2','#16a34a','#f59e0b','#7c3aed','#e8336d','#d97706','#0ea5e9','#64748b','#dc2626','#2dd4bf','#a855f7'],
  size:   ['#1a73e8','#16a34a','#f59e0b','#e8336d'],
  edu:    ['#1a73e8','#0891b2','#16a34a','#f59e0b','#e8336d','#7c3aed'],
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

function fmtY(v: number) { return `${Math.round(v)}万` }

// 変化率バッジ
function GrowthBadge({ data, dataKey }: { data: Record<string, any>[]; dataKey: string }) {
  if (!data || data.length < 2) return null
  const first = data[0]?.[dataKey]
  const last  = data[data.length - 1]?.[dataKey]
  if (first == null || last == null) return null
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

// カスタムツールチップ
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.10)', fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6, fontSize: 13 }}>{label}年</p>
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stroke, flexShrink: 0 }} />
            <span style={{ color: '#475569', flex: 1 }}>{p.name}</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{Number(p.value).toFixed(1)}万円</span>
          </div>
        )
      ))}
    </div>
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
      <div className="px-4 pt-4 pb-2">{children}</div>
    </div>
  )
}

// 共通折れ線グラフ
function TrendLineChart({
  data, lines,
}: {
  data: Record<string, any>[]
  lines: { key: string; label: string; color: string }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="year" tickFormatter={v => `${v}年`} tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#64748b' }} width={54} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {lines.map(({ key, label, color }) => (
          <Line
            key={key} type="monotone" dataKey={key} name={label}
            stroke={color} strokeWidth={2.5}
            dot={{ r: 4, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// 差分インライン表示（セル内サブ行用）
function DiffLine({ val, base, label }: { val: number | null; base: number | null; label: string }) {
  if (val == null || base == null) return null
  const diff = val - base
  const pct  = (diff / base) * 100
  const zero = Math.abs(diff) < 0.05
  if (zero) return null
  const pos = diff > 0
  const color = pos ? '#16a34a' : '#dc2626'
  return (
    <div style={{ color, fontSize: 10, lineHeight: 1.3 }}>
      <span className="opacity-60 mr-0.5">{label}</span>
      {pos ? '+' : ''}{diff.toFixed(1)}万
      <span className="opacity-60 ml-0.5">({pos ? '+' : ''}{pct.toFixed(1)}%)</span>
    </div>
  )
}

// 年別データテーブル（セル内に前年比・乖離をサブ行として表示）
function YearTable({ data, columns, baseKey }: {
  data: Record<string, any>[]
  columns: { key: string; label: string; color: string }[]
  baseKey?: string
}) {
  const baseCol = baseKey ? columns.find(c => c.key === baseKey) : undefined

  return (
    <div className="overflow-x-auto mt-4 rounded-lg border border-gray-100">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left py-2.5 px-3 font-semibold text-gray-500 w-16">年</th>
            {columns.map(c => (
              <th key={c.key} className="text-right py-2.5 px-3 font-semibold whitespace-nowrap" style={{ color: c.color }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const prev = data[i - 1]
            return (
              <tr key={row.year} className="border-t border-gray-100 hover:bg-slate-50/60 transition-colors">
                <td className="py-2.5 px-3 font-bold text-gray-700 align-top">{row.year}年</td>
                {columns.map(c => {
                  const val  = row[c.key] ?? null
                  const prevVal = prev?.[c.key] ?? null
                  const baseVal = (baseKey && c.key !== baseKey) ? (row[baseKey] ?? null) : null
                  return (
                    <td key={c.key} className="text-right py-2 px-3 align-top">
                      {/* 実値 */}
                      <div className="font-semibold text-gray-800 tabular-nums">
                        {val != null ? `${Number(val).toFixed(1)}万円` : '−'}
                      </div>
                      {/* 前年比（2年目以降） */}
                      {i > 0 && (
                        <DiffLine val={val} base={prevVal} label="前年比" />
                      )}
                      {/* 基準との乖離 */}
                      {baseVal != null && c.key !== baseKey && (
                        <DiffLine val={val} base={baseVal} label={`vs ${baseCol?.label ?? baseKey}`} />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// KPIカード
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-[26px] font-bold leading-tight" style={{ color }}>{value}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  )
}

// 展開可能テーブル
function CollapsibleTable({ data, columns, baseKey }: {
  data: Record<string, any>[]
  columns: { key: string; label: string; color: string }[]
  baseKey?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="currentColor">
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        年別データ一覧
      </button>
      {open && <YearTable data={data} columns={columns} baseKey={baseKey} />}
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
      .catch(() => setData({ years: [], overall: [], ageGroups: [], byAge: [], sizes: [], bySize: [], educations: [], byEducation: [], error: 'データ取得��失敗しました' }))
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

  const latestYear   = data.years[data.years.length - 1]
  const latestTotal  = data.overall.find(r => r.year === latestYear)

  // 全体・男女別のテーブルデータ（先に定義）
  const overallCols = [
    { key: '男女計', label: '男女計', color: C.total },
    { key: '男性',   label: '男性',   color: C.male  },
    { key: '女性',   label: '女性',   color: C.female },
  ]
  const overallTableData = data.overall.map(r => ({
    year: r.year, '男女計': r.total, '男性': r.male, '女性': r.female,
  }))

  // 主要年齢帯に絞り込む
  const mainAges = ['20～24歳','25～29歳','30～34歳','35～39歳','40～44歳','45～49歳','50～54歳','55～59歳']
  const ageGroupsToShow = data.ageGroups.filter(ag => mainAges.includes(ag))

  // 年齢別テーブル: 全体平均（男女計）を基準列として追加
  const byAgeWithAvg = data.byAge.map(row => {
    const overallRow = overallTableData.find(r => r.year === row.year)
    return { ...row, '全体平均': overallRow?.['男女計'] ?? null }
  })

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold text-[#1a73e8] uppercase tracking-widest">賃金構造基本統計調査 {data.years[0]}〜{latestYear}年</p>
            <h1 className="text-2xl font-bold text-gray-900 text-balance">年収推移グラフ</h1>
            <p className="text-sm text-gray-500 mt-1">
              e-Statの賃金構造基本統計調査に基づく日本の年収トレンドデータです。全体・男女別・年齢階級別・企業規模別・学歴別の推移を可視化しています。
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <KpiCard
              label={`${latestYear}年 全体平均`}
              value={latestTotal?.total ? `${latestTotal.total.toFixed(1)}万円` : '−'}
              sub="男女計・企業規模計"
              color={C.total}
            />
            <KpiCard
              label={`${latestYear}年 男性平均`}
              value={latestTotal?.male ? `${latestTotal.male.toFixed(1)}万円` : '−'}
              sub="全年齢・企業規模計"
              color={C.male}
            />
            <KpiCard
              label={`${latestYear}年 女性平均`}
              value={latestTotal?.female ? `${latestTotal.female.toFixed(1)}万円` : '−'}
              sub="全年齢・企業規模計"
              color={C.female}
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

        {/* 1. 男女別年収推移（統合カード） */}
        <SectionCard
          title="全体・男女別の年収推移"
          badge={<GrowthBadge data={overallTableData} dataKey="男女計" />}
        >
          <TrendLineChart
            data={overallTableData}
            lines={[
              { key: '男女計', label: '男女計', color: C.total },
              { key: '男性',   label: '男性',   color: C.male  },
              { key: '女性',   label: '女性',   color: C.female },
            ]}
          />
          <CollapsibleTable data={overallTableData} columns={overallCols} baseKey="男女計" />
        </SectionCard>

        {/* 2. 年齢階級別の年収推移 */}
        <SectionCard title="年齢階級別の年収推移（男女計・企業規模計）">
          <TrendLineChart
            data={data.byAge}
            lines={ageGroupsToShow.map((ag, i) => ({
              key: ag, label: ag, color: C.age[i % C.age.length],
            }))}
          />
          <CollapsibleTable
            data={byAgeWithAvg}
            columns={[
              { key: '全体平均', label: '全体平均', color: '#94a3b8' },
              ...ageGroupsToShow.map((ag, i) => ({ key: ag, label: ag, color: C.age[i % C.age.length] })),
            ]}
            baseKey="全体平均"
          />
        </SectionCard>

        {/* 3. 企業規模別の年収推移 */}
        <SectionCard title="企業規模別の年収推移（男女計・全学歴）">
          <TrendLineChart
            data={data.bySize}
            lines={data.sizes.map((s, i) => ({
              key: s, label: s, color: C.size[i % C.size.length],
            }))}
          />
          <CollapsibleTable
            data={data.bySize}
            columns={data.sizes.map((s, i) => ({ key: s, label: s, color: C.size[i % C.size.length] }))}
            baseKey="企業規模計"
          />
        </SectionCard>

        {/* 4. 学歴別の年収推移 */}
        <SectionCard title="学歴別の年収推移（男女計・企業規模計）">
          <TrendLineChart
            data={data.byEducation}
            lines={data.educations.map((e, i) => ({
              key: e, label: e, color: C.edu[i % C.edu.length],
            }))}
          />
          <CollapsibleTable
            data={data.byEducation}
            columns={data.educations.map((e, i) => ({ key: e, label: e, color: C.edu[i % C.edu.length] }))}
            baseKey="学歴計"
          />
        </SectionCard>

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
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl h-80" />
        ))}
      </div>
    </main>
  )
}
