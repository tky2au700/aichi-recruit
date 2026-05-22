'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Clock, Search, X, ChevronUp, ChevronDown, ArrowUpDown, Info } from 'lucide-react'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface OvertimeRow {
  occupation_name: string
  occupation_slug: string | null
  overtime_hours: number | null
  scheduled_hours: number | null
  total_hours: number | null
  annual_income: number | null
  hourly_wage: number | null
  workers: number | null
}

interface Meta {
  survey_year: number
  dataset_id: number
  group_id: number
  sex: string
  enterprise_size: string
  survey_group_name: string
  survey_table_name: string | null
  avg_overtime: number | null
  max_overtime: number | null
  avg_scheduled: number | null
  total_workers: number | null
  occupation_count: number
}

interface YearOption {
  survey_year: number
  dataset_id: number
  group_id: number
}

interface ApiResponse {
  success: boolean
  data: OvertimeRow[]
  years: YearOption[]
  meta: Meta | null
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
  { value: '100～999人', label: '100〜999人' },
  { value: '10～99人',   label: '10〜99人' },
]

const SEX_TO_PARAM:  Record<string, string> = { '男': 'male', '女': 'female' }
const PARAM_TO_SEX:  Record<string, string> = { male: '男', female: '女' }
const SIZE_TO_PARAM: Record<string, string> = {
  '1000人以上': 'large', '100～999人': 'medium', '10～99人': 'small',
}
const PARAM_TO_SIZE: Record<string, string> = {
  large: '1000人以上', medium: '100～999人', small: '10～99人',
}

type SortKey = 'overtime_hours' | 'scheduled_hours' | 'total_hours' | 'annual_income' | 'hourly_wage'
type SortDir = 'asc' | 'desc'

const SORT_KEY_LABEL: Record<SortKey, string> = {
  overtime_hours:  '残業時間',
  scheduled_hours: '実労働時間',
  total_hours:     '合計労働時間',
  annual_income:   '推定年収',
  hourly_wage:     '時給',
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function fmtWan(val: number | null) {
  if (val == null) return '−'
  return `${Math.round(val).toLocaleString()}万円`
}
function fmtH(val: number | null) {
  if (val == null) return '−'
  return `${Number(val).toFixed(1)}h`
}
function fmtYen(val: number | null) {
  if (val == null) return '−'
  return `${val.toLocaleString()}円`
}

// 順位メダル
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 700 }}>1</span>
  )
  if (rank === 2) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 700 }}>2</span>
  )
  if (rank === 3) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#FEF9C3', color: '#A16207', fontSize: 11, fontWeight: 700 }}>3</span>
  )
  return <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  initialSex?:      string | undefined
  initialSize?:     string | undefined
  initialYear?:     number | null
  initialSort?:     SortKey
  initialDir?:      SortDir
  pageHeading?:     string
  pageDescription?: string
}

