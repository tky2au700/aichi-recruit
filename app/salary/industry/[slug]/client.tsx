'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, TrendingDown, Clock, Users,
  Award, BarChart2, ArrowLeft, Info, Building2,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ---------- 型定義 ----------
interface SizeRow {
  enterprise_size: string
  age: number | null; tenure_years: number | null
  scheduled_hours: number | null; overtime_hours: number | null
  monthly_wage: number | null; scheduled_wage: number | null
  annual_bonus: number | null; annual_income: number | null; workers: number | null
}
interface SexRow {
  sex: string
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
interface KpiRow {
  sex: string; education: string; age_group: string; enterprise_size: string
  age: number | null; tenure_years: number | null
  scheduled_hours: number | null; overtime_hours: number | null
  monthly_wage: number | null; scheduled_wage: number | null
  annual_bonus: number | null; annual_income: number | null; workers: number | null
}
interface IndustrySummary {
  industry_name: string
  avg_annual_income: number | null; avg_monthly_wage: number | null; avg_bonus: number | null
}
interface ApiResponse {
  success: boolean
  industry_name: string
  survey_group_name: string
  survey_table_name: string | null
  latest_year: number
  all_years: number[]
  selected: { year: number; sex: string; size: string; education: string }
  education_options: string[]
  kpi_row: KpiRow | null
  size_rows: SizeRow[]
  sex_rows: SexRow[]
  age_data: AgeRow[]
  time_series: TimePoint[]
  all_industry_summary: IndustrySummary[]
  message?: string
}

// ---------- 定数 ----------
const ENTERPRISE_OPTIONS = ['企業規模計', '1000人以上', '100〜999人', '10〜99人']
const SEX_OPTIONS        = ['計', '男', '女']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#0ea5e9', '女': '#e8336d' }
const LINE_COLORS = ['#1a73e8', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#64748b']

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

// ---------- スタイル ----------
const tdStyle = { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const }
const thStyle = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' as const, textAlign: 'left' as const }

// ---------- フィルタチップ ----------
function Chip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        border: active ? `1.5px solid ${color ?? '#1a73e8'}` : '1.5px solid #E2E8F0',
        background: active ? (color ? `${color}18` : '#E8F0FE') : '#fff',
        color: active ? (color ?? '#1a73e8') : '#64748B',
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </button>
  )
}

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
  const lines = compareMode === 'sex' ? SEX_OPTIONS : ENTERPRISE_OPTIONS
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
        if (found.workers != null) row[lineLabel(lineKey)] = Number(found.workers)
      } else if (metric === 'age') {
        if (found.age != null) row[lineLabel(lineKey)] = Math.round(Number(found.age) * 10) / 10
      } else {
        const raw = (found as Record<string, unknown>)[metric]
        if (raw != null) row[lineLabel(lineKey)] = Math.round(Number(raw) / metricDef.divisor)
      }
    })
    return row
  })

  const fmtTick = (v: number) => {
    if (metricDef.unit === '万円') return `${v}万`
    if (metricDef.unit === 'h')   return `${v}h`
    if (metricDef.unit === '人')  return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`
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
  const router       = useRouter()
  const searchParams = useSearchParams()

  const spYear = searchParams.get('year')
  const spSex  = searchParams.get('sex')  ?? '計'
  const spSize = searchParams.get('size') ?? '企業規模計'
  const spEdu  = searchParams.get('education') ?? '学歴計'

  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [ageSex, setAgeSex]   = useState(spSex === '計' ? '計' : spSex)

  const buildUrl = useCallback((overrides: Record<string, string>) => {
    const p = new URLSearchParams()
    const merged = { year: spYear ?? '', sex: spSex, size: spSize, education: spEdu, ...overrides }
    if (merged.year)              p.set('year', merged.year)
    if (merged.sex !== '計')      p.set('sex', merged.sex)
    if (merged.size !== '企業規模計') p.set('size', merged.size)
    if (merged.education !== '学歴計') p.set('education', merged.education)
    const qs = p.toString()
    return `/salary/industry/${slug}${qs ? `?${qs}` : ''}`
  }, [slug, spYear, spSex, spSize, spEdu])

  const setParam = useCallback((key: string, value: string) => {
    router.replace(buildUrl({ [key]: value }), { scroll: false })
  }, [router, buildUrl])

  useEffect(() => {
    const p = new URLSearchParams()
    if (spYear) p.set('year', spYear)
    p.set('sex', spSex)
    p.set('size', spSize)
    p.set('education', spEdu)
    setLoading(true)
    setError(null)
    fetch(`/api/salary/industry/${encodeURIComponent(slug)}?${p.toString()}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'データが見つかりません'); return }
        setData(json)
        // 年齢グラフの性別を選択中の性別に追従
        setAgeSex(json.selected.sex)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [slug, spYear, spSex, spSize, spEdu])

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

  const rep = data.kpi_row
  const sorted = [...data.all_industry_summary].sort((a, b) => (b.avg_annual_income ?? 0) - (a.avg_annual_income ?? 0))
  const myRank  = sorted.findIndex(r => r.industry_name === data.industry_name) + 1
  const total   = sorted.length
  const allAvg  = data.all_industry_summary.find(r => r.industry_name === '産業計')

  const tsFiltered  = data.time_series.filter(t => t.sex === '計' && t.enterprise_size === '企業規模計')
  const oldest      = tsFiltered[0]
  const latestPoint = tsFiltered[tsFiltered.length - 1]
  const growthStr      = growthRate(
    latestPoint?.annual_income != null ? Math.round(Number(latestPoint.annual_income) / 10) : null,
    oldest?.annual_income      != null ? Math.round(Number(oldest.annual_income)      / 10) : null,
  )
  const growthPositive = growthStr !== '−' && !growthStr.startsWith('-')

  const FilterSection = ({ label, options, current, paramKey, getLabel, getColor }: {
    label: string; options: string[]; current: string; paramKey: string
    getLabel?: (v: string) => string; getColor?: (v: string) => string
  }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', minWidth: 48 }}>{label}</span>
      {options.map(opt => (
        <Chip
          key={opt}
          active={current === opt}
          onClick={() => setParam(paramKey, opt)}
          label={getLabel ? getLabel(opt) : opt}
          color={getColor ? getColor(opt) : undefined}
        />
      ))}
    </div>
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

          <div style={{ padding: '24px 0 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
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
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
              {data.survey_group_name} / {data.latest_year}年調査
              {rep?.annual_income != null && (
                <>— 推定年収 <strong style={{ color: '#1a73e8', fontSize: 15 }}>{fmtWan(toWan(rep.annual_income))}</strong></>
              )}
            </p>

            {/* フィルタパネル */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <FilterSection
                label="調査年"
                options={data.all_years.map(String)}
                current={String(data.latest_year)}
                paramKey="year"
                getLabel={v => `${v}年`}
              />
              <FilterSection
                label="性別"
                options={SEX_OPTIONS}
                current={spSex}
                paramKey="sex"
                getLabel={v => SEX_LABEL[v] ?? v}
                getColor={v => SEX_COLOR[v]}
              />
              <FilterSection
                label="企業規模"
                options={ENTERPRISE_OPTIONS}
                current={spSize}
                paramKey="size"
              />
              <FilterSection
                label="学歴"
                options={data.education_options}
                current={spEdu}
                paramKey="education"
              />
            </div>
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* KPI サマリー */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <KpiCard icon={<Award size={15} color="#1a73e8" />}     label="推定年収"      value={fmtWan(toWan(rep?.annual_income))}        sub={`${SEX_LABEL[spSex] ?? spSex} / ${spSize}`} accent="#1a73e8" />
            <KpiCard icon={<BarChart2 size={15} color="#0F9D58" />}  label="月給（所定内）" value={fmtWan(toWan(rep?.scheduled_wage))}       sub="所定内給与" />
            <KpiCard icon={<Award size={15} color="#F4B400" />}     label="年間賞与"      value={fmtWan(toWan(rep?.annual_bonus))}         sub="年間賞与総額" />
            <KpiCard icon={<Clock size={15} color="#0ea5e9" />}     label="残業時間"      value={fmtFixed(rep?.overtime_hours, 1, 'h/月')} sub="月平均残業時間" />
            <KpiCard icon={<Users size={15} color="#DB4437" />}     label="平均年齢"      value={fmtFixed(rep?.age, 1, '歳')}               sub="" />
            <KpiCard icon={<Building2 size={15} color="#7c3aed" />} label="勤続年数"      value={fmtFixed(rep?.tenure_years, 1, '年')}      sub="" />
          </div>
          {allAvg && rep?.annual_income != null && (
            <div style={{ marginTop: 14, padding: '10px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12, color: '#64748B', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>産業計の平均年収: <strong style={{ color: '#0F172A' }}>{fmtWan(allAvg.avg_annual_income)}</strong></span>
              {rep.annual_income != null && allAvg.avg_annual_income != null && (() => {
                const myVal  = toWan(rep.annual_income)!
                const avgVal = allAvg.avg_annual_income!
                const diff   = myVal - avgVal
                return (
                  <span>産業計との差:
                    <strong style={{ color: diff >= 0 ? '#16a34a' : '#dc2626', marginLeft: 4 }}>
                      {diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}万円
                    </strong>
                  </span>
                )
              })()}
            </div>
          )}
        </section>

        {/* 推移グラフ */}
        {data.time_series.length > 0 && (
          <TrendChart timeSeriesAll={data.time_series} growthStr={growthStr} growthPositive={growthPositive} oldest={oldest} latest={latestPoint} />
        )}

        {/* 企業規模別テーブル */}
        {data.size_rows.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0 }}>
                企業規模別比較
                <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>
                  {SEX_LABEL[spSex] ?? spSex} / {spEdu}
                </span>
              </h2>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['企業規模', '推定年収', '月給（所定内）', '年間賞与', '残業時間', '平均年齢', '勤続年数'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.size_rows.map(r => (
                      <tr key={r.enterprise_size} style={{ background: r.enterprise_size === spSize ? '#EBF3FE' : undefined }}>
                        <td style={{ ...tdStyle, fontWeight: r.enterprise_size === spSize ? 700 : 400, color: r.enterprise_size === spSize ? '#1a73e8' : '#374151' }}>{r.enterprise_size}</td>
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
        )}

        {/* 男女別テーブル */}
        {data.sex_rows.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #e8336d', paddingLeft: 10, margin: 0 }}>
                男女別比較
                <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>
                  {spSize} / {spEdu}
                </span>
              </h2>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['性別', '推定年収', '月給（所定内）', '年間賞与', '残業時間', '平均年齢', '勤続年数', '労働者数'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sex_rows.map(r => (
                      <tr key={r.sex} style={{ background: r.sex === spSex ? '#EBF3FE' : undefined }}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: SEX_COLOR[r.sex] }}>{SEX_LABEL[r.sex] ?? r.sex}</td>
                        <td style={{ ...tdStyle, color: '#1a73e8', fontWeight: 700 }}>{fmtWan(toWan(r.annual_income))}</td>
                        <td style={tdStyle}>{fmtWan(toWan(r.scheduled_wage))}</td>
                        <td style={tdStyle}>{fmtWan(toWan(r.annual_bonus))}</td>
                        <td style={tdStyle}>{fmtFixed(r.overtime_hours, 1, 'h')}</td>
                        <td style={tdStyle}>{fmtFixed(r.age, 1, '歳')}</td>
                        <td style={tdStyle}>{fmtFixed(r.tenure_years, 1, '年')}</td>
                        <td style={tdStyle}>{r.workers != null ? `${Number(r.workers).toLocaleString()}人` : '−'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* 年齢階級別グラフ */}
        {data.age_data.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #0F9D58', paddingLeft: 10, margin: 0 }}>
                年齢階級別の年収・月給
                <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>{spSize} / {spEdu}</span>
              </h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SEX_OPTIONS.map(sx => (
                  <Chip key={sx} active={ageSex === sx} onClick={() => setAgeSex(sx)} label={SEX_LABEL[sx]} color={SEX_COLOR[sx]} />
                ))}
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', borderLeft: '3px solid #F4B400', paddingLeft: 10, margin: '0 0 16px' }}>
              他産業との年収比較
              <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>
                {SEX_LABEL[spSex] ?? spSex} / {spSize} / {spEdu}
              </span>
            </h2>
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
                              : (
                                <Link
                                  href={`/salary/industry/${encodeURIComponent(r.industry_name)}?sex=${spSex}&size=${spSize}&education=${spEdu}`}
                                  style={{ color: '#374151', textDecoration: 'none' }}
                                >
                                  {industryLabel(r.industry_name)}
                                </Link>
                              )
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
          <Link
            href={`/salary/ranking/industry?sex=${spSex}&size=${spSize}&education=${spEdu}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1a73e8', fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '10px 24px', border: '1.5px solid #1a73e8', borderRadius: 8, transition: 'all 0.15s' }}
          >
            <ArrowLeft size={15} />産業別ランキングに戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
