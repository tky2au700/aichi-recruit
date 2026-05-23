'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Users, Award, BarChart2, Search, X, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface IndustryRow {
  rank:              number
  industry_name:     string
  sex:               string
  education:         string
  enterprise_size:   string
  avg_age:           number | null
  avg_tenure:        number | null
  avg_sched_hours:   number | null
  avg_ot_hours:      number | null
  avg_monthly_wage:  number | null
  avg_sched_wage:    number | null
  avg_bonus:         number | null
  avg_annual_income: number | null
  total_workers:     number | null
}

interface Meta {
  survey_year:       number
  dataset_id:        number
  sex:               string
  enterprise_size:   string
  education:         string
  survey_group_name: string
  survey_table_name: string | null
  avg_income:        number | null
  max_income:        number | null
  total_workers:     number | null
  industry_count:    number
}

interface YearOption { survey_year: number; dataset_id: number; group_id: number }

interface ApiResponse {
  success: boolean
  data:    IndustryRow[]
  years:   YearOption[]
  meta:    Meta | null
  message?: string
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const SEX_OPTIONS = [
  { value: '計', label: '男女計' },
  { value: '男', label: '男性' },
  { value: '女', label: '女性' },
]
const SIZE_OPTIONS = [
  { value: '企業規模計', label: '企業規模計' },
  { value: '1000人以上', label: '1000人以上' },
  { value: '100〜999人', label: '100〜999人' },
  { value: '10〜99人',   label: '10〜99人' },
]
const EDU_OPTIONS = [
  { value: '学歴計',   label: '学歴計' },
  { value: '中学',     label: '中学' },
  { value: '高校',     label: '高校' },
  { value: '専門学校', label: '専門学校' },
  { value: '高専・短大', label: '高専・短大' },
  { value: '大学',     label: '大学' },
  { value: '大学院',   label: '大学院' },
]

type SortKey = 'avg_annual_income' | 'avg_monthly_wage' | 'avg_bonus' | 'avg_age' | 'avg_tenure' | 'avg_ot_hours'
const SORT_LABELS: Record<SortKey, string> = {
  avg_annual_income: '年収',
  avg_monthly_wage:  '月給',
  avg_bonus:         '賞与',
  avg_age:           '平均年齢',
  avg_tenure:        '勤続年数',
  avg_ot_hours:      '残業時間',
}

function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v).toLocaleString()}万円`
}
function fmtNum(v: number | null, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toFixed(1)}${suffix}`
}

function RankBadge({ rank }: { rank: number }) {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700 } as const
  if (rank === 1) return <span style={{ ...base, background: '#FEF3C7', color: '#D97706' }}>1</span>
  if (rank === 2) return <span style={{ ...base, background: '#F1F5F9', color: '#64748B' }}>2</span>
  if (rank === 3) return <span style={{ ...base, background: '#FEF9C3', color: '#A16207' }}>3</span>
  return <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
}

// 産業名からアルファベット記号を除いてスラグ化（表示用）
function industryLabel(name: string) {
  return name.replace(/^[A-ZＡ-Ｚ]\s*/, '').replace(/^\(民[＋+]公\)\s*[A-ZＡ-Ｚ]?\s*/, '(民+公) ')
}

interface Props {
  initialSex?:  string
  initialSize?: string
  initialYear?: number | null
  initialSort?: SortKey
  pageHeading?: string
}

