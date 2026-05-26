'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { TrendingUp, Users, Award, BarChart2, Search, X, ChevronUp, ChevronDown, ArrowUpDown, Info } from 'lucide-react'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface RoleRow {
  role_name: string
  sex: string
  enterprise_size: string
  tenure_category: string
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
}

interface Meta {
  survey_year: number
  dataset_id: number
  group_id: number
  sex: string
  enterprise_size: string
  tenure_category: string
  survey_group_name: string
  survey_table_name: string | null
  avg_income: number | null
  max_income: number | null
  total_workers: number | null
  role_count: number
}

interface YearOption {
  survey_year: number
  dataset_id: number
  group_id: number
}

interface ApiResponse {
  success: boolean
  data: RoleRow[]
  years: YearOption[]
  enterprise_sizes: string[]
  tenure_categories: string[]
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

// DB値 ↔ URLパラメーター マッピング（occupation と同じ設計）
const SEX_TO_PARAM:  Record<string, string> = { '男': 'male', '女': 'female' }
const PARAM_TO_SEX:  Record<string, string> = { male: '男', female: '女' }
const SIZE_TO_PARAM: Record<string, string> = {
  '1,000人以上': 'large', '100～999人': 'medium', '10～99人': 'small', '10人以上': 'all',
}
const PARAM_TO_SIZE: Record<string, string> = {
  large: '1,000人以上', medium: '100～999人', small: '10～99人', all: '10人以上',
}

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus'
type SortDir = 'asc' | 'desc'

const SORT_KEY_LABEL: Record<SortKey, string> = {
  annual_income: '年収',
  monthly_wage:  '月給',
  annual_bonus:  '賞与',
}

// ---------------------------------------------------------------------------
// ユーティリティ（occupation と同じ）
// ---------------------------------------------------------------------------
function fmtWan(val: number | null) {
  if (val == null) return '−'
  return `${Math.round(val).toLocaleString()}万円`
}

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
// メインコンポーネント
// ---------------------------------------------------------------------------
interface Props {
  initialSex?:      string | undefined
  initialSize?:     string | undefined
  initialTenure?:   string | undefined
  initialYear?:     number | null
  initialSort?:     SortKey
  initialDir?:      SortDir
  pageHeading?:     string
  pageDescription?: string
}

export function RoleRankingClient({
  initialSex, initialSize, initialTenure, initialYear, initialSort, initialDir, pageHeading, pageDescription
}: Props = {}) {
  const router   = useRouter()
  const pathname = usePathname()

  const [data, setData]       = useState<RoleRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [years, setYears]     = useState<YearOption[]>([])
  const [sizes, setSizes]     = useState<string[]>([])
  const [tenures, setTenures] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [sex,          setSex]          = useState(initialSex    ? (PARAM_TO_SEX[initialSex]   ?? '計')      : '計')
  const [size,         setSize]         = useState(initialSize   ? (PARAM_TO_SIZE[initialSize] ?? '10人以上') : '10人以上')
  const [tenure,       setTenure]       = useState(initialTenure ?? '勤続年数計')
  const [surveyYear,   setSurveyYear]   = useState<number | null>(initialYear ?? null)
  const [search,       setSearch]       = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>(initialSort ?? 'annual_income')
  const [sortDir,      setSortDir]      = useState<SortDir>(initialDir  ?? 'desc')

  const pushUrl = useCallback((
    newSex: string, newSize: string, newTenure: string, newYear: number | null,
    newSort: SortKey = 'annual_income', newDir: SortDir = 'desc'
  ) => {
    const params = new URLSearchParams()
    const sexParam  = SEX_TO_PARAM[newSex]
    const sizeParam = SIZE_TO_PARAM[newSize]
    if (sexParam)                                          params.set('sex',    sexParam)
    if (sizeParam)                                         params.set('size',   sizeParam)
    if (newTenure && newTenure !== '勤続年数計')           params.set('tenure', encodeURIComponent(newTenure))
    if (newYear !== null)                                  params.set('year',   String(newYear))
    if (newSort !== 'annual_income')                       params.set('sort',   newSort)
    if (newSort !== 'annual_income' && newDir !== 'desc')  params.set('dir',    newDir)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, pathname])

  const fetchData = useCallback(async (_sex: string, _size: string, _tenure: string, _year: number | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sex: _sex, enterprise_size: _size, tenure_category: _tenure })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking/role?${params}`)
      const json: ApiResponse = await res.json()
      if (!json.success) { setError(json.message ?? 'エラーが発生しました'); return }
      setData(json.data)
      setMeta(json.meta)
      if (json.years?.length > 0) {
        const seen = new Set<number>()
        const uniqueYears = json.years.filter(y => {
          if (seen.has(y.survey_year)) return false
          seen.add(y.survey_year)
          return true
        })
        setYears(uniqueYears)
        if (_year === null && json.meta) setSurveyYear(json.meta.survey_year)
      }
      if (json.enterprise_sizes?.length > 0) setSizes(json.enterprise_sizes)
      if (json.tenure_categories?.length > 0) setTenures(json.tenure_categories)
    } catch {
      setError('データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(sex, size, tenure, surveyYear) }, [sex, size, tenure, surveyYear, fetchData])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir: SortDir = sortDir === 'desc' ? 'asc' : 'desc'
      setSortDir(newDir)
      pushUrl(sex, size, tenure, surveyYear, key, newDir)
    } else {
      setSortKey(key)
      setSortDir('desc')
      pushUrl(sex, size, tenure, surveyYear, key, 'desc')
    }
  }

  const filteredData = data
    .filter(r => search === '' || r.role_name.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const topSortValue = filteredData[0]?.[sortKey] ?? null

  // ---------------------------------------------------------------------------
  // スタイル定数（occupation と完全同一）
  // ---------------------------------------------------------------------------
  const S = {
    page:        { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', 'Google Sans', sans-serif" },
    container:   { maxWidth: 1100, margin: '0 auto', padding: '0 24px 48px' },
    hero:        { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '32px 0 24px' },
    heroInner:   { maxWidth: 1100, margin: '0 auto', padding: '0 24px' },
    h1:          { fontSize: 26, fontWeight: 700, color: '#1E293B', margin: 0, letterSpacing: '-0.3px' },
    subtitle:    { fontSize: 13, color: '#64748B', marginTop: 6 },
    kpiGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, margin: '24px 0' },
    kpiCard:     { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    kpiLabel:    { fontSize: 12, color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
    kpiValue:    { fontSize: 22, fontWeight: 700, color: '#1E293B', marginTop: 8 },
    kpiSub:      { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    filterBar:   { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'flex-start', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    filterGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    filterLabel: { fontSize: 12, color: '#64748B', fontWeight: 500 },
    chipActive:  { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #1a73e8', background: '#EBF3FE', color: '#1a73e8', transition: 'all .15s' },
    chip:        { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', transition: 'all .15s' },
    divider:     { width: 1, height: 28, background: '#E2E8F0', alignSelf: 'center' as const },
    tableCard:   { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    tableHead:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' },
    tableTitle:  { fontSize: 14, fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 },
    badge:       { fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
    searchWrap:  { position: 'relative' as const },
    searchInput: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 32px 7px 32px', fontSize: 13, color: '#1E293B', outline: 'none', width: 200 },
    table:       { width: '100%', borderCollapse: 'collapse' as const },
    th:          { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', textAlign: 'left' as const, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const },
    td:          { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const },
    barWrap:     { width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
    footer:      { padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    footerText:  { fontSize: 11, color: '#94A3B8' },
  }

  // ソートヘッダーコンポーネント
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

  // 動的見出し（occupation と同じロジック）
  const sexLabelMap:  Record<string, string> = { '男': '男性', '女': '女性' }
  const sizeLabelMap: Record<string, string> = {
    '1000人以上': '大企業（1000人以上）', '100～999人': '中規模企業（100〜999人）', '10～99人': '小規模企業（10〜99人）',
  }
  const currentSexLabel    = sex    !== '計'       ? (sexLabelMap[sex]   ?? null) : null
  const currentSizeLabel   = size   !== '10人以上' ? (sizeLabelMap[size] ?? null) : null
  const currentTenureLabel = tenure !== '勤続年数計' ? tenure                      : null
  const currentYearStr     = surveyYear ? `${surveyYear}年` : (meta?.survey_year ? `${meta.survey_year}年` : '')
  const currentSortLabel   = SORT_KEY_LABEL[sortKey]

  const baseTitle = `役職別平均${currentSortLabel}ランキング${currentYearStr}`
  let dynamicHeading: string
  if (currentSizeLabel) {
    dynamicHeading = `${currentSizeLabel}の${baseTitle}${currentSexLabel ? `・${currentSexLabel}` : ''}`
  } else if (currentSexLabel) {
    dynamicHeading = `${currentSexLabel}の${baseTitle}`
  } else if (currentTenureLabel) {
    dynamicHeading = `勤続${currentTenureLabel}の${baseTitle}`
  } else {
    dynamicHeading = baseTitle
  }

  return (
    <div style={S.page}>
      {/* ヘッダー帯 */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>
            <TrendingUp size={20} color="#1a73e8" style={{ verticalAlign: 'middle', marginRight: 8 }} />
            {pageHeading ?? dynamicHeading}
          </h1>
          {pageDescription ? (
            <p style={S.subtitle}>{pageDescription}</p>
          ) : meta ? (
            <p style={S.subtitle}>
              {meta.survey_group_name}
              {meta.survey_table_name && <span style={{ color: '#94A3B8' }}>　{meta.survey_table_name}</span>}
              <span style={{ marginLeft: 12, color: '#94A3B8' }}>{meta.survey_year}年調査</span>
            </p>
          ) : (
            <p style={S.subtitle}>賃金構造基本統計調査に基づく役職別データ</p>
          )}
        </div>
      </div>

      <div style={S.container}>
        {/* KPIカード */}
        {meta && !loading && (
          <div style={S.kpiGrid}>
            {[
              { icon: <Award    size={15} color="#1a73e8" />, label: '最高年収',    value: fmtWan(meta.max_income),  sub: 'トップ役職' },
              { icon: <BarChart2 size={15} color="#0F9D58" />, label: '平均年��',   value: fmtWan(meta.avg_income),  sub: `${meta.role_count}役職の平均` },
              { icon: <TrendingUp size={15} color="#F4B400" />, label: '集計役職数', value: `${meta.role_count}役職`, sub: `${meta.survey_year}年調査` },
              { icon: <Users    size={15} color="#DB4437" />, label: '労働者数',    value: meta.total_workers ? `${(meta.total_workers / 10000).toFixed(0)}万人` : '−', sub: '対象労働者の合計' },
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
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>調査年</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {years.map(y => (
                <button
                  key={y.survey_year}
                  style={surveyYear === y.survey_year ? S.chipActive : S.chip}
                  onClick={() => { setSurveyYear(y.survey_year); pushUrl(sex, size, tenure, y.survey_year, sortKey, sortDir) }}
                >
                  {y.survey_year}年
                </button>
              ))}
            </div>
          </div>

          <div style={S.divider} />

          {/* 性別 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>性別</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {SEX_OPTIONS.map(o => (
                <button
                  key={o.value}
                  style={sex === o.value
                    ? { ...S.chipActive,
                        border:     o.value === '女' ? '1.5px solid #DB4437' : '1.5px solid #1a73e8',
                        color:      o.value === '女' ? '#DB4437' : '#1a73e8',
                        background: o.value === '女' ? '#FCECEA' : '#EBF3FE',
                      }
                    : S.chip}
                  onClick={() => { setSex(o.value); pushUrl(o.value, size, tenure, surveyYear, sortKey, sortDir) }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div style={S.divider} />

          {/* 企業規模 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>企業規模</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {sizes.map((s, i) => (
                <button
                  key={`size-${i}-${s}`}
                  style={size === s ? S.chipActive : S.chip}
                  onClick={() => { setSize(s); pushUrl(sex, s, tenure, surveyYear, sortKey, sortDir) }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={S.divider} />

          {/* 勤続年数 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>勤続年数</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tenures.map((t, i) => (
                <button
                  key={`tenure-${i}-${t}`}
                  style={tenure === t ? S.chipActive : S.chip}
                  onClick={() => { setTenure(t); pushUrl(sex, size, t, surveyYear, sortKey, sortDir) }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* テーブルカード */}
        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <div style={S.tableTitle}>
              <span>{currentSortLabel}ランキング</span>
              {!loading && (
                <span style={S.badge}>{filteredData.length} 役職</span>
              )}
            </div>
            <div style={S.searchWrap}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="役職名で絞り込み..."
                style={S.searchInput}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* テーブル本体 */}
          {loading ? (
            <div style={{ padding: 32 }}>
              {[...Array(6)].map((_, i) => (
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
              {data.length === 0 ? 'データがありません。管理画面からXLSXをインポートしてください。' : '該当する役職はありません。'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 48, cursor: 'default' }}>#</th>
                    <th style={{ ...S.th, minWidth: 140, cursor: 'default' }}>役職</th>
                    <Th label="推定年収"     k="annual_income" />
                    <Th label="月給（所定内）" k="monthly_wage" />
                    <Th label="年間賞与"     k="annual_bonus" />
                    <th style={{ ...S.th, cursor: 'default' }}>労働者数</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const sortVal   = row[sortKey] as number | null
                    const sortRatio = topSortValue && sortVal ? (sortVal / topSortValue) * 100 : 0
                    const isAboveAvg = sortVal != null && meta?.avg_income != null && sortVal > meta.avg_income
                    return (
                      <tr
                        key={`${row.role_name}-${idx}`}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EBF3FE')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC')}
                      >
                        {/* 順位 */}
                        <td style={{ ...S.td, width: 48 }}>
                          <RankBadge rank={idx + 1} />
                        </td>
                        {/* 役職名 */}
                        <td style={S.td}>
                          <Link
                            href={`/salary/role/${encodeURIComponent(row.role_name)}`}
                            className="occupation-link"
                          >
                            {row.role_name}
                          </Link>
                        </td>
                        {/* 推定年収 */}
                        {(() => {
                          const isSort = sortKey === 'annual_income'
                          return (
                            <td style={{ ...S.td, minWidth: 140 }}>
                              <span style={{
                                fontWeight: 700, fontSize: 13,
                                color: isSort ? (idx === 0 ? '#D97706' : isAboveAvg ? '#1a73e8' : '#374151') : '#475569',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {fmtWan(row.annual_income)}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#1a73e8', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}
                        {/* 月給 */}
                        {(() => {
                          const isSort = sortKey === 'monthly_wage'
                          return (
                            <td style={{ ...S.td, minWidth: 120 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 400, fontSize: 13,
                                color: isSort ? (idx === 0 ? '#D97706' : isAboveAvg ? '#1a73e8' : '#374151') : '#475569',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {fmtWan(row.monthly_wage)}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#1a73e8', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}
                        {/* 年間賞与 */}
                        {(() => {
                          const isSort = sortKey === 'annual_bonus'
                          return (
                            <td style={{ ...S.td, minWidth: 110 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 400, fontSize: 13,
                                color: isSort ? (idx === 0 ? '#D97706' : '#1a73e8') : '#475569',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {fmtWan(row.annual_bonus)}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#1a73e8', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}
                        {/* 労働者数 */}
                        <td style={S.td}>
                          <span style={{ color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                            {row.workers != null ? `${row.workers.toLocaleString()}人` : '−'}
                          </span>
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
              <span style={S.footerText}>
                出典: {meta.survey_group_name}（{meta.survey_year}年）　厚生労働省
              </span>
              <span style={S.footerText}>
                推定年収 = 月給 × 12 + 年間賞与　単位: 千円→万円換算
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
