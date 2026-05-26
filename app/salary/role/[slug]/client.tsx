'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, Users, Award,
  BarChart2, ArrowLeft, TrendingDown, Building2, Info, Briefcase,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ---------- 型定義 ----------
interface DetailRow {
  role_name: string
  sex: string
  enterprise_size: string
  tenure_category: string
  education: string
  age_group: string
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
  survey_year: number
}

interface TimePoint {
  survey_year: number
  sex: string
  enterprise_size: string
  tenure_category: string
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
}

interface ApiResponse {
  success: boolean
  role_name: string
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
function fmtWan(v: number | null | undefined) {
  if (v == null) return '−'
  return `${Math.round(Number(v) / 10).toLocaleString()}万円`
}
function growthRate(latest: number | null | undefined, oldest: number | null | undefined): string {
  if (!latest || !oldest || oldest === 0) return '−'
  const rate = ((latest - oldest) / oldest) * 100
  return `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`
}

const ENTERPRISE_ORDER = ['10人以上', '1,000人以上', '100～999人', '10～99人']
const SEX_ORDER        = ['計', '男', '女']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#0ea5e9', '女': '#e8336d' }
const TENURE_ORDER = ['勤続年数計', '0年', '1～2年', '3～4年', '5～9年', '10～14年', '15～19年', '20～24年', '25～29年', '30年以上']

// ---------- KPIカード ----------
function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent?: string
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon}{label}
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
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0 }}>
        {children}
      </h2>
    </div>
  )
}

// ---------- 推移グラフ ----------
const METRIC_TABS = [
  { key: 'annual_income',  label: '推定年収',      unit: '万円', divisor: 10 },
  { key: 'scheduled_wage', label: '月給（所定内）', unit: '万円', divisor: 10 },
  { key: 'annual_bonus',   label: '年間賞与',      unit: '万円', divisor: 10 },
  { key: 'workers',        label: '労働者数',      unit: '人',   divisor: 1  },
] as const
type MetricKey = typeof METRIC_TABS[number]['key']

const COMPARE_MODES = [
  { key: 'sex',  label: '男女別' },
  { key: 'size', label: '企業規模別' },
] as const
type CompareMode = typeof COMPARE_MODES[number]['key']

