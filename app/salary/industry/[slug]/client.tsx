'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, TrendingDown, Clock, Users, Award,
  BarChart2, ArrowLeft, Info, Building2,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ---------- 型定義 ----------
interface Row {
  sex: string; education: string; age_group: string; enterprise_size: string
  age: number | null; tenure_years: number | null
  scheduled_hours: number | null; overtime_hours: number | null
  monthly_wage: number | null; scheduled_wage: number | null
  annual_bonus: number | null; annual_income: number | null; workers: number | null
}

interface TimePoint {
  survey_year: number; sex: string; enterprise_size: string
  age: number | null; tenure_years: number | null
  scheduled_hours: number | null; overtime_hours: number | null
  monthly_wage: number | null; scheduled_wage: number | null
  annual_bonus: number | null; annual_income: number | null; workers: number | null
}

interface AgeRow {
  sex: string; age_group: string; age: number | null; tenure_years: number | null
  scheduled_hours: number | null; overtime_hours: number | null
  monthly_wage: number | null; scheduled_wage: number | null
  annual_bonus: number | null; annual_income: number | null; workers: number | null
}

interface IndustrySummary { industry_name: string; avg_annual_income: number | null; avg_monthly_wage: number | null; avg_bonus: number | null }

interface ApiResponse {
  success: boolean
  industry_name: string
  survey_group_name: string
  survey_table_name: string | null
  latest_year: number
  all_years: number[]
  latest_data: Row[]
  time_series: TimePoint[]
  age_data: AgeRow[]
  all_industry_summary: IndustrySummary[]
  message?: string
}

// ---------- ユーティリティ ----------
const toWan = (v: number | null) => v != null ? Math.round(Number(v) / 10) : null
function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v).toLocaleString()}万円`
}
function fmtFixed(v: number | null, d = 1, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toFixed(d)}${suffix}`
}
function growthRate(latest: number | null, oldest: number | null): string {
  if (!latest || !oldest || oldest === 0) return '−'
  const rate = ((latest - oldest) / oldest) * 100
  return `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`
}
function industryLabel(name: string) {
  return name.replace(/^[A-ZＡ-Ｚ]\s*/, '').replace(/^\(民[＋+]公\)\s*[A-ZＡ-Ｚ]?\s*/, '(民+公) ')
}

