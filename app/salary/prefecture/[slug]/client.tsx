'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, TrendingDown, Clock, Users, Award,
  BarChart2, MapPin, ArrowLeft, Info,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ---------- 型定義 ----------
interface DetailRow {
  sex: string
  age: number | null
  tenure_years: number | null
  scheduled_hours: number | null
  overtime_hours: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
  survey_year: number
}

interface TimePoint {
  survey_year: number
  sex: string
  annual_income: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  hourly_wage: number | null
  scheduled_hours: number | null
  overtime_hours: number | null
  workers: number | null
  age: number | null
  tenure_years: number | null
}

interface ApiResponse {
  success: boolean
  prefecture_name: string
  survey_group_name: string
  survey_table_name: string | null
  latest_year: number
  all_years: number[]
  latest_data: DetailRow[]
  time_series: TimePoint[]
  time_series_all: TimePoint[]
  national_data: DetailRow[] | null
  message?: string
}

// ---------- ユーティリティ ----------
function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v / 10).toLocaleString()}万円`
}
function fmtFixed(v: number | null, d = 1, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toFixed(d)}${suffix}`
}
function growthRate(latest: number | null, oldest: number | null): string {
  if (!latest || !oldest || oldest === 0) return '−'
  const rate = ((latest - oldest) / oldest) * 100
  const sign = rate >= 0 ? '+' : ''
  return `${sign}${rate.toFixed(1)}%`
}

const SEX_ORDER  = ['計', '男', '女']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#0ea5e9', '女': '#e8336d' }
const LINE_COLORS = ['#1a73e8', '#0ea5e9', '#e8336d']

// ---------- KpiCard ----------
function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: string
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {icon}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#0F172A', marginTop: 8, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// ---------- 推移グラフ ----------
const METRIC_TABS = [
  { key: 'annual_income',   label: '推定年収',      unit: '万円', divisor: 10 },
  { key: 'scheduled_wage',  label: '月給（所定内）',  unit: '万円', divisor: 10 },
  { key: 'annual_bonus',    label: '年間賞与',      unit: '万円', divisor: 10 },
  { key: 'work_hours',      label: '労働時間',      unit: 'h',    divisor: 1  },
  { key: 'workers',         label: '労働者数',      unit: '人',   divisor: 1  },
  { key: 'age',             label: '平均年齢',      unit: '歳',   divisor: 1  },
] as const
type MetricKey = typeof METRIC_TABS[number]['key']