export function IndustryRankingClient({ initialSex, initialSize, initialYear, initialSort, pageHeading }: Props = {}) {
  const [data, setData]         = useState<IndustryRow[]>([])
  const [meta, setMeta]         = useState<Meta | null>(null)
  const [years, setYears]       = useState<YearOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [sex, setSex]           = useState(initialSex  ?? '計')
  const [size, setSize]         = useState(initialSize ?? '企業規模計')
  const [education, setEdu]     = useState('学歴計')
  const [surveyYear, setYear]   = useState<number | null>(initialYear ?? null)
  const [search, setSearch]     = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>(initialSort ?? 'avg_annual_income')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async (_sex: string, _size: string, _edu: string, _year: number | null) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ sex: _sex, enterprise_size: _size, education: _edu })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking/industry?${params}`)
      const json: ApiResponse = await res.json()
      if (!json.success) { setError(json.message ?? 'エラーが発生しました'); return }
      setData(json.data)
      setMeta(json.meta)
      if (json.years.length > 0) {
        setYears(json.years)
        if (_year === null && json.meta) setYear(json.meta.survey_year)
      }
    } catch { setError('データ取得に失敗しました') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(sex, size, education, surveyYear) }, [sex, size, education, surveyYear, fetchData])

  function handleSort(key: SortKey) {
    if (sortKey === key) { setSortDir(d => d === 'desc' ? 'asc' : 'desc') }
    else { setSortKey(key); setSortDir('desc') }
  }

  const filteredData = data
    .filter(r => search === '' || r.industry_name.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1; if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })
  const topValue = filteredData[0]?.[sortKey] as number | null ?? null

  const S = {
    page:       { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', 'Google Sans', sans-serif" },
    container:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px 64px' },
    hero:       { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '32px 0 24px' },
    heroInner:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px' },
    h1:         { fontSize: 26, fontWeight: 700, color: '#1E293B', margin: 0, letterSpacing: '-0.3px' },
    subtitle:   { fontSize: 13, color: '#64748B', marginTop: 6 },
    kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, margin: '24px 0' },
    kpiCard:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    kpiLabel:   { fontSize: 12, color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
    kpiValue:   { fontSize: 22, fontWeight: 700, color: '#1E293B', marginTop: 8 },
    kpiSub:     { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    filterBar:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap' as const, gap: 14, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    filterLabel:{ fontSize: 12, color: '#64748B', fontWeight: 500, whiteSpace: 'nowrap' as const },
    chipActive: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #1a73e8', background: '#EBF3FE', color: '#1a73e8' },
    chip:       { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569' },
    divider:    { width: 1, height: 28, background: '#E2E8F0' },
    tableCard:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    tableHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' },
    tableTitle: { fontSize: 14, fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 },
    badge:      { fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 },
    table:      { width: '100%', borderCollapse: 'collapse' as const },
    th:         { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', textAlign: 'left' as const, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const },
    td:         { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const },
    barWrap:    { width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
    footer:     { padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    footerText: { fontSize: 11, color: '#94A3B8' },
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    const isActive = sortKey === k
    return (
      <th style={{ ...S.th, color: isActive ? '#1a73e8' : '#64748B' }} onClick={() => handleSort(k)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          {isActive
            ? sortDir === 'desc' ? <ChevronDown size={13} style={{ color: '#1a73e8' }} /> : <ChevronUp size={13} style={{ color: '#1a73e8' }} />
            : <ArrowUpDown size={12} style={{ color: '#CBD5E1', opacity: 0.7 }} />
          }
        </span>
      </th>
    )
  }

  const heading = pageHeading ?? `産業別平均年収ランキング${meta?.survey_year ? `${meta.survey_year}年` : ''}`

  return (
    <div style={S.page}>
      {/* ヒーロー帯 */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{heading}</h1>
          <p style={S.subtitle}>
            賃金構造基本統計調査に基づく産業別年収データ
            {meta && <span style={{ marginLeft: 12, color: '#94A3B8' }}>{meta.survey_year}年調査 ・ {meta.survey_group_name}</span>}
          </p>
        </div>
      </div>

      <div style={S.container}>
        {/* KPI */}
        {meta && !loading && (
          <div style={S.kpiGrid}>
            {[
              { icon: <Award size={15} color="#1a73e8" />,   label: '最高年収',      value: fmtWan(meta.max_income),     sub: 'トップ産業' },
              { icon: <BarChart2 size={15} color="#0F9D58" />, label: '全産業平均年収', value: fmtWan(meta.avg_income),     sub: `${meta.industry_count}産業の平均` },
              { icon: <Building2 size={15} color="#F4B400" />, label: '集計産業数',    value: `${meta.industry_count}産業`, sub: `${meta.survey_year}年調査` },
              { icon: <Users size={15} color="#DB4437" />,   label: '労働者数',      value: meta.total_workers ? `${(meta.total_workers / 10000).toFixed(0)}万人` : '−', sub: '対象労働者の合計' },
            ].map(({ icon, label, value, sub }) => (
              <div key={label} style={S.kpiCard}>
                <div style={S.kpiLabel}>{icon}{label}</div>
                <div style={S.kpiValue}>{value}</div>
                <div style={S.kpiSub}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* フィルターバー */}
        <div style={S.filterBar}>
          {/* 調査年 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.filterLabel}>調査年</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {years.map(y => (
                <button key={y.survey_year}
                  style={surveyYear === y.survey_year ? S.chipActive : S.chip}
                  onClick={() => setYear(y.survey_year)}>
                  {y.survey_year}年
                </button>
              ))}
            </div>
          </div>
          <div style={S.divider} />
          {/* 性別 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.filterLabel}>性別</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {SEX_OPTIONS.map(o => (
                <button key={o.value}
                  style={sex === o.value
                    ? { ...S.chipActive, border: o.value === '女' ? '1.5px solid #DB4437' : '1.5px solid #1a73e8', color: o.value === '女' ? '#DB4437' : '#1a73e8', background: o.value === '女' ? '#FCECEA' : '#EBF3FE' }
                    : S.chip}
                  onClick={() => setSex(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={S.divider} />
          {/* 企業規模 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.filterLabel}>企業規模</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SIZE_OPTIONS.map(o => (
                <button key={o.value} style={size === o.value ? S.chipActive : S.chip} onClick={() => setSize(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={S.divider} />
          {/* 学歴 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.filterLabel}>学歴</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EDU_OPTIONS.map(o => (
                <button key={o.value} style={education === o.value ? S.chipActive : S.chip} onClick={() => setEdu(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* テーブルカード */}
        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <div style={S.tableTitle}>
              <span>{SORT_LABELS[sortKey]}ランキング</span>
              {!loading && <span style={S.badge}>{filteredData.length} 産業</span>}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="産業名で絞り込み..."
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 32px 7px 32px', fontSize: 13, color: '#1E293B', outline: 'none', width: 200 }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '80px 24px', textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#1a73e8', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <p style={{ color: '#94A3B8', fontSize: 13 }}>読み込み中...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#EF4444', fontSize: 14 }}>{error}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 40 }}>#</th>
                    <th style={{ ...S.th, minWidth: 220 }}>産業名</th>
                    <Th label="推定年収" k="avg_annual_income" />
                    <Th label="月給"     k="avg_monthly_wage" />
                    <Th label="賞与"     k="avg_bonus" />
                    <Th label="残業(h)"  k="avg_ot_hours" />
                    <Th label="平均年齢" k="avg_age" />
                    <Th label="勤続年数" k="avg_tenure" />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, i) => {
                    const sortVal = row[sortKey] as number | null
                    const barPct  = topValue && sortVal ? Math.round((sortVal / topValue) * 100) : 0
                    const isTop   = i === 0
                    return (
                      <tr key={row.industry_name} style={{ background: isTop ? '#FAFEFF' : undefined }}>
                        <td style={S.td}><RankBadge rank={i + 1} /></td>
                        <td style={{ ...S.td, maxWidth: 260 }}>
                          <Link
                            href={`/salary/industry/${encodeURIComponent(row.industry_name)}`}
                            style={{ color: '#1a73e8', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
                          >
                            {industryLabel(row.industry_name)}
                          </Link>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, fontFamily: 'monospace' }}>{row.industry_name}</div>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: '#1a73e8' }}>{fmtWan(row.avg_annual_income)}</div>
                          <div style={S.barWrap}>
                            <div style={{ height: '100%', width: `${barPct}%`, background: '#1a73e8', borderRadius: 4 }} />
                          </div>
                        </td>
                        <td style={S.td}>{fmtWan(row.avg_monthly_wage)}</td>
                        <td style={S.td}>{fmtWan(row.avg_bonus)}</td>
                        <td style={S.td}>{fmtNum(row.avg_ot_hours, 'h')}</td>
                        <td style={S.td}>{fmtNum(row.avg_age, '歳')}</td>
                        <td style={S.td}>{fmtNum(row.avg_tenure, '年')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={S.footer}>
                <span style={S.footerText}>{filteredData.length} 産業を表示中</span>
                <span style={S.footerText}>出典: 賃金構造基本統計調査 {meta?.survey_year}年</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