const ENTERPRISE_ORDER = ['企業規模計', '1000人以上', '100〜999人', '10〜99人']
const SEX_ORDER        = ['計', '男', '女']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#0ea5e9', '女': '#e8336d' }
const LINE_COLORS = ['#1a73e8', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#64748b']
const SIZE_LINES  = ['企業規模計', '1000人以上', '100〜999人', '10〜99人']
const SEX_LINES   = ['計', '男', '女']

// ---------- KPI カード ----------
function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{icon}{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#0F172A', marginTop: 10, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// ---------- 推移グラフ ----------
const METRIC_TABS = [
  { key: 'annual_income',  label: '推定年収',      unit: '万円', divisor: 10, stacked: false },
  { key: 'scheduled_wage', label: '月給（所定内）', unit: '万円', divisor: 10, stacked: false },
  { key: 'annual_bonus',   label: '年間賞与',      unit: '万円', divisor: 10, stacked: false },
  { key: 'work_hours',     label: '労働時間',      unit: 'h',    divisor: 1,  stacked: true  },
  { key: 'workers',        label: '労働者数',      unit: '人',   divisor: 1,  stacked: false },
  { key: 'age',            label: '平均年齢',      unit: '歳',   divisor: 1,  stacked: false },
] as const
type MetricKey = typeof METRIC_TABS[number]['key']
const COMPARE_MODES = [{ key: 'sex', label: '男女別' }, { key: 'size', label: '企業規模別' }] as const
type CompareMode = typeof COMPARE_MODES[number]['key']

function TrendChart({ timeSeriesAll, growthStr, growthPositive, oldest, latest }: {
  timeSeriesAll: TimePoint[]; growthStr: string; growthPositive: boolean
  oldest: TimePoint | undefined; latest: TimePoint | undefined
}) {
  const [metric, setMetric]           = useState<MetricKey>('annual_income')
  const [compareMode, setCompareMode] = useState<CompareMode>('sex')
  const metricDef = METRIC_TABS.find(m => m.key === metric)!
  const lines = compareMode === 'sex' ? SEX_LINES : SIZE_LINES
  const lineLabel = (k: string) => compareMode === 'sex' ? (SEX_LABEL[k] ?? k) : k

  const years = [...new Set(timeSeriesAll.map(t => t.survey_year))].sort((a, b) => a - b)
  const chartData = years.map(year => {
    const row: Record<string, number | string> = { year: `${year}年` }
    lines.forEach(lineKey => {
      const found = compareMode === 'sex'
        ? timeSeriesAll.find(t => t.survey_year === year && t.sex === lineKey && t.enterprise_size === '企業規模計')
        : timeSeriesAll.find(t => t.survey_year === year && t.sex === '計' && t.enterprise_size === lineKey)
      if (!found) return
      if (metric === 'work_hours') {
        const sh = found.scheduled_hours != null ? Number(found.scheduled_hours) : null
        const oh = found.overtime_hours  != null ? Number(found.overtime_hours)  : null
        if (sh != null) row[`所定内_${lineLabel(lineKey)}`] = Math.round(sh * 10) / 10
        if (oh != null) row[`残業_${lineLabel(lineKey)}`]   = Math.round(oh * 10) / 10
      } else if (metric === 'workers') {
        const w = found.workers != null ? Number(found.workers) : null
        if (w != null) row[lineLabel(lineKey)] = w
      } else if (metric === 'age') {
        const a = found.age != null ? Number(found.age) : null
        if (a != null) row[lineLabel(lineKey)] = Math.round(a * 10) / 10
      } else {
        const raw = (found as any)[metric]
        if (raw != null) row[lineLabel(lineKey)] = Math.round(Number(raw) / metricDef.divisor)
      }
    })
    return row
  })

  const fmtTick = (v: number) => {
    if (metricDef.unit === '万円') return `${v}万`
    if (metricDef.unit === 'h')   return `${v}h`
    if (metricDef.unit === '人')  return v >= 10000 ? `${(v/10000).toFixed(1)}万` : `${v}`
    if (metricDef.unit === '歳')  return `${v}歳`
    return `${v}`
  }
  const fmtTip = (v: number, name: string) => {
    if (metricDef.unit === '万円') return [`${v.toLocaleString()}万円`, name]
    if (metricDef.unit === 'h')   return [`${v}h`, name]
    if (metricDef.unit === '人')  return [`${v.toLocaleString()}人`, name]
    if (metricDef.unit === '歳')  return [`${v}歳`, name]
    return [`${v}`, name]
  }

  const stackedBars = metricDef.stacked
    ? lines.flatMap((lineKey, idx) => [
        { dataKey: `所定内_${lineLabel(lineKey)}`, fill: LINE_COLORS[idx % LINE_COLORS.length], stackId: lineLabel(lineKey) },
        { dataKey: `残業_${lineLabel(lineKey)}`,   fill: LINE_COLORS[idx % LINE_COLORS.length] + '88', stackId: lineLabel(lineKey) },
      ])
    : []

  const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? '#1a73e8' : '#64748B', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.15s' }}>
      {children}
    </button>
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
          <button key={m.key} onClick={() => setMetric(m.key)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: metric === m.key ? '1.5px solid #1a73e8' : '1.5px solid #E2E8F0', background: metric === m.key ? '#e8f0fe' : '#fff', color: metric === m.key ? '#1a73e8' : '#475569', transition: 'all 0.15s' }}>
            {m.label}
          </button>
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
            {metricDef.stacked
              ? stackedBars.map(b => <Bar key={b.dataKey} dataKey={b.dataKey} fill={b.fill} stackId={b.stackId} radius={b.dataKey.startsWith('残業') ? [3, 3, 0, 0] : undefined} />)
              : lines.map((lineKey, idx) => <Bar key={lineKey} dataKey={lineLabel(lineKey)} fill={LINE_COLORS[idx % LINE_COLORS.length]} radius={[3, 3, 0, 0]} />)
            }
          </BarChart>
        </ResponsiveContainer>
        {growthStr !== '−' && metric === 'annual_income' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748B' }}>
            <span>{oldest?.survey_year}年→{latest?.survey_year}年の変化（男女計）:</span>
            <strong style={{ color: growthPositive ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
              {growthPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{growthStr}
            </strong>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- 年齢階級別グラフ ----------
function AgeChart({ ageData, sex }: { ageData: AgeRow[]; sex: string }) {
  const rows = ageData.filter(r => r.sex === sex)
  if (rows.length === 0) return null
  const chartData = rows.map(r => ({
    age_group: r.age_group,
    年収: r.annual_income != null ? Math.round(Number(r.annual_income) / 10) : null,
    月給: r.monthly_wage  != null ? Math.round(Number(r.monthly_wage)  / 10) : null,
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="age_group" tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis tickFormatter={v => `${v}万`} tick={{ fontSize: 11, fill: '#64748B' }} width={52} />
        <Tooltip formatter={(v: number, name: string) => [`${v.toLocaleString()}万円`, name]} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="年収" fill="#1a73e8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="月給" fill="#0F9D58" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- メイン ----------
export function IndustryDetailClient({ slug }: { slug: string }) {
  const [data, setData]         = useState<ApiResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [sexTab, setSexTab]         = useState('計')
  const [sizeTab, setSizeTab]       = useState('企業規模計')
  const [kpiSexTab, setKpiSexTab]   = useState('計')
  const [kpiSizeTab, setKpiSizeTab] = useState('企業規模計')
  const [ageSex, setAgeSex]         = useState('計')

  useEffect(() => {
    fetch(`/api/salary/industry/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'データが見つかりません'); return }
        setData(json)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#1a73e8', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ color: '#94A3B8', fontSize: 14 }}>データを読み込んでいます...</p>
    </div>
  )

  if (error || !data) return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
      <Info size={40} color="#94A3B8" style={{ margin: '0 auto 16px' }} />
      <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{error ?? 'データが見つかりません'}</p>
      <Link href="/salary/ranking/industry" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a73e8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
        <ArrowLeft size={15} />産業別ランキングに戻る
      </Link>
    </div>
  )

  // --- データ整形 ---
  const repFixed = data.latest_data.find(r => r.sex === '計' && r.enterprise_size === '企業規模計' && r.education === '学歴計')
  const rep = data.latest_data.find(r => r.sex === kpiSexTab && r.enterprise_size === kpiSizeTab && r.education === '学歴計') ?? repFixed

  const sizeRows = ENTERPRISE_ORDER.map(sz => data.latest_data.find(r => r.sex === sexTab && r.enterprise_size === sz && r.education === '学歴計')).filter(Boolean) as Row[]
  const sexRows  = SEX_ORDER.map(sx => data.latest_data.find(r => r.sex === sx && r.enterprise_size === sizeTab && r.education === '学歴計')).filter(Boolean) as Row[]

  // 年収変化（最古 → 最新・男女計・企業規模計）
  const tsFiltered = data.time_series.filter(t => t.sex === '計' && t.enterprise_size === '企業規模計')
  const oldest = tsFiltered[0]
  const latest = tsFiltered[tsFiltered.length - 1]
  const growthStr = growthRate(
    latest?.annual_income != null ? Math.round(Number(latest.annual_income) / 10) : null,
    oldest?.annual_income != null ? Math.round(Number(oldest.annual_income) / 10) : null,
  )
  const growthPositive = growthStr !== '−' && !growthStr.startsWith('-')

  // 全産業ランキング内の順位
  const sorted = [...data.all_industry_summary].sort((a, b) => (b.avg_annual_income ?? 0) - (a.avg_annual_income ?? 0))
  const myRank  = sorted.findIndex(r => r.industry_name === data.industry_name) + 1
  const total   = sorted.length
  const allAvg  = data.all_industry_summary.find(r => r.industry_name === '産業計')

  const tdStyle = { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const }
  const thStyle = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' as const, textAlign: 'left' as const }

  const TabBtn = ({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) => (
    <button onClick={onClick} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? (color ?? '#1a73e8') : '#64748B', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.15s' }}>
      {label}
    </button>
  )

  return (
    <main style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {/* ヒーローバナー */}
      <div style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #ffffff 70%)', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
          {/* パンくず */}
          <nav aria-label="パンくずリスト" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '20px 0 0', fontSize: 12, color: '#64748B', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#1a73e8', textDecoration: 'none' }}>AIリクルート</Link>
            <ChevronRight size={12} />
            <Link href="/salary/ranking/industry" style={{ color: '#1a73e8', textDecoration: 'none' }}>産業別年収ランキング</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#94A3B8' }}>{industryLabel(data.industry_name)}</span>
          </nav>

          <div style={{ padding: '24px 0 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, background: '#E8F0FE', color: '#1a73e8', padding: '3px 10px', borderRadius: 20, border: '1px solid #C5D8FC' }}>
                {data.latest_year}年調査
              </span>
              {myRank > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, background: '#FEF9C3', color: '#A16207', padding: '3px 10px', borderRadius: 20, border: '1px solid #FDE68A' }}>
                  全{total}産業中 {myRank}位
                </span>
              )}
              {growthStr !== '−' && (
                <span style={{ fontSize: 11, fontWeight: 600, background: growthPositive ? '#ECFDF5' : '#FEF2F2', color: growthPositive ? '#16a34a' : '#dc2626', padding: '3px 10px', borderRadius: 20, border: `1px solid ${growthPositive ? '#BBF7D0' : '#FECACA'}`, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {growthPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {tsFiltered[0]?.survey_year}年比 {growthStr}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.25 }}>
              {industryLabel(data.industry_name)}の平均年収
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              {data.survey_group_name} / {data.latest_year}年調査
              {repFixed?.annual_income != null && (
                <> — 推定年収 <strong style={{ color: '#1a73e8', fontSize: 15 }}>{fmtWan(toWan(repFixed.annual_income))}</strong>（男女計・企業規模計）</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* KPI サマリー */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
              {SEX_ORDER.map(sx => <TabBtn key={sx} active={kpiSexTab === sx} onClick={() => setKpiSexTab(sx)} label={SEX_LABEL[sx]} color={SEX_COLOR[sx]} />)}
            </div>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2, flexWrap: 'wrap' }}>
              {ENTERPRISE_ORDER.map(sz => <TabBtn key={sz} active={kpiSizeTab === sz} onClick={() => setKpiSizeTab(sz)} label={sz} />)}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <KpiCard icon={<Award size={15} color="#1a73e8" />}   label="推定年収"      value={fmtWan(toWan(rep?.annual_income))}  sub="月給×12 + 賞与" accent="#1a73e8" />
            <KpiCard icon={<BarChart2 size={15} color="#0F9D58" />} label="月給（所定内）" value={fmtWan(toWan(rep?.scheduled_wage))} sub="所定内給与" />
            <KpiCard icon={<Award size={15} color="#F4B400" />}   label="年間賞与"      value={fmtWan(toWan(rep?.annual_bonus))}   sub="年間賞与総額" />
            <KpiCard icon={<Clock size={15} color="#0ea5e9" />}   label="残業時間"      value={fmtFixed(rep?.overtime_hours, 1, 'h/月')} sub="月平均残業時間" />
            <KpiCard icon={<Users size={15} color="#DB4437" />}   label="平均年齢"      value={fmtFixed(rep?.age, 1, '歳')}         sub="" />
            <KpiCard icon={<Building2 size={15} color="#7c3aed" />} label="勤続年数"    value={fmtFixed(rep?.tenure_years, 1, '年')} sub="" />
          </div>
          {allAvg && repFixed?.annual_income != null && (
            <div style={{ marginTop: 14, padding: '10px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12, color: '#64748B', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>産業計の平均年収: <strong style={{ color: '#0F172A' }}>{fmtWan(allAvg.avg_annual_income)}</strong></span>
              {repFixed.annual_income != null && allAvg.avg_annual_income != null && (
                <span>産業計との差:
                  <strong style={{ color: toWan(repFixed.annual_income)! > allAvg.avg_annual_income! ? '#16a34a' : '#dc2626', marginLeft: 4 }}>
                    {toWan(repFixed.annual_income)! > allAvg.avg_annual_income!
                      ? `+${(toWan(repFixed.annual_income)! - allAvg.avg_annual_income!).toLocaleString()}万円`
                      : `${(toWan(repFixed.annual_income)! - allAvg.avg_annual_income!).toLocaleString()}万円`}
                  </strong>
                </span>
              )}
            </div>
          )}
        </section>

        {/* 推移グラフ */}
        {data.time_series.length > 0 && (
          <TrendChart timeSeriesAll={data.time_series} growthStr={growthStr} growthPositive={growthPositive} oldest={oldest} latest={latest} />
        )}

        {/* 企業規模別テーブル */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0 }}>企業規模別比較</h2>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
              {SEX_ORDER.map(sx => <TabBtn key={sx} active={sexTab === sx} onClick={() => setSexTab(sx)} label={SEX_LABEL[sx]} color={SEX_COLOR[sx]} />)}
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['企業規模', '推定年収', '月給（所定内）', '年間賞与', '残業時間', '平均年齢', '勤続年数'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sizeRows.map(r => (
                    <tr key={r.enterprise_size}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.enterprise_size}</td>
                      <td style={{ ...tdStyle, color: '#1a73e8', fontWeight: 700 }}>{fmtWan(toWan(r.annual_income))}</td>
                      <td style={tdStyle}>{fmtWan(toWan(r.scheduled_wage))}</td>
                      <td style={tdStyle}>{fmtWan(toWan(r.annual_bonus))}</td>
                      <td style={tdStyle}>{fmtFixed(r.overtime_hours, 1, 'h')}</td>
                      <td style={tdStyle}>{fmtFixed(r.age, 1, '歳')}</td>
                      <td style={tdStyle}>{fmtFixed(r.tenure_years, 1, '年')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 男女別テーブル */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #e8336d', paddingLeft: 10, margin: 0 }}>男女別比較</h2>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
              {ENTERPRISE_ORDER.map(sz => <TabBtn key={sz} active={sizeTab === sz} onClick={() => setSizeTab(sz)} label={sz} />)}
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['性別', '推定年収', '月給（所定内）', '年間賞与', '残業時間', '平均年齢', '勤続年数', '労働者数'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sexRows.map(r => (
                    <tr key={r.sex}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: SEX_COLOR[r.sex] }}>{SEX_LABEL[r.sex]}</td>
                      <td style={{ ...tdStyle, color: '#1a73e8', fontWeight: 700 }}>{fmtWan(toWan(r.annual_income))}</td>
                      <td style={tdStyle}>{fmtWan(toWan(r.scheduled_wage))}</td>
                      <td style={tdStyle}>{fmtWan(toWan(r.annual_bonus))}</td>
                      <td style={tdStyle}>{fmtFixed(r.overtime_hours, 1, 'h')}</td>
                      <td style={tdStyle}>{fmtFixed(r.age, 1, '歳')}</td>
                      <td style={tdStyle}>{fmtFixed(r.tenure_years, 1, '年')}</td>
                      <td style={tdStyle}>{r.workers != null ? `${r.workers.toLocaleString()}人` : '−'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 年齢階級別グラフ */}
        {data.age_data.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #0F9D58', paddingLeft: 10, margin: 0 }}>年齢階級別の年収・月給</h2>
              <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 24, padding: 3, gap: 2 }}>
                {SEX_ORDER.map(sx => <TabBtn key={sx} active={ageSex === sx} onClick={() => setAgeSex(sx)} label={SEX_LABEL[sx]} color={SEX_COLOR[sx]} />)}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px 16px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <AgeChart ageData={data.age_data} sex={ageSex} />
            </div>
          </section>
        )}

        {/* 他産業との比較 */}
        {data.all_industry_summary.length > 1 && (
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #F4B400', paddingLeft: 10, margin: '0 0 16px' }}>他産業との年収比較</h2>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr>
                      {['#', '産業名', '推定年収', '月給', '賞与'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => {
                      const isCurrent = r.industry_name === data.industry_name
                      return (
                        <tr key={r.industry_name} style={{ background: isCurrent ? '#EBF3FE' : undefined }}>
                          <td style={{ ...tdStyle, width: 36, color: '#9CA3AF', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? '#1a73e8' : '#374151' }}>
                            {isCurrent
                              ? industryLabel(r.industry_name)
                              : <Link href={`/salary/industry/${encodeURIComponent(r.industry_name)}`} style={{ color: '#374151', textDecoration: 'none' }}>{industryLabel(r.industry_name)}</Link>
                            }
                          </td>
                          <td style={{ ...tdStyle, color: '#1a73e8', fontWeight: isCurrent ? 700 : 400 }}>{fmtWan(r.avg_annual_income)}</td>
                          <td style={tdStyle}>{fmtWan(r.avg_monthly_wage)}</td>
                          <td style={tdStyle}>{fmtWan(r.avg_bonus)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* 戻るリンク */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <Link href="/salary/ranking/industry" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1a73e8', fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '10px 24px', border: '1.5px solid #1a73e8', borderRadius: 8, transition: 'all 0.15s' }}>
            <ArrowLeft size={15} />産業別ランキングに戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