function TrendChart({ timeSeriesAll, growthStr, growthPositive, oldestYear, latestYear }: {
  timeSeriesAll: TimePoint[]
  growthStr: string
  growthPositive: boolean
  oldestYear: number | undefined
  latestYear: number | undefined
}) {
  const [metric, setMetric] = useState<MetricKey>('annual_income')
  const metricDef = METRIC_TABS.find(m => m.key === metric)!
  const isWorkHours = metric === 'work_hours'

  const years = [...new Set(timeSeriesAll.map(t => t.survey_year))].sort((a, b) => a - b)

  const chartData = years.map(year => {
    const row: Record<string, number | string> = { year: `${year}年` }
    SEX_ORDER.forEach(sex => {
      const found = timeSeriesAll.find(t => t.survey_year === year && t.sex === sex)
      if (!found) return
      const label = SEX_LABEL[sex]
      if (isWorkHours) {
        const sh = found.scheduled_hours != null ? Math.round(Number(found.scheduled_hours) * 10) / 10 : null
        const oh = found.overtime_hours  != null ? Math.round(Number(found.overtime_hours)  * 10) / 10 : null
        if (sh != null) row[`所定内_${label}`] = sh
        if (oh != null) row[`残業_${label}`]   = oh
      } else if (metric === 'workers') {
        if (found.workers != null) row[label] = Number(found.workers)
      } else if (metric === 'age') {
        if (found.age != null) row[label] = Math.round(Number(found.age) * 10) / 10
      } else {
        const raw = (found as any)[metric]
        if (raw != null) row[label] = Math.round(Number(raw) / metricDef.divisor)
      }
    })
    return row
  })

  const formatTick = (v: number) => {
    if (metricDef.unit === '円')   return `${v.toLocaleString()}円`
    if (metricDef.unit === '万円') return `${v.toLocaleString()}万`
    if (metricDef.unit === 'h')    return `${v}h`
    if (metricDef.unit === '人')   return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `${v.toLocaleString()}`
    if (metricDef.unit === '歳')   return `${v}歳`
    return `${v}`
  }
  const formatTooltip = (v: number, name: string) => {
    if (metricDef.unit === '万円') return [`${v.toLocaleString()}万円`, name]
    if (metricDef.unit === 'h')    return [`${v}h`, name]
    if (metricDef.unit === '人')   return [`${v.toLocaleString()}人`, name]
    if (metricDef.unit === '歳')   return [`${v}歳`, name]
    return [`${v}`, name]
  }

  const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
      background: active ? '#fff' : 'transparent',
      color: active ? '#1a73e8' : '#64748B',
      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0 }}>
          推移グラフ
        </h2>
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
          <TabBtn active onClick={() => {}}>男女別</TabBtn>
        </div>
      </div>

      {/* 指標タブ */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {METRIC_TABS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: metric === m.key ? '1.5px solid #1a73e8' : '1.5px solid #E2E8F0',
            background: metric === m.key ? '#e8f0fe' : '#fff',
            color: metric === m.key ? '#1a73e8' : '#475569',
            transition: 'all 0.15s',
          }}>
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px 16px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap="20%" barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} width={60} />
            <Tooltip
              formatter={formatTooltip}
              labelStyle={{ fontSize: 12, color: '#0F172A', fontWeight: 700 }}
              contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {isWorkHours
              ? SEX_ORDER.flatMap((sex, idx) => [
                  <Bar key={`sh_${sex}`} dataKey={`所定内_${SEX_LABEL[sex]}`} fill={LINE_COLORS[idx]} stackId={SEX_LABEL[sex]} />,
                  <Bar key={`oh_${sex}`} dataKey={`残業_${SEX_LABEL[sex]}`}   fill={LINE_COLORS[idx] + '88'} stackId={SEX_LABEL[sex]} radius={[3, 3, 0, 0]} />,
                ])
              : SEX_ORDER.map((sex, idx) => (
                  <Bar key={sex} dataKey={SEX_LABEL[sex]} fill={LINE_COLORS[idx]} radius={[3, 3, 0, 0]} />
                ))
            }
          </BarChart>
        </ResponsiveContainer>

        {growthStr !== '−' && metric === 'annual_income' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748B' }}>
            <span>{oldestYear}年→{latestYear}年の変化（男女計）:</span>
            <strong style={{ color: growthPositive ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
              {growthPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {growthStr}
            </strong>
          </div>
        )}
        {isWorkHours && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#94A3B8' }}>
            ■ 濃色：所定内労働時間　■ 薄色：残業時間（単位：時間/月）
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- メインコンポーネント ----------
interface Props { prefectureName: string }

export function PrefectureDetailClient({ prefectureName }: Props) {
  const [data, setData]           = useState<ApiResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [kpiSexTab, setKpiSexTab] = useState('計')
  const [tableSex, setTableSex]   = useState('計')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/salary/prefecture/${encodeURIComponent(prefectureName)}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'エラーが発生しました'); return }
        setData(json)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [prefectureName])

  // --- ローディング ---
  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#1a73e8', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: '#94A3B8', fontSize: 14 }}>データを読み込んでいます...</p>
      </div>
    )
  }

  // --- エラー ---
  if (error || !data) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <Info size={40} color="#94A3B8" style={{ margin: '0 auto 16px', display: 'block' }} />
        <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          {error ?? 'データが見つかりません'}
        </p>
        <Link
          href="/salary/prefecture"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a73e8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        >
          <ArrowLeft size={15} />
          都道府県ランキングに戻る
        </Link>
      </div>
    )
  }

  // --- データ整形 ---
  const repFixed = data.latest_data.find(r => r.sex === '計') ?? data.latest_data[0]
  const rep      = data.latest_data.find(r => r.sex === kpiSexTab) ?? repFixed

  const tsAll    = data.time_series_all
  const oldest   = data.time_series[0]
  const latest   = data.time_series[data.time_series.length - 1]
  const growthStr      = growthRate(latest?.annual_income, oldest?.annual_income)
  const growthPositive = growthStr !== '−' && !growthStr.startsWith('-')

  const national = data.national_data?.find(r => r.sex === kpiSexTab) ?? data.national_data?.[0] ?? null

  return (
    <main style={{ background: '#F8FAFC', minHeight: '100vh' }}>

      {/* ---- ヒーローバナー ---- */}
      <div style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #ffffff 70%)', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>

          {/* パンくずリスト */}
          <nav aria-label="パンくずリスト" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '20px 0 0', fontSize: 12, color: '#64748B', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#1a73e8', textDecoration: 'none' }}>AIリクルート</Link>
            <ChevronRight size={12} />
            <Link href="/salary/prefecture" style={{ color: '#1a73e8', textDecoration: 'none' }}>都道府県別年収ランキング</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#94A3B8' }}>{data.prefecture_name}</span>
          </nav>

          {/* タイトル・バッジ */}
          <div style={{ padding: '24px 0 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, background: '#E8F0FE', color: '#1a73e8', padding: '3px 10px', borderRadius: 20, border: '1px solid #C5D8FC' }}>
                {data.latest_year}年調査
              </span>
              {growthStr !== '−' && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: growthPositive ? '#ECFDF5' : '#FEF2F2',
                  color: growthPositive ? '#16a34a' : '#dc2626',
                  padding: '3px 10px', borderRadius: 20,
                  border: `1px solid ${growthPositive ? '#BBF7D0' : '#FECACA'}`,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {growthPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {oldest?.survey_year}年比 {growthStr}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.25 }}>
              {data.prefecture_name}の平均年収
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              {data.survey_group_name} / {data.latest_year}年調査
              {repFixed?.annual_income != null && (
                <> — 推定年収 <strong style={{ color: '#1a73e8', fontSize: 15 }}>{fmtWan(repFixed.annual_income)}</strong>（男女計）</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ---- コンテンツ本体 ---- */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* KPI サマリー */}
        <section style={{ marginBottom: 36 }}>
          {/* 性別タブ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
              {SEX_ORDER.map(sex => (
                <button
                  key={sex}
                  onClick={() => setKpiSexTab(sex)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: kpiSexTab === sex ? '#fff' : 'transparent',
                    color: kpiSexTab === sex ? SEX_COLOR[sex] : '#64748B',
                    boxShadow: kpiSexTab === sex ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {SEX_LABEL[sex]}
                </button>
              ))}
            </div>
          </div>

          {/* KPI グリッド */}
          {rep && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <KpiCard
                icon={<Award size={13} color="#1a73e8" />}
                label="推定年収"
                value={fmtWan(rep.annual_income)}
                sub="男女計"
                accent="#1a73e8"
              />
              <KpiCard
                icon={<BarChart2 size={13} color="#0F9D58" />}
                label="月給（所定内）"
                value={fmtWan(rep.scheduled_wage)}
                sub="所定内給与額"
              />
              <KpiCard
                icon={<TrendingUp size={13} color="#F4B400" />}
                label="年間賞与"
                value={fmtWan(rep.annual_bonus)}
                sub="賞与・特別給与額"
              />
              <KpiCard
                icon={<Clock size={13} color="#0ea5e9" />}
                label="時給換算"
                value={rep.monthly_wage != null ? `${Math.round(rep.monthly_wage * 1000 / 160).toLocaleString()}円` : '−'}
                sub="月給 ÷ 160時間"
              />
              <KpiCard
                icon={<Users size={13} color="#7c3aed" />}
                label="平均年齢"
                value={fmtFixed(rep.age, 1, '歳')}
                sub={`勤続 ${fmtFixed(rep.tenure_years, 1, '年')}`}
              />
              <KpiCard
                icon={<Clock size={13} color={rep.overtime_hours != null && rep.overtime_hours > 20 ? '#dc2626' : '#94A3B8'} />}
                label="月残業時間"
                value={fmtFixed(rep.overtime_hours, 1, 'h')}
                sub={rep.overtime_hours != null && rep.overtime_hours > 20 ? '残業多め' : '標準的'}
                accent={rep.overtime_hours != null && rep.overtime_hours > 20 ? '#dc2626' : undefined}
              />
              <KpiCard
                icon={<Clock size={13} color="#0f766e" />}
                label="月実労働時間"
                value={fmtFixed(rep.scheduled_hours, 1, 'h')}
                sub="所定内労働時間"
              />
              <KpiCard
                icon={<Users size={13} color="#64748B" />}
                label="労働者数"
                value={rep.workers != null
                  ? rep.workers >= 10000 ? `${(rep.workers / 10000).toFixed(1)}万人` : `${rep.workers.toLocaleString()}人`
                  : '−'}
                sub="調査対象労働者数"
              />
            </div>
          )}
        </section>

        {/* ---- 推移グラフ ---- */}
        <TrendChart
          timeSeriesAll={tsAll}
          growthStr={growthStr}
          growthPositive={growthPositive}
          oldestYear={oldest?.survey_year}
          latestYear={latest?.survey_year}
        />

        {/* ---- 全国との比較 ---- */}
        {national && rep && (
          <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} color="#F4B400" />
              全国との比較（{SEX_LABEL[kpiSexTab]}・{data.latest_year}年）
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
              {[
                { label: '推定年収',      pref: rep.annual_income,   nat: national.annual_income,   fmt: fmtWan,                         lowerIsBetter: false },
                { label: '月給（所定内）', pref: rep.scheduled_wage,  nat: national.scheduled_wage,  fmt: fmtWan,                         lowerIsBetter: false },
                { label: '年間賞与',      pref: rep.annual_bonus,    nat: national.annual_bonus,    fmt: fmtWan,                         lowerIsBetter: false },
                { label: '月残業時間',    pref: rep.overtime_hours,  nat: national.overtime_hours,  fmt: (v: number | null) => fmtFixed(v, 1, 'h'), lowerIsBetter: true },
              ].map(({ label, pref, nat, fmt, lowerIsBetter }) => {
                const prefVal = pref != null ? Number(pref) : null
                const natVal  = nat  != null ? Number(nat)  : null
                const maxVal  = Math.max(prefVal ?? 0, natVal ?? 0) || 1
                const prefPct = prefVal != null ? (prefVal / maxVal) * 100 : 0
                const natPct  = natVal  != null ? (natVal  / maxVal) * 100 : 0
                const isGood  = lowerIsBetter ? (prefVal ?? 0) < (natVal ?? 0) : (prefVal ?? 0) > (natVal ?? 0)
                return (
                  <div key={label}>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>{label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, color: isGood ? '#1a73e8' : '#374151' }}>{data.prefecture_name}</span>
                          <span style={{ fontWeight: 600, color: isGood ? '#1a73e8' : '#374151' }}>{fmt(pref)}</span>
                        </div>
                        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${prefPct}%`, height: '100%', background: isGood ? '#1a73e8' : '#94A3B8', borderRadius: 4, transition: 'width .3s' }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#64748B' }}>全国平均</span>
                          <span style={{ color: '#64748B' }}>{fmt(nat)}</span>
                        </div>
                        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${natPct}%`, height: '100%', background: '#E2E8F0', borderRadius: 4 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- 年度別データテーブル ---- */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="#64748B" />
              年度別データ一覧
            </h2>
            {/* 性別タブ */}
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
              {SEX_ORDER.map(sex => (
                <button
                  key={sex}
                  onClick={() => setTableSex(sex)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: tableSex === sex ? '#fff' : 'transparent',
                    color: tableSex === sex ? SEX_COLOR[sex] : '#64748B',
                    boxShadow: tableSex === sex ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {SEX_LABEL[sex]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['調査年', '性別', '推定年収', '月給（所定内）', '年間賞与', '月残業時間', '月労働時間', '平均年齢', '労働者数'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tsAll
                  .filter(r => r.sex === tableSex)
                  .sort((a, b) => b.survey_year - a.survey_year)
                  .map((r, i) => (
                    <tr key={`${r.survey_year}-${r.sex}`} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{r.survey_year}年</td>
                      <td style={{ padding: '8px 12px', color: SEX_COLOR[r.sex] ?? '#374151', fontWeight: 500 }}>{SEX_LABEL[r.sex]}</td>
                      <td style={{ padding: '8px 12px', color: '#1a73e8', fontWeight: 600 }}>{fmtWan(r.annual_income)}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtWan(r.scheduled_wage)}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtWan(r.annual_bonus)}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtFixed(r.overtime_hours, 1, 'h')}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtFixed(r.scheduled_hours, 1, 'h')}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtFixed(r.age, 1, '歳')}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {r.workers != null
                          ? r.workers >= 10000 ? `${(r.workers / 10000).toFixed(1)}万人` : `${r.workers.toLocaleString()}人`
                          : '−'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 戻るボタン */}
        <div style={{ marginTop: 8 }}>
          <Link
            href="/salary/prefecture"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} />
            都道府県別ランキングに戻る
          </Link>
        </div>

      </div>
    </main>
  )
}