export function OvertimeWageRankingClient({
  initialSex, initialSize, initialYear, initialSort, initialDir,
  pageHeading, pageDescription,
}: Props = {}) {
  const router   = useRouter()
  const pathname = usePathname()

  const [data, setData]       = useState<OvertimeRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [years, setYears]     = useState<YearOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [sex, setSex]               = useState(initialSex  ? (PARAM_TO_SEX[initialSex]   ?? '計')        : '計')
  const [size, setSize]             = useState(initialSize ? (PARAM_TO_SIZE[initialSize] ?? '企業規模計') : '企業規模計')
  const [surveyYear, setSurveyYear] = useState<number | null>(initialYear ?? null)
  const [search, setSearch]         = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>(initialSort ?? 'overtime_hours')
  const [sortDir, setSortDir]       = useState<SortDir>(initialDir  ?? 'desc')

  // URL同期
  const pushUrl = useCallback((
    newSex: string, newSize: string, newYear: number | null,
    newSort: SortKey = 'overtime_hours', newDir: SortDir = 'desc'
  ) => {
    const params = new URLSearchParams()
    const sexParam  = SEX_TO_PARAM[newSex]
    const sizeParam = SIZE_TO_PARAM[newSize]
    if (sexParam)                                         params.set('sex',  sexParam)
    if (sizeParam)                                        params.set('size', sizeParam)
    if (newYear !== null)                                 params.set('year', String(newYear))
    if (newSort !== 'overtime_hours')                     params.set('sort', newSort)
    if (newSort !== 'overtime_hours' && newDir !== 'desc') params.set('dir', newDir)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname])

  const fetchData = useCallback(async (_sex: string, _size: string, _year: number | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sex: _sex, size: _size })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking/overtime-wage?${params}&_=${Date.now()}`, { cache: 'no-store' })
      const json: ApiResponse = await res.json()
      if (!json.success) { setError(json.message ?? 'エラーが発生しました'); return }
      setData(json.data)
      setMeta(json.meta)
      if (json.years.length > 0) {
        setYears(json.years)
        if (_year === null && json.meta) setSurveyYear(json.meta.survey_year)
      }
    } catch {
      setError('データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(sex, size, surveyYear) }, [sex, size, surveyYear, fetchData])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir: SortDir = sortDir === 'desc' ? 'asc' : 'desc'
      setSortDir(newDir)
      pushUrl(sex, size, surveyYear, key, newDir)
    } else {
      setSortKey(key)
      setSortDir('desc')
      pushUrl(sex, size, surveyYear, key, 'desc')
    }
  }

  const filteredData = data
    .filter(r => search === '' || r.occupation_name.includes(search))
    .sort((a, b) => {
      const av = a[sortKey as keyof OvertimeRow] as number | null
      const bv = b[sortKey as keyof OvertimeRow] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const topSortValue = filteredData[0]?.[sortKey] as number | null ?? null

  // ---------------------------------------------------------------------------
  // スタイル定数
  // ---------------------------------------------------------------------------
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
    chipActive: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #1a73e8', background: '#EBF3FE', color: '#1a73e8', transition: 'all .15s' },
    chip:       { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', transition: 'all .15s' },
    divider:    { width: 1, height: 28, background: '#E2E8F0' },
    tableCard:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    tableHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' },
    tableTitle: { fontSize: 14, fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 },
    badge:      { fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
    searchWrap: { position: 'relative' as const },
    searchInput:{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 32px 7px 32px', fontSize: 13, color: '#1E293B', outline: 'none', width: 200 },
    table:      { width: '100%', borderCollapse: 'collapse' as const },
    th:         { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', textAlign: 'left' as const, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const },
    td:         { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const },
    barWrap:    { width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
    footer:     { padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    footerText: { fontSize: 11, color: '#94A3B8' },
  }

  // ---------------------------------------------------------------------------
  // ソートヘッダー
  // ---------------------------------------------------------------------------
  function Th({ label, k }: { label: string; k: SortKey }) {
    const isActive = sortKey === k
    return (
      <th style={{ ...S.th, color: isActive ? '#1a73e8' : '#64748B' }} onClick={() => handleSort(k)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          {isActive
            ? sortDir === 'desc'
              ? <ChevronDown size={13} style={{ color: '#1a73e8' }} />
              : <ChevronUp   size={13} style={{ color: '#1a73e8' }} />
            : <ArrowUpDown size={12} style={{ color: '#CBD5E1', opacity: 0.7 }} />
          }
        </span>
      </th>
    )
  }

  // ---------------------------------------------------------------------------
  // 動的見出し
  // ---------------------------------------------------------------------------
  const sexLabelMap:  Record<string, string> = { '男': '男性', '女': '女性' }
  const sizeLabelMap: Record<string, string> = {
    '1000人以上': '大企業', '100～999人': '中規模企業', '10～99人': '小規模企業',
  }
  const currentSexLabel  = sex  !== '計'        ? (sexLabelMap[sex]   ?? null) : null
  const currentSizeLabel = size !== '企業規模計' ? (sizeLabelMap[size] ?? null) : null
  const currentYearStr   = surveyYear ? `${surveyYear}年` : (meta?.survey_year ? `${meta.survey_year}年` : '')
  const currentSortLabel = SORT_KEY_LABEL[sortKey]

  const baseTitle = `職種別平均${currentSortLabel}ランキング${currentYearStr}`
  let dynamicHeading: string
  if (currentSizeLabel) {
    dynamicHeading = `${currentSizeLabel}の${baseTitle}${currentSexLabel ? `・${currentSexLabel}` : ''}`
  } else if (currentSexLabel) {
    dynamicHeading = `${currentSexLabel}の${baseTitle}`
  } else {
    dynamicHeading = baseTitle
  }

  const filterDescParts = [
    currentSizeLabel ? `${currentSizeLabel}（${size === '1000人以上' ? '1000人以上' : size === '100～999人' ? '100〜999人' : '10〜99人'}）` : null,
    currentSexLabel,
  ].filter(Boolean)
  const dynamicDescription = (currentSexLabel || currentSizeLabel || surveyYear || sortKey !== 'overtime_hours')
    ? `${currentYearStr}調査の賃金構造基本統計調査に基づく${filterDescParts.length > 0 ? filterDescParts.join('・') + 'の' : ''}${baseTitle}データです。`
    : null

  const displayHeading     = pageHeading     ?? dynamicHeading
  const displayDescription = pageDescription ?? dynamicDescription

  // ---------------------------------------------------------------------------
  // セルヘルパー
  // ---------------------------------------------------------------------------
  function SortCell({
    value, isSort, idx, sortRatio,
    fmt, highThreshold, highColor = '#DB4437', barColor = '#1a73e8',
  }: {
    value: number | null
    isSort: boolean
    idx: number
    sortRatio: number
    fmt: (v: number | null) => string
    highThreshold?: number
    highColor?: string
    barColor?: string
  }) {
    const isHigh = highThreshold != null && value != null && value > highThreshold
    return (
      <td style={{ ...S.td, minWidth: 110 }}>
        <span style={{
          fontWeight: isSort ? 700 : (isHigh ? 600 : 400),
          fontVariantNumeric: 'tabular-nums',
          color: isSort
            ? (idx === 0 ? '#D97706' : barColor === '#DB4437' ? '#DB4437' : '#1a73e8')
            : (isHigh ? highColor : '#475569'),
        }}>
          {fmt(value)}
        </span>
        {isSort && (
          <div style={S.barWrap}>
            <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : barColor, borderRadius: 4, transition: 'width .3s' }} />
          </div>
        )}
      </td>
    )
  }

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------
  return (
    <div style={S.page}>
      {/* ヘッダー帯 */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{displayHeading}</h1>
          {displayDescription ? (
            <p style={S.subtitle}>{displayDescription}</p>
          ) : meta ? (
            <p style={S.subtitle}>
              {meta.survey_group_name}
              {meta.survey_table_name && <span style={{ color: '#94A3B8' }}>　{meta.survey_table_name}</span>}
              <span style={{ marginLeft: 12, color: '#94A3B8' }}>{meta.survey_year}年調査</span>
            </p>
          ) : (
            <p style={S.subtitle}>賃金構造基本統計調査に基づく職種別残業・時給データ</p>
          )}
        </div>
      </div>

      <div style={S.container}>
        {/* KPIカード */}
        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}><Clock size={14} color="#DB4437" /> 最多残業時間</div>
            <div style={S.kpiValue}>{fmtH(meta?.max_overtime ?? null)}</div>
            <div style={S.kpiSub}>月間・トップ職種</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}><Clock size={14} color="#94A3B8" /> 全職種平均残業</div>
            <div style={S.kpiValue}>{fmtH(meta?.avg_overtime ?? null)}</div>
            <div style={S.kpiSub}>{filteredData.length}職種の平均</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}><Clock size={14} color="#475569" /> 平均所定内時間</div>
            <div style={S.kpiValue}>{fmtH(meta?.avg_scheduled ?? null)}</div>
            <div style={S.kpiSub}>月間所定内労働</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}><Clock size={14} color="#64748B" /> 集計職種数</div>
            <div style={S.kpiValue}>{meta?.occupation_count ?? '−'}職種</div>
            <div style={S.kpiSub}>{currentYearStr}調査</div>
          </div>
        </div>

        {/* フィルターバー */}
        <div style={S.filterBar}>
          {/* 調査年 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>調査年</span>
            {years.map(y => (
              <button
                key={y.survey_year}
                style={surveyYear === y.survey_year ? S.chipActive : S.chip}
                onClick={() => { setSurveyYear(y.survey_year); pushUrl(sex, size, y.survey_year, sortKey, sortDir) }}
              >
                {y.survey_year}年
              </button>
            ))}
          </div>
          <div style={S.divider} />
          {/* 性別 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>性別</span>
            {SEX_OPTIONS.map(o => (
              <button
                key={o.value}
                style={sex === o.value ? S.chipActive : S.chip}
                onClick={() => { setSex(o.value); pushUrl(o.value, size, surveyYear, sortKey, sortDir) }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={S.divider} />
          {/* 企業規模 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>企業規模</span>
            {SIZE_OPTIONS.map(o => (
              <button
                key={o.value}
                style={size === o.value ? S.chipActive : S.chip}
                onClick={() => { setSize(o.value); pushUrl(sex, o.value, surveyYear, sortKey, sortDir) }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* テーブルカード */}
        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <div style={S.tableTitle}>
              <Clock size={16} color="#DB4437" />
              <span>{currentSortLabel}ランキング</span>
              <span style={S.badge}>{loading ? '...' : `${filteredData.length}職種`}</span>
            </div>
            <div style={S.searchWrap}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                style={S.searchInput}
                placeholder="職種名で絞り込み..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <X size={13} color="#94A3B8" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '24px 20px' }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 44, background: i % 2 === 0 ? '#F8FAFC' : '#fff', borderRadius: 4, marginBottom: 4, animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#DB4437', fontSize: 14 }}>
              <Info size={20} style={{ marginBottom: 8, opacity: 0.6 }} />
              <p>{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              {data.length === 0 ? 'データがありません。管理画面からCSVをインポートしてください。' : '該当する職種はありません。'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 48, cursor: 'default' }}>#</th>
                    <th style={{ ...S.th, minWidth: 160, cursor: 'default' }}>職種名</th>
                    <Th label="時給" k="hourly_wage" />
                    <Th label="残業時間" k="overtime_hours" />
                    <Th label="実労働時間" k="scheduled_hours" />
                    <Th label="合計労働時間" k="total_hours" />
                    <Th label="推定年収" k="annual_income" />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const sortVal   = row[sortKey] as number | null
                    const sortRatio = topSortValue && sortVal ? (sortVal / topSortValue) * 100 : 0
                    return (
                      <tr
                        key={`${row.occupation_name}-${idx}`}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EBF3FE')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC')}
                      >
                        {/* 順位 */}
                        <td style={{ ...S.td, width: 48 }}>
                          <RankBadge rank={idx + 1} />
                        </td>
                        {/* 職種名 */}
                        <td style={{ ...S.td }}>
                          <Link
                            href={`/salary/occupation/${row.occupation_slug ?? encodeURIComponent(row.occupation_name)}`}
                            className="occupation-link"
                          >
                            {row.occupation_name}
                          </Link>
                        </td>
                        {/* 時給 */}
                        <SortCell value={row.hourly_wage}     isSort={sortKey === 'hourly_wage'}     idx={idx} sortRatio={sortRatio} fmt={fmtYen} barColor="#1a73e8" />
                        {/* 残業時間 */}
                        <SortCell value={row.overtime_hours}  isSort={sortKey === 'overtime_hours'}  idx={idx} sortRatio={sortRatio} fmt={fmtH}   highThreshold={20} highColor="#DB4437" barColor="#DB4437" />
                        {/* 実労働時間 */}
                        <SortCell value={row.scheduled_hours} isSort={sortKey === 'scheduled_hours'} idx={idx} sortRatio={sortRatio} fmt={fmtH}   barColor="#94A3B8" />
                        {/* 合計労働時間 */}
                        <SortCell value={row.total_hours}     isSort={sortKey === 'total_hours'}     idx={idx} sortRatio={sortRatio} fmt={fmtH}   highThreshold={180} highColor="#B45309" barColor="#B45309" />
                        {/* 推定年収 */}
                        <SortCell value={row.annual_income}   isSort={sortKey === 'annual_income'}   idx={idx} sortRatio={sortRatio} fmt={fmtWan} barColor="#1a73e8" />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* フッター */}
          {meta && !loading && (
            <div style={S.footer}>
              <span style={S.footerText}>
                出典: {meta.survey_group_name}（{meta.survey_year}年）　厚生労働省
              </span>
              <span style={S.footerText}>
                実労働時間 = 所定内労働時間　時給 = 所定内給与 ÷ 所定内時間
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
