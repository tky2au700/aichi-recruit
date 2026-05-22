'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, Info, Search, X, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface GrowthRow {
  occupation_name:  string
  occupation_slug:  string | null
  annual_income:    number | null
  base_income:      number | null
  growth_rate:      number
  growth_amount:    number | null
  monthly_wage:     number | null
  hourly_wage:      number | null
  workers:          number | null
}

interface ApiResponse {
  success:         boolean
  data:            GrowthRow[]
  latest_year:     number
  base_year:       number
  actual_years:    number
  available_years: number[]
  message?:        string
}

type SortKey = 'growth_rate' | 'growth_amount' | 'annual_income' | 'base_income' | 'monthly_wage'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const YEARS_OPTIONS = [
  { value: '1', label: '1年' },
  { value: '2', label: '2年' },
  { value: '3', label: '3年' },
  { value: '5', label: '5年' },
  { value: '10', label: '10年' },
]

const SORT_KEY_LABEL: Record<SortKey, string> = {
  growth_rate:   '年収増加率',
  growth_amount: '年収増加額',
  annual_income: '最新年収',
  base_income:   '基準年収',
  monthly_wage:  '月給',
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v).toLocaleString()}万円`
}
function fmtNum(v: number | null, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toFixed(1)}${suffix}`
}

function RankBadge({ rank }: { rank: number }) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700,
  }
  if (rank === 1) return <span style={{ ...base, background: '#FEF3C7', color: '#D97706' }}>1</span>
  if (rank === 2) return <span style={{ ...base, background: '#F1F5F9', color: '#64748B' }}>2</span>
  if (rank === 3) return <span style={{ ...base, background: '#FEF9C3', color: '#A16207' }}>3</span>
  return <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
}

