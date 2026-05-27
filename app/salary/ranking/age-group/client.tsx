'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { TrendingUp, Users, Award, BarChart2, ChevronUp, ChevronDown, ArrowUpDown, Info } from 'lucide-react'
import { RankingBarRace } from '@/components/ranking-bar-race'

interface AgeGroupRow {
  age_group: string
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
  age_order: number
}

interface Meta {
  survey_year: number
  dataset_id: number
  group_id: number
  sex: string
  enterprise_size: string
  survey_group_name: string
  survey_table_name: string | null
  avg_income: number | null
  max_income: number | null
  total_workers: number | null
  row_count: number
}

interface YearOption { survey_year: number; dataset_id: number; group_id: number }

interface ApiResponse {
  success: boolean
  data: AgeGroupRow[]
  years: YearOption[]
  meta: Meta | null
  message?: string
}

const SEX_OPTIONS = [
  { value: '計', label: '男女計' },
  { value: '男', label: '男性' },
  { value: '女', label: '女性' },
]
const SIZE_OPTIONS = [
  { value: '企業規模計', label: '企業規模計' },
  { value: '1,000人以上', label: '1,000人以上' },
  { value: '100～999人', label: '100〜999人' },
  { value: '10～99人',   label: '10〜99人' },
]

// ソート表示用ラベル付きに「年齢順」を追加
type SortKey = 'age_order' | 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours' | 'hourly_wage'
type SortDir = 'asc' | 'desc'

const SORT_KEY_LABEL: Record<SortKey, string> = {
  age_order:      '年齢順',
  annual_income:  '年収',
  monthly_wage:   '月給',
  annual_bonus:   '賞与',
  age:            '平均年齢',
  tenure_years:   '勤続年数',
  overtime_hours: '残業時間',
  hourly_wage:    '時給',
}

const SEX_TO_PARAM:  Record<string, string> = { '男': 'male', '女': 'female' }
const PARAM_TO_SEX:  Record<string, string> = { male: '男', female: '女' }
const SIZE_TO_PARAM: Record<string, string> = { '1,000人以上': 'large', '100～999人': 'medium', '10～99人': 'small' }
const PARAM_TO_SIZE: Record<string, string> = { large: '1,000人以上', medium: '100～999人', small: '10～99人' }

function fmtWan(val: number | null) {
  if (val == null) return '−'
  return `${Math.round(val).toLocaleString()}万円`
}
function fmtNum(val: number | null, suffix = '') {
  if (val == null) return '−'
  return `${Number(val).toFixed(1)}${suffix}`
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 700 }}>1</span>
  if (rank === 2) return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 700 }}>2</span>
  if (rank === 3) return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#FEF9C3', color: '#A16207', fontSize: 11, fontWeight: 700 }}>3</span>
  return <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
}

interface Props {
  initialSex?:      string | undefined
  initialSize?:     string | undefined
  initialYear?:     number | null
  initialSort?:     SortKey
  initialDir?:      SortDir
  pageHeading?:     string
  pageDescription?: string
}

