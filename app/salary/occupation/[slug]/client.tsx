'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, Clock, Users, Award,
  BarChart2, ArrowLeft, TrendingDown, Building2,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ---------- 型定義 ----------
interface DetailRow {
  sex: string
  enterprise_size: string
  age: number | null
  tenure_years: number | null
  scheduled_hours: number | null
  overtime_hours: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  hourly_wage: number | null
  workers: number | null
  survey_year: number
}

interface TimePoint {
  survey_year: number
  sex: string
  enterprise_size: string
  annual_income: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  hourly_wage: number | null
  scheduled_hours: number | null
  overtime_hours: number | null
  workers: number | null
  age: number | null
}

interface ApiResponse {
  success: boolean
  occupation_name: string
  occupation_slug: string
  survey_group_name: string
  survey_table_name: string | null
  latest_year: number
  all_years: number[]
  latest_data: DetailRow[]
  time_series: TimePoint[]
  time_series_all: TimePoint[]
  message?: string
}

// ---------- ユーティリティ ----------
function fmt(v: number | null, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toLocaleString()}${suffix}`
}
// DB値は千円単位。÷10 で万円に変換して表示
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

const ENTERPRISE_ORDER = ['企業規模計', '1000人以上', '100～999人', '10～99人']
const SEX_ORDER        = ['計', '男', '女']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#0ea5e9', '女': '#e8336d' }

// ---------- サブコンポーネント ----------
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
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
      padding: '20px 22px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#0F172A', marginTop: 10, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 700, color: '#0F172A',
        borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0,
      }}>
        {children}
      </h2>
    </div>
  )
}

// ---------- 推移グラフ ----------
const METRIC_TABS = [
  { key: 'annual_income',  label: '推定年収',      unit: '万円', divisor: 10,  stacked: false },
  { key: 'scheduled_wage', label: '月給（所定内）',  unit: '万円', divisor: 10,  stacked: false },
  { key: 'annual_bonus',   label: '年間賞与',      unit: '万円', divisor: 10,  stacked: false },
  { key: 'hourly_wage',    label: '時給換算',      unit: '円',   divisor: 1,   stacked: false },
  { key: 'work_hours',     label: '労働時間',      unit: 'h',    divisor: 1,   stacked: true  },
  { key: 'workers',        label: '労働者数',      unit: '人',   divisor: 1,   stacked: false },
  { key: 'age',            label: '平均年齢',      unit: '歳',   divisor: 1,   stacked: false },
] as const

type MetricKey = typeof METRIC_TABS[number]['key']

// 比較軸：企業規模別 or 男女別
const COMPARE_MODES = [
  { key: 'sex',  label: '男女別' },
  { key: 'size', label: '企業規模別' },
] as const
type CompareMode = typeof COMPARE_MODES[number]['key']

// 色パレット（最大6本）
const LINE_COLORS = ['#1a73e8', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#64748b']

const SEX_LINES    = ['計', '男', '女']
const SEX_LABELS: Record<string, string>  = { '計': '男女計', '男': '男性', '女': '女性' }
const SIZE_LINES   = ['企業規模計', '1000人以上', '100〜999人', '10〜99人']

function TrendChart({ timeSeriesAll, allYears, growthStr, growthPositive, oldest, latest }: {
  timeSeriesAll: TimePoint[]
  allYears: number[]
  growthStr: string
  growthPositive: boolean
  oldest: TimePoint | undefined
  latest: TimePoint | undefined
}) {
  const [metric, setMetric]          = useState<MetricKey>('annual_income')
  const [compareMode, setCompareMode] = useState<CompareMode>('sex')

  const metricDef = METRIC_TABS.find(m => m.key === metric)!
  const isStacked  = metricDef.stacked
  const lines = compareMode === 'sex' ? SEX_LINES : SIZE_LINES
  const lineLabel = (key: string) => compareMode === 'sex' ? (SEX_LABELS[key] ?? key) : key

  // 労働時間は積上げ用にキーを分ける: "所定内_男女計", "残業_男女計" など
  const getStackKeys = (lineKey: string) => ({
    scheduled: `所定内_${lineLabel(lineKey)}`,
    overtime:  `残業_${lineLabel(lineKey)}`,
  })

  const years = [...new Set(timeSeriesAll.map(t => t.survey_year))].sort((a, b) => a - b)
  const chartData = years.map(year => {
    const row: Record<string, number | string> = { year: `${year}年` }
    lines.forEach(lineKey => {
      const found = compareMode === 'sex'
        ? timeSeriesAll.find(t => t.survey_year === year && t.sex === lineKey && t.enterprise_size === '企業規模計')
        : timeSeriesAll.find(t => t.survey_year === year && t.sex === '計' && t.enterprise_size === lineKey)
      if (!found) return

      if (metric === 'work_hours') {
        const sk = getStackKeys(lineKey)
        if (found.scheduled_hours != null) row[sk.scheduled] = Math.round(found.scheduled_hours * 10) / 10
        if (found.overtime_hours  != null) row[sk.overtime]  = Math.round(found.overtime_hours  * 10) / 10
      } else if (metric === 'workers') {
        // workers は十人単位 → 人に変換
        if (found.workers != null) row[lineLabel(lineKey)] = found.workers * 10
      } else if (metric === 'age') {
        if (found.age != null) row[lineLabel(lineKey)] = Math.round(found.age * 10) / 10
      } else {
        const raw = (found as any)[metric]
        if (raw != null) row[lineLabel(lineKey)] = Math.round(Number(raw) / metricDef.divisor)
      }
    })
    return row
  })

  const formatTick = (v: number) => {
    if (metricDef.unit === '円')  return `${v.toLocaleString()}円`
    if (metricDef.unit === '万円') return `${v.toLocaleString()}万`
    if (metricDef.unit === 'h')   return `${v}h`
    if (metricDef.unit === '人')  return v >= 10000 ? `${(v/10000).toFixed(1)}万` : `${v.toLocaleString()}`
    if (metricDef.unit === '歳')  return `${v}歳`
    return `${v}`
  }
  const formatTooltip = (v: number, name: string) => {
    if (metricDef.unit === '円')  return [`${v.toLocaleString()}円`, name]
    if (metricDef.unit === '万円') return [`${v.toLocaleString()}万円`, name]
    if (metricDef.unit === 'h')   return [`${v}h`, name]
    if (metricDef.unit === '人')  return [`${v.toLocaleString()}人`, name]
    if (metricDef.unit === '歳')  return [`${v}歳`, name]
    return [`${v}`, name]
  }

  // 積上げ棒グラフ用の全バーキーを列挙
  const stackedBars = isStacked
    ? lines.flatMap((lineKey, idx) => [
        { dataKey: getStackKeys(lineKey).scheduled, fill: LINE_COLORS[idx % LINE_COLORS.length],        label: `所定内_${lineLabel(lineKey)}` },
        { dataKey: getStackKeys(lineKey).overtime,  fill: LINE_COLORS[idx % LINE_COLORS.length] + '88', label: `残業_${lineLabel(lineKey)}` },
      ])
    : []

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
        {/* 比較軸タブ */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
          {COMPARE_MODES.map(m => (
            <TabBtn key={m.key} active={compareMode === m.key} onClick={() => setCompareMode(m.key)}>
              {m.label}
            </TabBtn>
          ))}
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

            {isStacked
              ? stackedBars.map(b => (
                  <Bar key={b.dataKey} dataKey={b.dataKey} fill={b.fill} stackId={b.dataKey.replace(/^(所定内|残業)_/, '')} radius={b.dataKey.startsWith('残業') ? [3, 3, 0, 0] : undefined} />
                ))
              : lines.map((lineKey, idx) => (
                  <Bar key={lineKey} dataKey={lineLabel(lineKey)} fill={LINE_COLORS[idx % LINE_COLORS.length]} radius={[3, 3, 0, 0]} />
                ))
            }
          </BarChart>
        </ResponsiveContainer>

        {growthStr !== '−' && metric === 'annual_income' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748B' }}>
            <span>{oldest?.survey_year}年→{latest?.survey_year}年の変化（男女計）:</span>
            <strong style={{ color: growthPositive ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
              {growthPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {growthStr}
            </strong>
          </div>
        )}
        {metric === 'work_hours' && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#94A3B8' }}>
            ■ 濃色：所定内労働時間　■ 薄色：残業時間（単位：時間/月）
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- メインコンポーネント ----------
export function OccupationDetailClient({ slug }: { slug: string }) {
  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [sexTab, setSexTab]       = useState('計')
  const [sizeTab, setSizeTab]     = useState('企業規模計')
  const [kpiSexTab, setKpiSexTab] = useState('計')
  const [kpiSizeTab, setKpiSizeTab] = useState('企業規模計')

  useEffect(() => {
    fetch(`/api/salary/occupation/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'データが見つかりません'); return }
        setData(json)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [slug])

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
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          <Info size={40} color="#94A3B8" style={{ margin: '0 auto' }} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          {error ?? 'データが見つかりません'}
        </p>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>
          DB マイグレーション未実行の場合、���理画面から setup-schema を実行してください。
        </p>
        <Link
          href="/salary/ranking/occupation"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a73e8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        >
          <ArrowLeft size={15} />
          職種ランキングに戻る
        </Link>
      </div>
    )
  }

  // --- データ整形 ---
  const repFixed = data.latest_data.find(r => r.sex === '計' && r.enterprise_size === '企業規模計')
  const rep      = data.latest_data.find(r => r.sex === kpiSexTab && r.enterprise_size === kpiSizeTab) ?? repFixed
  const sizeRows  = ENTERPRISE_ORDER
    .map(size => data.latest_data.find(r => r.sex === sexTab && r.enterprise_size === size))
    .filter(Boolean) as DetailRow[]

  // 性別別テーブル用（企業規模タブでフィルタ）
  const sexRows = SEX_ORDER
    .map(sex => data.latest_data.find(r => r.sex === sex && r.enterprise_size === sizeTab))
    .filter(Boolean) as DetailRow[]

  // 年収変化（最古→最新）
  const oldest = data.time_series[0]
  const latest = data.time_series[data.time_series.length - 1]
  const growthStr = growthRate(latest?.annual_income, oldest?.annual_income)
  const growthPositive = growthStr !== '−' && !growthStr.startsWith('-')

  return (
    <main style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {/* ---- ヒーローバナー ---- */}
      <div style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #ffffff 70%)', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>

          {/* パンくずリスト */}
          <nav aria-label="パンくずリスト" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '20px 0 0', fontSize: 12, color: '#64748B', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#1a73e8', textDecoration: 'none' }}>AIリクルート</Link>
            <ChevronRight size={12} />
            <Link href="/salary/ranking/occupation" style={{ color: '#1a73e8', textDecoration: 'none' }}>職種別年収ランキング</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#94A3B8' }}>{data.occupation_name}</span>
          </nav>

          {/* タイトル・メタ */}
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
                  {growthPositive
                    ? <TrendingUp size={11} />
                    : <TrendingDown size={11} />}
                  {data.time_series[0]?.survey_year}年比 {growthStr}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.25 }}>
              {data.occupation_name}の平均年収
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              {data.survey_group_name} / {data.latest_year}年調査
              {repFixed?.annual_income != null && (
                <> — 推定年収 <strong style={{ color: '#1a73e8', fontSize: 15 }}>{fmtWan(repFixed.annual_income)}</strong>（男女計・企業規模計）</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ---- コンテンツ本体 ---- */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* KPI サマリー */}
        <section style={{ marginBottom: 36 }}>
          {/* タブ行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {/* 性別タブ */}
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
              {SEX_ORDER.map(sex => (
                <button
                  key={sex}
                  onClick={() => setKpiSexTab(sex)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    background: kpiSexTab === sex ? '#fff' : 'transparent',
                    color: kpiSexTab === sex ? SEX_COLOR[sex] : '#64748B',
                    cursor: 'pointer',
                    boxShadow: kpiSexTab === sex ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {SEX_LABEL[sex]}
                </button>
              ))}
            </div>
            {/* 企業規模タブ */}
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2, flexWrap: 'wrap' }}>
              {ENTERPRISE_ORDER.map(size => (
                <button
                  key={size}
                  onClick={() => setKpiSizeTab(size)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    background: kpiSizeTab === size ? '#fff' : 'transparent',
                    color: kpiSizeTab === size ? '#1a73e8' : '#64748B',
                    cursor: 'pointer',
                    boxShadow: kpiSizeTab === size ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
            {/* 現在の選択ラベル */}
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {SEX_LABEL[kpiSexTab]} / {kpiSizeTab}
            </span>
          </div>

        {/* KPI グリッド */}
        {rep && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 0 }}>
            <KpiCard
              icon={<Award size={13} color="#1a73e8" />}
              label="推定年収"
              value={fmtWan(rep.annual_income)}
              sub="男女計・企業規模計"
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
              value={(() => {
                // monthly_wage は千円単位。時給(円) = monthly_wage × 1,000 ÷ 160
                const mw = rep.monthly_wage
                if (mw == null) return '−'
                const hourly = Math.round(mw * 1000 / 160)
                return `${hourly.toLocaleString()}円`
              })()}
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
              value={(() => {
                if (rep.workers == null) return '−'
                // workers は十人単位
                const people = rep.workers * 10
                if (people >= 10000) return `${(people / 10000).toFixed(1)}万人`
                return `${people.toLocaleString()}人`
              })()}
              sub="調査対象労働者数"
            />
          </div>
        )}
        </section>

        {/* 推移グラフ */}
        {(data.time_series_all ?? data.time_series).length > 1 && (
          <TrendChart
            timeSeriesAll={data.time_series_all ?? data.time_series.map(t => ({ ...t, sex: '計', enterprise_size: '企業規模計' }))}
            allYears={data.all_years}
            growthStr={growthStr}
            growthPositive={growthPositive}
            oldest={oldest}
            latest={latest}
          />
        )}

        {/* 企業規模別データ */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>企業規模別データ</SectionTitle>

          {/* 性別タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {SEX_ORDER.map(s => (
              <button
                key={s}
                onClick={() => setSexTab(s)}
                style={{
                  padding: '6px 18px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  border: sexTab === s ? `1.5px solid ${SEX_COLOR[s]}` : '1.5px solid #E2E8F0',
                  background: sexTab === s ? `${SEX_COLOR[s]}14` : '#fff',
                  color: sexTab === s ? SEX_COLOR[s] : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {SEX_LABEL[s]}
              </button>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['企業規模', '推定年収', '月給（所定内）', '年間賞与', '時給換算', '平均年齢', '勤続年数', '月残業', '労働者数'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizeRows.map((r, i) => {
                    const isTotal = r.enterprise_size === '企業規模計'
                    const hourly = r.hourly_wage ?? (r.monthly_wage != null ? Math.round(Number(r.monthly_wage) * 1000 / 160) : null)
                    return (
                      <tr key={r.enterprise_size} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: i < sizeRows.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: isTotal ? 700 : 500, color: '#0F172A', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={13} color={isTotal ? '#1a73e8' : '#94A3B8'} />
                          {r.enterprise_size}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 700, color: '#1a73e8', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtWan(r.annual_income)}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.scheduled_wage)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.annual_bonus)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                          {hourly != null ? `${hourly.toLocaleString()}円/h` : '−'}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtFixed(r.age, 1, '歳')}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtFixed(r.tenure_years, 1, '年')}</td>
                        <td style={{
                          padding: '11px 14px', fontSize: 13, whiteSpace: 'nowrap',
                          color: r.overtime_hours != null && r.overtime_hours > 20 ? '#dc2626' : '#374151',
                          fontWeight: r.overtime_hours != null && r.overtime_hours > 20 ? 700 : 400,
                        }}>
                          {fmtFixed(r.overtime_hours, 1, 'h')}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(r.workers, '(十人)')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 性別別データ */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>性別別データ</SectionTitle>

          {/* 企業規模タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {ENTERPRISE_ORDER.map(size => (
              <button
                key={size}
                onClick={() => setSizeTab(size)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  border: sizeTab === size ? '1.5px solid #1a73e8' : '1.5px solid #E2E8F0',
                  background: sizeTab === size ? '#e8f0fe' : '#fff',
                  color: sizeTab === size ? '#1a73e8' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {size}
              </button>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['性別', '推定年収', '月給（所定内）', '年間賞与', '時給換算', '平均年齢', '勤続年数', '月残業', '労働者数'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sexRows.map((r, i) => {
                    const isTotal = r.sex === '計'
                    const hourly = r.hourly_wage ?? (r.monthly_wage != null ? Math.round(Number(r.monthly_wage) * 1000 / 160) : null)
                    const sexColor = SEX_COLOR[r.sex] ?? '#64748B'
                    return (
                      <tr key={r.sex} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: i < sexRows.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: isTotal ? 700 : 500, color: sexColor, whiteSpace: 'nowrap' }}>
                          {SEX_LABEL[r.sex] ?? r.sex}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 700, color: sexColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtWan(r.annual_income)}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.scheduled_wage)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.annual_bonus)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                          {hourly != null ? `${hourly.toLocaleString()}円/h` : '−'}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtFixed(r.age, 1, '歳')}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtFixed(r.tenure_years, 1, '年')}</td>
                        <td style={{
                          padding: '11px 14px', fontSize: 13, whiteSpace: 'nowrap',
                          color: r.overtime_hours != null && r.overtime_hours > 20 ? '#dc2626' : '#374151',
                          fontWeight: r.overtime_hours != null && r.overtime_hours > 20 ? 700 : 400,
                        }}>
                          {fmtFixed(r.overtime_hours, 1, 'h')}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(r.workers, '(十人)')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 関連リン��� */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>関連ランキングを見る</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { href: '/salary/ranking/occupation',            label: '職種別年収ランキング',  icon: <TrendingUp size={14} color="#1a73e8" /> },
              { href: '/salary/ranking/bonus',                 label: 'ボーナス��ンキング',      icon: <Award size={14} color="#f59e0b" /> },
              { href: '/salary/ranking/hourly-wage',           label: '時給換算ランキング',      icon: <Clock size={14} color="#0ea5e9" /> },
              { href: '/salary/ranking/high-income-low-overtime', label: '残業少ない高年収',    icon: <BarChart2 size={14} color="#7c3aed" /> },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: '#fff',
                  border: '1px solid #E2E8F0', borderRadius: 10,
                  textDecoration: 'none', fontSize: 13, color: '#374151',
                  fontWeight: 500, transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#93C5FD')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
              >
                {icon}
                {label}
                <ChevronRight size={13} color="#94A3B8" style={{ marginLeft: 'auto' }} />
              </Link>
            ))}
          </div>
        </section>

        {/* 戻るリンク */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8 }}>
          <Link
            href="/salary/ranking/occupation"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1a73e8', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
          >
            <ArrowLeft size={15} />
            職種ランキング一覧に戻る
          </Link>
        </div>

        {/* 出典 */}
        <p style={{ marginTop: 32, fontSize: 11, color: '#94A3B8', lineHeight: 1.8, borderTop: '1px solid #F1F5F9', paddingTop: 20 }}>
          出典: {data.survey_group_name}（厚生労働省 e-Stat）{data.latest_year}年調査。
          年収は「所定内給与額×12ヶ月＋年間賞与・特別給与額」をもとに推計した値です。
          表示データは統計上の平均値であり、個別の企業・職場の賃金を保証するものではありません。
        </p>
      </div>
    </main>
  )
}