// ---------------------------------------------------------------------------
// スタイル定数
// ---------------------------------------------------------------------------
const S = {
  page:      { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', sans-serif" },
  container: { maxWidth: 1100, margin: '0 auto', padding: '0 24px 56px' },
  hero:      { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '32px 0 24px' },
  heroInner: { maxWidth: 1100, margin: '0 auto', padding: '0 24px' },
  h1:        { fontSize: 26, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' },
  subtitle:  { fontSize: 13, color: '#64748B', marginTop: 6 },
  kpiGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, margin: '24px 0' },
  kpiCard:   { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  kpiLabel:  { fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em' },
  kpiValue:  { fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 6, fontVariantNumeric: 'tabular-nums' as const },
  filterBox: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 18px', margin: '20px 0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  filterRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const },
  filterLbl: { fontSize: 12, color: '#64748B', fontWeight: 600, minWidth: 52 },
  chip:      { padding: '5px 14px', borderRadius: 20, border: '1px solid #E2E8F0', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#374151', transition: 'all .15s', whiteSpace: 'nowrap' as const },
  chipActive:{ padding: '5px 14px', borderRadius: 20, border: '1px solid #0F9D58', fontSize: 12, cursor: 'pointer', background: '#0F9D58', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' as const },
  tableCard: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  tableHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #F1F5F9' },
  table:     { width: '100%', borderCollapse: 'collapse' as const },
  th:        { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' as const, whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const },
  thActive:  { padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#0F9D58', background: '#F0FDF4', borderBottom: '2px solid #0F9D58', textAlign: 'left' as const, whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const },
  td:        { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const },
  barWrap:   { width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 12px', background: '#fff', fontSize: 13, color: '#374151' },
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------
interface Props {
  initialYears?:      number
  initialSort?:       SortKey
  initialDir?:        SortDir
  pageHeading?:       string
  pageDescription?:   string
}

export function GrowthRankingClient({
  initialYears = 5,
  initialSort  = 'growth_rate',
  initialDir   = 'desc',
  pageHeading,
  pageDescription,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [data, setData]       = useState<GrowthRow[]>([])
  const [info, setInfo]       = useState<Pick<ApiResponse, 'latest_year' | 'base_year' | 'actual_years'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')

  const [years, setYears]     = useState(initialYears)
  const [sortKey, setSortKey] = useState<SortKey>(initialSort)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  // URL同期
  const pushUrl = useCallback((
    newYears: number, newSort: SortKey, newDir: SortDir
  ) => {
    const params = new URLSearchParams()
    if (newYears !== 5)              params.set('years', String(newYears))
    if (newSort  !== 'growth_rate')  params.set('sort',  newSort)
    if (newSort  !== 'growth_rate' && newDir !== 'desc') params.set('dir', newDir)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, pathname])

  // データ取得
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/salary/ranking/growth?years=${years}&_=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'エラー'); return }
        setData(json.data ?? [])
        if (json.latest_year) setInfo({ latest_year: json.latest_year, base_year: json.base_year, actual_years: json.actual_years })
        if (json.message) setError(json.message)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [years])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir: SortDir = sortDir === 'desc' ? 'asc' : 'desc'
      setSortDir(newDir)
      pushUrl(years, key, newDir)
    } else {
      setSortKey(key)
      setSortDir('desc')
      pushUrl(years, key, 'desc')
    }
  }

  // フィルター済み・ソート済みデータ
  const filtered = data
    .filter(r => !search || r.occupation_name.includes(search))
    .slice()
    .sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const topSortValue = filtered[0]?.[sortKey] as number | null ?? null

  // 動的見出し生成
  const currentSortLabel = SORT_KEY_LABEL[sortKey]
  const yearsLabel       = `${info?.actual_years ?? years}年間`
  const dynamicHeading   = `職種別平均${currentSortLabel}ランキング（${yearsLabel}）`
  const dynamicDesc      = info
    ? `${info.base_year}年から${info.latest_year}年の${info.actual_years}年間における職種別${currentSortLabel}データです。賃金構造基本統計調査に基づきます。`
    : null

  const displayHeading     = dynamicHeading
  const displayDescription = pageDescription ?? dynamicDesc

  // ソートアイコン
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: 3 }} />
    return sortDir === 'desc'
      ? <ChevronDown size={12} style={{ color: '#0F9D58', marginLeft: 3 }} />
      : <ChevronUp   size={12} style={{ color: '#0F9D58', marginLeft: 3 }} />
  }

  const COLUMNS: { key: SortKey; label: string }[] = [
    { key: 'growth_rate',   label: `増加率（${info?.actual_years ?? years}年間）` },
    { key: 'growth_amount', label: '増加額' },
    { key: 'annual_income', label: `${info?.latest_year ?? '最新'}年 年収` },
    { key: 'base_income',   label: `${info?.base_year ?? '基準'}年 年収` },
    { key: 'monthly_wage',  label: '月給' },
  ]

  return (
    <div style={S.page}>
      {/* ヘッダー帯 */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{displayHeading}</h1>
          <p style={S.subtitle}>
            {displayDescription ?? '複数年のデータをもとに年収の伸び率が高い職種を表示します。'}
          </p>
        </div>
      </div>

      <div style={S.container}>
        {/* KPI */}
        {info && !loading && filtered.length > 0 && (
          <div style={S.kpiGrid}>
            {[
              { label: `最大${SORT_KEY_LABEL.growth_rate}`, value: `+${data[0].growth_rate.toFixed(1)}%` },
              { label: `最大${SORT_KEY_LABEL.growth_amount}`, value: (data[0].growth_amount != null ? `+${fmtWan(data[0].growth_amount)}` : '−') },
              { label: '比較期間', value: `${info.base_year}〜${info.latest_year}年` },
              { label: '対象職種数', value: `${data.length}職種` },
            ].map(({ label, value }) => (
              <div key={label} style={S.kpiCard}>
                <div style={S.kpiLabel}>{label}</div>
                <div style={S.kpiValue}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* フィルター */}
        <div style={S.filterBox}>
          <div style={S.filterRow}>
            <span style={S.filterLbl}>比較期間</span>
            {YEARS_OPTIONS.map(o => (
              <button
                key={o.value}
                style={years === Number(o.value) ? S.chipActive : S.chip}
                onClick={() => {
                  const v = Number(o.value)
                  setYears(v)
                  pushUrl(v, sortKey, sortDir)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* テーブル */}
        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="#0F9D58" />
              {currentSortLabel}ランキング
              {!loading && (
                <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>
                  {filtered.length}職種
                </span>
              )}
            </span>
            {/* 検索 */}
            <div style={S.searchBox}>
              <Search size={14} color="#94A3B8" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="職種名で絞り込み..."
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: 160, color: '#374151' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                  <X size={13} color="#94A3B8" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 32 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 44, background: i % 2 === 0 ? '#F8FAFC' : '#fff', borderRadius: 4, marginBottom: 4 }} />
              ))}
            </div>
          ) : error && filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
              <Info size={20} style={{ marginBottom: 8, opacity: 0.6 }} />
              <p>{error}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <th style={S.th}>職種名</th>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        style={sortKey === col.key ? S.thActive : S.th}
                        onClick={() => handleSort(col.key)}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {col.label}<SortIcon k={col.key} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => {
                    const sortVal   = row[sortKey] as number | null
                    const sortRatio = topSortValue && sortVal != null ? Math.max(0, (sortVal / topSortValue) * 100) : 0
                    const isPos     = row.growth_rate >= 0

                    return (
                      <tr
                        key={row.occupation_name}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC')}
                      >
                        {/* 順位 */}
                        <td style={{ ...S.td, width: 48 }}><RankBadge rank={idx + 1} /></td>

                        {/* 職種名 */}
                        <td style={S.td}>
                          {row.occupation_slug ? (
                            <Link href={`/salary/occupation/${row.occupation_slug}`} className="occupation-link">
                              {row.occupation_name}
                            </Link>
                          ) : (
                            <span style={{ color: '#334155', fontWeight: 500 }}>{row.occupation_name}</span>
                          )}
                        </td>

                        {/* 増加率 */}
                        {(() => {
                          const isSort = sortKey === 'growth_rate'
                          return (
                            <td style={{ ...S.td, minWidth: 140 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 600,
                                fontSize: 13,
                                color: isSort
                                  ? (idx === 0 ? '#D97706' : isPos ? '#0F9D58' : '#EF4444')
                                  : (isPos ? '#0F9D58' : '#EF4444'),
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {isPos ? '+' : ''}{fmtNum(row.growth_rate, '%')}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#0F9D58', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}

                        {/* 増加額 */}
                        {(() => {
                          const isSort = sortKey === 'growth_amount'
                          const isGrowthPos = (row.growth_amount ?? 0) >= 0
                          return (
                            <td style={{ ...S.td, minWidth: 120 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 600,
                                fontSize: 13,
                                color: isSort
                                  ? (idx === 0 ? '#D97706' : isGrowthPos ? '#0F9D58' : '#EF4444')
                                  : (isGrowthPos ? '#0F9D58' : '#EF4444'),
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {isGrowthPos ? '+' : ''}{fmtWan(row.growth_amount)}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#0F9D58', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}

                        {/* 最新年収 */}
                        {(() => {
                          const isSort = sortKey === 'annual_income'
                          return (
                            <td style={{ ...S.td, minWidth: 120 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 400,
                                color: isSort ? (idx === 0 ? '#D97706' : '#1a73e8') : '#475569',
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

                        {/* 基準年収 */}
                        {(() => {
                          const isSort = sortKey === 'base_income'
                          return (
                            <td style={{ ...S.td, minWidth: 120 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 400,
                                color: isSort ? (idx === 0 ? '#D97706' : '#94A3B8') : '#475569',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {fmtWan(row.base_income)}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#94A3B8', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}

                        {/* 月給 */}
                        {(() => {
                          const isSort = sortKey === 'monthly_wage'
                          return (
                            <td style={{ ...S.td, minWidth: 110 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 400,
                                color: isSort ? (idx === 0 ? '#D97706' : '#1a73e8') : '#475569',
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>出典: 賃金構造基本統計調査（厚生労働省）</span>
          </div>
        </div>
      </div>
    </div>
  )
}