const LINE_COLORS = ['#1a73e8', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#64748b']
const SEX_LINES  = ['計', '男', '女']
const SEX_LABELS: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SIZE_LINES = ['10人以上', '1,000人以上', '100～999人', '10～99人']

function TrendChart({ timeSeriesAll, growthStr, growthPositive, oldest, latest }: {
  timeSeriesAll: TimePoint[]
  growthStr: string
  growthPositive: boolean
  oldest: TimePoint | undefined
  latest: TimePoint | undefined
}) {
  const [metric, setMetric]           = useState<MetricKey>('annual_income')
  const [compareMode, setCompareMode] = useState<CompareMode>('sex')
  const metricDef = METRIC_TABS.find(m => m.key === metric)!
  const lines     = compareMode === 'sex' ? SEX_LINES : SIZE_LINES
  const lineLabel = (k: string) => compareMode === 'sex' ? (SEX_LABELS[k] ?? k) : k

  const years = [...new Set(timeSeriesAll.map(t => t.survey_year))].sort((a, b) => a - b)
  const chartData = years.map(year => {
    const row: Record<string, number | string> = { year: `${year}年` }
    lines.forEach(lk => {
      const found = compareMode === 'sex'
        ? timeSeriesAll.find(t => t.survey_year === year && t.sex === lk && t.enterprise_size === '10人以上' && t.tenure_category === '勤続年数計')
        : timeSeriesAll.find(t => t.survey_year === year && t.sex === '計' && t.enterprise_size === lk && t.tenure_category === '勤続年数計')
      if (!found) return
      const raw = (found as any)[metric]
      if (raw != null) {
        row[lineLabel(lk)] = metric === 'workers' ? Number(raw) : Math.round(Number(raw) / metricDef.divisor)
      }
    })
    return row
  })

  const fmtTick = (v: number) => metricDef.unit === '万円' ? `${v.toLocaleString()}万`
    : metricDef.unit === '人' ? (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `${v.toLocaleString()}`)
    : `${v}`
  const fmtTip = (v: number, name: string) => [
    metricDef.unit === '万円' ? `${v.toLocaleString()}万円` : metricDef.unit === '人' ? `${v.toLocaleString()}人` : `${v}`,
    name,
  ] as [string, string]

  const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
      background: active ? '#fff' : 'transparent',
      color: active ? '#1a73e8' : '#64748B',
      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
      transition: 'all 0.15s',
    }}>{children}</button>
  )

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0 }}>推移グラフ</h2>
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
          {COMPARE_MODES.map(m => <TabBtn key={m.key} active={compareMode === m.key} onClick={() => setCompareMode(m.key)}>{m.label}</TabBtn>)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {METRIC_TABS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: metric === m.key ? '1.5px solid #1a73e8' : '1.5px solid #E2E8F0',
            background: metric === m.key ? '#e8f0fe' : '#fff',
            color: metric === m.key ? '#1a73e8' : '#475569',
            transition: 'all 0.15s',
          }}>{m.label}</button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px 16px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap="20%" barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tickFormatter={fmtTick} tick={{ fontSize: 11, fill: '#64748B' }} width={60} />
            <Tooltip formatter={fmtTip} labelStyle={{ fontSize: 12, color: '#0F172A', fontWeight: 700 }} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {lines.map((lk, idx) => (
              <Bar key={lk} dataKey={lineLabel(lk)} fill={LINE_COLORS[idx % LINE_COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
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
      </div>
    </section>
  )
}

// ---------- データテーブル ----------
function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {headers.map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: i < rows.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                {cells.map((cell, j) => (
                  <td key={j} style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- メインコンポーネント ----------
export function RoleDetailClient({ slug }: { slug: string }) {
  const [data, setData]         = useState<ApiResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [kpiSexTab, setKpiSexTab]   = useState('計')
  const [kpiSizeTab, setKpiSizeTab] = useState('10人以上')
  const [sexTab, setSexTab]     = useState('計')
  const [sizeTab, setSizeTab]   = useState('10人以上')
  const [tenureTab, setTenureTab]   = useState('勤続年数計')

  useEffect(() => {
    fetch(`/api/salary/role/${slug}`)
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
        <Info size={40} color="#94A3B8" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{error ?? 'データが見つかりません'}</p>
        <Link href="/salary/ranking/role" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a73e8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          <ArrowLeft size={15} />役職別年収ランキングに戻る
        </Link>
      </div>
    )
  }

  // --- データ整形 ---
  const repFixed = data.latest_data.find(r => r.sex === '計' && r.enterprise_size === '10人以上' && r.tenure_category === '勤続年数計')
  const rep      = data.latest_data.find(r => r.sex === kpiSexTab && r.enterprise_size === kpiSizeTab && r.tenure_category === '勤続年数計') ?? repFixed

  const oldest = data.time_series[0]
  const latest = data.time_series[data.time_series.length - 1]
  const growthStr      = growthRate(latest?.annual_income, oldest?.annual_income)
  const growthPositive = growthStr !== '−' && !growthStr.startsWith('-')

  // 勤続年数別テーブル行
  const availableTenures = TENURE_ORDER.filter(t =>
    data.latest_data.some(r => r.tenure_category === t && r.sex === sexTab && r.enterprise_size === sizeTab)
  )
  const tenureRows = availableTenures
    .map(t => data.latest_data.find(r => r.tenure_category === t && r.sex === sexTab && r.enterprise_size === sizeTab))
    .filter(Boolean) as DetailRow[]

  // 企業規模別テーブル行
  const sizeRows = ENTERPRISE_ORDER
    .map(size => data.latest_data.find(r => r.sex === sexTab && r.enterprise_size === size && r.tenure_category === tenureTab))
    .filter(Boolean) as DetailRow[]

  // 性別別テーブル行
  const sexRows = SEX_ORDER
    .map(sex => data.latest_data.find(r => r.sex === sex && r.enterprise_size === sizeTab && r.tenure_category === tenureTab))
    .filter(Boolean) as DetailRow[]

  const availableTenureFilters = TENURE_ORDER.filter(t => data.latest_data.some(r => r.tenure_category === t))

  return (
    <main style={{ background: '#F8FAFC', minHeight: '100vh' }}>

      {/* ---- ヒーローバナー ---- */}
      <div style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #ffffff 70%)', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>

          {/* パンくず */}
          <nav aria-label="パンくずリスト" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '20px 0 0', fontSize: 12, color: '#64748B', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#1a73e8', textDecoration: 'none' }}>AIリクルート</Link>
            <ChevronRight size={12} />
            <Link href="/salary/ranking/role" style={{ color: '#1a73e8', textDecoration: 'none' }}>役職別年収ランキング</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#94A3B8' }}>{data.role_name}</span>
          </nav>

          {/* タイトル */}
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
                  {data.time_series[0]?.survey_year}年比 {growthStr}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.25 }}>
              {data.role_name}の平均年収
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              {data.survey_group_name} / {data.latest_year}年調査
              {repFixed?.annual_income != null && (
                <> — 推定年収 <strong style={{ color: '#1a73e8', fontSize: 15 }}>{fmtWan(repFixed.annual_income)}</strong>（男女計・10人以上）</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ---- コンテンツ本体 ---- */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* KPI サマリー */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
              {SEX_ORDER.map(sex => (
                <button key={sex} onClick={() => setKpiSexTab(sex)} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: kpiSexTab === sex ? '#fff' : 'transparent',
                  color: kpiSexTab === sex ? SEX_COLOR[sex] : '#64748B',
                  boxShadow: kpiSexTab === sex ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  transition: 'all 0.15s',
                }}>{SEX_LABEL[sex]}</button>
              ))}
            </div>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2, flexWrap: 'wrap' }}>
              {ENTERPRISE_ORDER.map(size => (
                <button key={size} onClick={() => setKpiSizeTab(size)} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: kpiSizeTab === size ? '#fff' : 'transparent',
                  color: kpiSizeTab === size ? '#1a73e8' : '#64748B',
                  boxShadow: kpiSizeTab === size ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  transition: 'all 0.15s',
                }}>{size}</button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{SEX_LABEL[kpiSexTab]} / {kpiSizeTab}</span>
          </div>

          {rep && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <KpiCard icon={<Award size={13} color="#1a73e8" />}    label="推定年収"     value={fmtWan(rep.annual_income)}  sub="勤続年数計" accent="#1a73e8" />
              <KpiCard icon={<BarChart2 size={13} color="#0F9D58" />} label="月給（所定内）" value={fmtWan(rep.scheduled_wage)} sub="所定内給与額" />
              <KpiCard icon={<TrendingUp size={13} color="#F4B400" />} label="年間賞与"    value={fmtWan(rep.annual_bonus)}   sub="賞与・特別給与額" />
              <KpiCard
                icon={<Users size={13} color="#64748B" />}
                label="労働者数"
                value={rep.workers != null ? `${Number(rep.workers).toLocaleString()}人` : '−'}
                sub="調査対象労働者数"
              />
            </div>
          )}
        </section>

        {/* 推移グラフ */}
        {(data.time_series_all ?? data.time_series).length > 1 && (
          <TrendChart
            timeSeriesAll={data.time_series_all ?? data.time_series}
            growthStr={growthStr}
            growthPositive={growthPositive}
            oldest={oldest}
            latest={latest}
          />
        )}

        {/* 勤続年数別データ */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>勤続年数別データ</SectionTitle>

          {/* 性別タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {SEX_ORDER.map(s => (
              <button key={s} onClick={() => setSexTab(s)} style={{
                padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: sexTab === s ? `1.5px solid ${SEX_COLOR[s]}` : '1.5px solid #E2E8F0',
                background: sexTab === s ? `${SEX_COLOR[s]}14` : '#fff',
                color: sexTab === s ? SEX_COLOR[s] : '#475569',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{SEX_LABEL[s]}</button>
            ))}
          </div>
          {/* 企業規模タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {ENTERPRISE_ORDER.map(size => (
              <button key={size} onClick={() => setSizeTab(size)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: sizeTab === size ? '1.5px solid #1a73e8' : '1.5px solid #E2E8F0',
                background: sizeTab === size ? '#e8f0fe' : '#fff',
                color: sizeTab === size ? '#1a73e8' : '#475569',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{size}</button>
            ))}
          </div>

          <DataTable
            headers={['勤続年数', '推定年収', '月給（所定内）', '年間賞与', '労働者数']}
            rows={tenureRows.map(r => [
              <span key="t" style={{ fontSize: 13, fontWeight: r.tenure_category === '勤続年数計' ? 700 : 500, color: r.tenure_category === '勤続年数計' ? '#1a73e8' : '#0F172A' }}>{r.tenure_category}</span>,
              <span key="i" style={{ fontSize: 14, fontWeight: 700, color: '#1a73e8', fontVariantNumeric: 'tabular-nums' }}>{fmtWan(r.annual_income)}</span>,
              <span key="s" style={{ fontSize: 13, color: '#374151' }}>{fmtWan(r.scheduled_wage)}</span>,
              <span key="b" style={{ fontSize: 13, color: '#374151' }}>{fmtWan(r.annual_bonus)}</span>,
              <span key="w" style={{ fontSize: 13, color: '#94A3B8' }}>{r.workers != null ? `${Number(r.workers).toLocaleString()}人` : '−'}</span>,
            ])}
          />
        </section>

        {/* 企業規模別データ */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>企業規模別データ</SectionTitle>

          {/* 性別タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {SEX_ORDER.map(s => (
              <button key={s} onClick={() => setSexTab(s)} style={{
                padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: sexTab === s ? `1.5px solid ${SEX_COLOR[s]}` : '1.5px solid #E2E8F0',
                background: sexTab === s ? `${SEX_COLOR[s]}14` : '#fff',
                color: sexTab === s ? SEX_COLOR[s] : '#475569',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{SEX_LABEL[s]}</button>
            ))}
          </div>
          {/* 勤続年数タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {availableTenureFilters.map(t => (
              <button key={t} onClick={() => setTenureTab(t)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: tenureTab === t ? '1.5px solid #1a73e8' : '1.5px solid #E2E8F0',
                background: tenureTab === t ? '#e8f0fe' : '#fff',
                color: tenureTab === t ? '#1a73e8' : '#475569',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>

          <DataTable
            headers={['企業規模', '推定年収', '月給（所定内）', '年間賞与', '労働者数']}
            rows={sizeRows.map(r => [
              <span key="e" style={{ fontSize: 13, fontWeight: r.enterprise_size === '10人以上' ? 700 : 500, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={13} color={r.enterprise_size === '10人以上' ? '#1a73e8' : '#94A3B8'} />{r.enterprise_size}
              </span>,
              <span key="i" style={{ fontSize: 14, fontWeight: 700, color: '#1a73e8', fontVariantNumeric: 'tabular-nums' }}>{fmtWan(r.annual_income)}</span>,
              <span key="s" style={{ fontSize: 13, color: '#374151' }}>{fmtWan(r.scheduled_wage)}</span>,
              <span key="b" style={{ fontSize: 13, color: '#374151' }}>{fmtWan(r.annual_bonus)}</span>,
              <span key="w" style={{ fontSize: 13, color: '#94A3B8' }}>{r.workers != null ? `${Number(r.workers).toLocaleString()}人` : '−'}</span>,
            ])}
          />
        </section>

        {/* 性別別データ */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>性別別データ</SectionTitle>

          {/* 企業規模タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {ENTERPRISE_ORDER.map(size => (
              <button key={size} onClick={() => setSizeTab(size)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: sizeTab === size ? '1.5px solid #1a73e8' : '1.5px solid #E2E8F0',
                background: sizeTab === size ? '#e8f0fe' : '#fff',
                color: sizeTab === size ? '#1a73e8' : '#475569',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{size}</button>
            ))}
          </div>

          <DataTable
            headers={['性別', '推定年収', '月給（所定内）', '年間賞与', '労働者数']}
            rows={sexRows.map(r => {
              const sc = SEX_COLOR[r.sex] ?? '#64748B'
              return [
                <span key="s" style={{ fontSize: 13, fontWeight: r.sex === '計' ? 700 : 500, color: sc }}>{SEX_LABEL[r.sex] ?? r.sex}</span>,
                <span key="i" style={{ fontSize: 14, fontWeight: 700, color: sc, fontVariantNumeric: 'tabular-nums' }}>{fmtWan(r.annual_income)}</span>,
                <span key="sw" style={{ fontSize: 13, color: '#374151' }}>{fmtWan(r.scheduled_wage)}</span>,
                <span key="b" style={{ fontSize: 13, color: '#374151' }}>{fmtWan(r.annual_bonus)}</span>,
                <span key="w" style={{ fontSize: 13, color: '#94A3B8' }}>{r.workers != null ? `${Number(r.workers).toLocaleString()}人` : '−'}</span>,
              ]
            })}
          />
        </section>

        {/* 関連ランキング */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>関連ランキングを見る</SectionTitle>
          <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>基本ランキング</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {[
              { href: '/salary/ranking/role',      label: '役職別年収ランキング',  icon: <Briefcase size={14} color="#7c3aed" /> },
              { href: '/salary/ranking/occupation', label: '職種別年収ランキング',  icon: <TrendingUp size={14} color="#1a73e8" /> },
              { href: '/salary/ranking/male',       label: '男性年収ランキング',    icon: <TrendingUp size={14} color="#1a73e8" /> },
              { href: '/salary/ranking/female',     label: '女性年収ランキング',    icon: <TrendingUp size={14} color="#DB4437" /> },
            ].map(({ href, label, icon }) => (
              <Link key={href} href={href}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, textDecoration: 'none', fontSize: 13, color: '#374151', fontWeight: 500, transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#93C5FD')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                {icon}{label}<ChevronRight size={13} color="#94A3B8" style={{ marginLeft: 'auto' }} />
              </Link>
            ))}
          </div>
        </section>

        {/* 出典 */}
        <footer style={{ borderTop: '1px solid #E2E8F0', paddingTop: 24, fontSize: 11, color: '#94A3B8' }}>
          <p style={{ margin: '0 0 4px' }}>
            出典: {data.survey_group_name}（{data.latest_year}年）厚生労働省
            {data.survey_table_name && ` / ${data.survey_table_name}`}
          </p>
          <p style={{ margin: 0 }}>推定年収 = 月給 × 12 + 年間賞与　単位：千円→万円換算</p>
        </footer>
      </div>
    </main>
  )
}