export function AgeGroupRankingClient({ initialSex, initialSize, initialYear, initialSort, initialDir, pageHeading }: Props = {}) {
  const router   = useRouter()
  const pathname = usePathname()

  const [data, setData]       = useState<AgeGroupRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [years, setYears]     = useState<YearOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [sex, setSex]               = useState(initialSex ? (PARAM_TO_SEX[initialSex] ?? '計') : '計')
  const [size, setSize]             = useState(initialSize ? (PARAM_TO_SIZE[initialSize] ?? '企業規模計') : '企業規模計')
  const [surveyYear, setSurveyYear] = useState<number | null>(initialYear ?? null)
  const [sortKey, setSortKey]       = useState<SortKey>(initialSort ?? 'annual_income')
  const [sortDir, setSortDir]       = useState<SortDir>(initialDir  ?? 'desc')

  const pushUrl = useCallback((
    newSex: string, newSize: string, newYear: number | null,
    newSort: SortKey = 'annual_income', newDir: SortDir = 'desc'
  ) => {
    const params = new URLSearchParams()
    const sexParam  = SEX_TO_PARAM[newSex]
    const sizeParam = SIZE_TO_PARAM[newSize]
    if (sexParam)  params.set('sex', sexParam)
    if (sizeParam) params.set('size', sizeParam)
    if (newYear !== null) params.set('year', String(newYear))
    if (newSort !== 'annual_income') params.set('sort', newSort)
    if (newSort !== 'annual_income' && newDir !== 'desc') params.set('dir', newDir)
    const q = params.toString()
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [router, pathname])

  const fetchData = useCallback(async (_sex: string, _size: string, _year: number | null) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ sex: _sex, enterprise_size: _size })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking/age-group?${params}`)
      const json: ApiResponse = await res.json()
      if (!json.success) { setError(json.message ?? 'エラーが発生しました'); return }
      setData(json.data); setMeta(json.meta)
      if (json.years.length > 0) {
        const seen = new Set<number>()
        const uniqueYears = json.years.filter((y: YearOption) => { if (seen.has(y.survey_year)) return false; seen.add(y.survey_year); return true })
        setYears(uniqueYears)
        if (_year === null && json.meta) setSurveyYear(json.meta.survey_year)
      }
    } catch { setError('データ取得に失敗しました') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(sex, size, surveyYear) }, [sex, size, surveyYear, fetchData])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir: SortDir = sortDir === 'desc' ? 'asc' : 'desc'
      setSortDir(newDir); pushUrl(sex, size, surveyYear, key, newDir)
    } else {
      // 年齢順は昇順がデフォルト
      const defaultDir: SortDir = key === 'age_order' ? 'asc' : 'desc'
      setSortKey(key); setSortDir(defaultDir); pushUrl(sex, size, surveyYear, key, defaultDir)
    }
  }

  const sortedData = [...data].sort((a, b) => {
    const av = a[sortKey as keyof AgeGroupRow] as number | null
    const bv = b[sortKey as keyof AgeGroupRow] as number | null
    if (av == null && bv == null) return 0
    if (av == null) return 1; if (bv == null) return -1
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const topSortValue = sortedData[0]?.[sortKey === 'age_order' ? 'annual_income' : sortKey] as number | null ?? null

  const S = {
    page:       { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', 'Google Sans', sans-serif" },
    container:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px 48px' },
    hero:       { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '32px 0 24px' },
    heroInner:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px' },
    h1:         { fontSize: 26, fontWeight: 700, color: '#1E293B', margin: 0, letterSpacing: '-0.3px' },
    subtitle:   { fontSize: 13, color: '#64748B', marginTop: 6 },
    kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, margin: '24px 0' },
    kpiCard:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    kpiLabel:   { fontSize: 12, color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
    kpiValue:   { fontSize: 22, fontWeight: 700, color: '#1E293B', marginTop: 8 },
    kpiSub:     { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    filterBar:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    filterGroup:{ display: 'flex', alignItems: 'center', gap: 8 },
    filterLabel:{ fontSize: 12, color: '#64748B', fontWeight: 500, whiteSpace: 'nowrap' as const },
    chipActive: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #7c3aed', background: '#F5F3FF', color: '#7c3aed', transition: 'all .15s' },
    chip:       { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', transition: 'all .15s' },
    divider:    { width: 1, height: 28, background: '#E2E8F0' },
    tableCard:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    tableHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' },
    tableTitle: { fontSize: 14, fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 },
    badge:      { fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
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
      <th style={{ ...S.th, color: isActive ? '#7c3aed' : '#64748B' }} onClick={() => handleSort(k)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          {isActive
            ? sortDir === 'desc' ? <ChevronDown size={13} style={{ color: '#7c3aed' }} /> : <ChevronUp size={13} style={{ color: '#7c3aed' }} />
            : <ArrowUpDown size={12} style={{ color: '#CBD5E1', opacity: 0.7 }} />}
        </span>
      </th>
    )
  }

  const sexLabelMap: Record<string, string> = { '男': '男性', '女': '女性' }
  const sizeLabelMap: Record<string, string> = { '1,000人以上': '大企業', '100～999人': '中規模企業', '10～99人': '小規模企業' }
  const currentSexLabel  = sex  !== '計'        ? (sexLabelMap[sex]   ?? null) : null
  const currentSizeLabel = size !== '企業規模計' ? (sizeLabelMap[size] ?? null) : null
  const currentYearStr   = surveyYear ? `${surveyYear}年` : (meta?.survey_year ? `${meta.survey_year}年` : '')
  const currentSortLabel = SORT_KEY_LABEL[sortKey]

  const baseTitle = `年齢階級別平均${currentSortLabel}ランキング${currentYearStr}`
  let dynamicHeading = baseTitle
  if (currentSizeLabel) dynamicHeading = `${currentSizeLabel}の${baseTitle}${currentSexLabel ? `・${currentSexLabel}` : ''}`
  else if (currentSexLabel) dynamicHeading = `${currentSexLabel}の${baseTitle}`

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{pageHeading ?? dynamicHeading}</h1>
          <p style={S.subtitle}>
            {meta ? `${meta.survey_group_name}　${meta.survey_year}年調査` : '賃金構造基本統計調査に基づく年齢階級別データ'}
          </p>
        </div>
      </div>

      <div style={S.container}>
        {meta && !loading && (
          <div style={S.kpiGrid}>
            {[
              { icon: <Award size={15} color="#7c3aed" />, label: '最高年収', value: fmtWan(meta.max_income), sub: 'トップ年齢階級' },
              { icon: <BarChart2 size={15} color="#0F9D58" />, label: '全体平均年収', value: fmtWan(meta.avg_income), sub: `${meta.row_count}区分の平均` },
              { icon: <TrendingUp size={15} color="#F4B400" />, label: '集計区分数', value: `${meta.row_count}区分`, sub: `${meta.survey_year}年調査` },
              { icon: <Users size={15} color="#7c3aed" />, label: '労働者数', value: meta.total_workers ? `${(Number(meta.total_workers) / 10000).toFixed(0)}万人` : '−', sub: '対象労働者の合計' },
            ].map(({ icon, label, value, sub }) => (
              <div key={label} style={S.kpiCard}>
                <div style={S.kpiLabel}>{icon}{label}</div>
                <div style={S.kpiValue}>{value}</div>
                <div style={S.kpiSub}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* 散布図 */}
        {!loading && data.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <RankingBarRace
              data={data.map((r, i) => ({
                name:     r.age_group,
                income:   r.annual_income ?? 0,
                age:      r.age,
                workers:  r.workers,
                tenure:   r.tenure_years,
                overtime: r.overtime_hours,
                bonus:    r.annual_bonus,
                hourly:   r.hourly_wage,
                monthly:  r.monthly_wage,
                rank:     i + 1,
              }))}
              surveyYear={surveyYear}
              primaryColor="#1a73e8"
              defaultXKey="income"
              defaultYKey={data[0]?.age != null ? 'age' : data[0]?.tenure_years != null ? 'tenure' : 'workers'}
            />
          </div>
        )}

        <div style={S.filterBar}>
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>調査年</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {years.map(y => (
                <button key={y.survey_year} style={surveyYear === y.survey_year ? S.chipActive : S.chip}
                  onClick={() => { setSurveyYear(y.survey_year); pushUrl(sex, size, y.survey_year, sortKey, sortDir) }}>
                  {y.survey_year}年
                </button>
              ))}
            </div>
          </div>
          <div style={S.divider} />
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>性別</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {SEX_OPTIONS.map(o => (
                <button key={o.value}
                  style={sex === o.value
                    ? { ...S.chipActive, border: o.value === '男' ? '1.5px solid #1a73e8' : o.value === '女' ? '1.5px solid #DB4437' : '1.5px solid #7c3aed', color: o.value === '男' ? '#1a73e8' : o.value === '女' ? '#DB4437' : '#7c3aed', background: o.value === '男' ? '#EBF3FE' : o.value === '女' ? '#FCECEA' : '#F5F3FF' }
                    : S.chip}
                  onClick={() => { setSex(o.value); pushUrl(o.value, size, surveyYear, sortKey, sortDir) }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={S.divider} />
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>企業規模</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SIZE_OPTIONS.map(o => (
                <button key={o.value} style={size === o.value ? S.chipActive : S.chip}
                  onClick={() => { setSize(o.value); pushUrl(sex, o.value, surveyYear, sortKey, sortDir) }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <div style={S.tableTitle}>
              <span>年齢階級別平均{currentSortLabel}ランキング</span>
              {!loading && <span style={S.badge}>{sortedData.length}区分</span>}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 32 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 44, background: i % 2 === 0 ? '#F8FAFC' : '#fff', borderRadius: 4, marginBottom: 4 }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#DB4437', fontSize: 14 }}>
              <Info size={20} style={{ marginBottom: 8, opacity: 0.6 }} />
              <p>{error}</p>
            </div>
          ) : sortedData.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              データがありません。管理画面からCSVをインポートしてください。
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 48, cursor: 'default' }}>#</th>
                    <th style={{ ...S.th, minWidth: 120, cursor: 'default' }}>年齢階級</th>
                    <Th label="推定年収" k="annual_income" />
                    <Th label="月給" k="monthly_wage" />
                    <Th label="年間賞与" k="annual_bonus" />
                    <Th label="平均年齢" k="age" />
                    <Th label="勤続年数" k="tenure_years" />
                    <Th label="残業時間" k="overtime_hours" />
                    <Th label="時給換算" k="hourly_wage" />
                    <Th label="年齢順" k="age_order" />
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((row, idx) => {
                    const dispKey = sortKey === 'age_order' ? 'annual_income' : sortKey
                    const sortVal   = row[dispKey as keyof AgeGroupRow] as number | null
                    const sortRatio = topSortValue && sortVal ? (sortVal / topSortValue) * 100 : 0
                    const isAboveAvg = sortVal != null && meta?.avg_income != null && sortVal > meta.avg_income
                    return (
                      <tr key={`${row.age_group}-${idx}`}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F5F3FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC')}>
                        <td style={{ ...S.td, width: 48 }}><RankBadge rank={idx + 1} /></td>
                        <td style={{ ...S.td, fontWeight: 600 }}>
                          <Link
                            href={`/salary/age-group/${encodeURIComponent(row.age_group)}`}
                            className="ranking-link"
                          >
                            {row.age_group}
                          </Link>
                        </td>
                        <td style={{ ...S.td, minWidth: 140 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: sortKey === 'annual_income' ? (idx === 0 ? '#D97706' : isAboveAvg ? '#7c3aed' : '#374151') : '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtWan(row.annual_income)}
                          </span>
                          {sortKey === 'annual_income' && <div style={S.barWrap}><div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#7c3aed', borderRadius: 4 }} /></div>}
                        </td>
                        <td style={{ ...S.td, minWidth: 120 }}>
                          <span style={{ fontWeight: sortKey === 'monthly_wage' ? 700 : 400, color: sortKey === 'monthly_wage' ? (idx === 0 ? '#D97706' : '#7c3aed') : '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtWan(row.monthly_wage)}
                          </span>
                          {sortKey === 'monthly_wage' && <div style={S.barWrap}><div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#7c3aed', borderRadius: 4 }} /></div>}
                        </td>
                        <td style={{ ...S.td, minWidth: 110 }}>
                          <span style={{ fontWeight: sortKey === 'annual_bonus' ? 700 : 400, color: sortKey === 'annual_bonus' ? (idx === 0 ? '#D97706' : '#7c3aed') : '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtWan(row.annual_bonus)}
                          </span>
                          {sortKey === 'annual_bonus' && <div style={S.barWrap}><div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#7c3aed', borderRadius: 4 }} /></div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ fontWeight: sortKey === 'age' ? 700 : 400, color: sortKey === 'age' ? (idx === 0 ? '#D97706' : '#7c3aed') : '#475569' }}>{fmtNum(row.age, '歳')}</span>
                          {sortKey === 'age' && <div style={S.barWrap}><div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#94A3B8', borderRadius: 4 }} /></div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ fontWeight: sortKey === 'tenure_years' ? 700 : 400, color: sortKey === 'tenure_years' ? (idx === 0 ? '#D97706' : '#7c3aed') : '#475569' }}>{fmtNum(row.tenure_years, '年')}</span>
                          {sortKey === 'tenure_years' && <div style={S.barWrap}><div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#94A3B8', borderRadius: 4 }} /></div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ fontWeight: sortKey === 'overtime_hours' ? 700 : (row.overtime_hours != null && row.overtime_hours > 20 ? 600 : 400), color: sortKey === 'overtime_hours' ? (idx === 0 ? '#D97706' : '#DB4437') : (row.overtime_hours != null && row.overtime_hours > 20 ? '#DB4437' : '#475569') }}>
                            {fmtNum(row.overtime_hours, 'h')}
                          </span>
                          {sortKey === 'overtime_hours' && <div style={S.barWrap}><div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#FCA5A5', borderRadius: 4 }} /></div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ fontWeight: sortKey === 'hourly_wage' ? 700 : 400, color: sortKey === 'hourly_wage' ? (idx === 0 ? '#D97706' : '#7c3aed') : '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {row.hourly_wage != null ? `${row.hourly_wage.toLocaleString()}円` : '−'}
                          </span>
                          {sortKey === 'hourly_wage' && <div style={S.barWrap}><div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#7c3aed', borderRadius: 4 }} /></div>}
                        </td>

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {meta && !loading && (
            <div style={S.footer}>
              <span style={S.footerText}>出典: {meta.survey_group_name}（{meta.survey_year}年）　厚生労働省</span>
              <span style={S.footerText}>推定年収 = 月給 × 12 + 年間賞与　単位: 千円→万円換算</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
