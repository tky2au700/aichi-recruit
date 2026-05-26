'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, Users, Award, BarChart2, Search, X, ChevronUp, ChevronDown, ArrowUpDown, MapPin } from 'lucide-react'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface PrefectureRow {
  prefecture: string
  sex: string
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
}

interface Meta {
  survey_year: number
  dataset_id: number
  sex: string
  avg_income: number | null
  max_income: number | null
  total_workers: number | null
  prefecture_count: number
}

interface YearOption {
  survey_year: number
  dataset_id: number
}

interface ApiResponse {
  success: boolean
  data: PrefectureRow[]
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

const SEX_TO_PARAM:  Record<string, string> = { '男': 'male', '女': 'female' }
const PARAM_TO_SEX:  Record<string, string> = { male: '男', female: '女' }

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'overtime_hours' | 'hourly_wage' | 'workers'
type SortDir = 'asc' | 'desc'

const SORT_KEY_LABEL: Record<SortKey, string> = {
  annual_income:  '年収',
  monthly_wage:   '月給',
  annual_bonus:   '賞与',
  overtime_hours: '残業時間',
  hourly_wage:    '時給',
  workers:        '労働者数',
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function fmtWan(val: number | null) {
  if (val == null) return '−'
  return `${Math.round(val).toLocaleString()}万円`
}
function fmtNum(val: number | null, suffix = '') {
  if (val == null) return '−'
  return `${Number(val).toFixed(1)}${suffix}`
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
export function PrefectureClient() {
  const router   = useRouter()
  const pathname = usePathname()

  const [data, setData]       = useState<PrefectureRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [years, setYears]     = useState<YearOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [sex, setSex]               = useState('計')
  const [surveyYear, setSurveyYear] = useState<number | null>(null)
  const [search, setSearch]         = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('annual_income')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  const pushUrl = useCallback((newSex: string, newYear: number | null, newSort: SortKey = 'annual_income', newDir: SortDir = 'desc') => {
    const params = new URLSearchParams()
    const sexParam = SEX_TO_PARAM[newSex]
    if (sexParam)                                         params.set('sex',  sexParam)
    if (newYear !== null)                                 params.set('year', String(newYear))
    if (newSort !== 'annual_income')                      params.set('sort', newSort)
    if (newSort !== 'annual_income' && newDir !== 'desc') params.set('dir',  newDir)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname])

  const fetchData = useCallback(async (_sex: string, _year: number | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sex: _sex })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking/prefecture?${params}`)
      const json: ApiResponse = await res.json()
      if (!json.success) { setError(json.message ?? 'エラーが発生しました'); return }
      setData(json.data)
      setMeta(json.meta)
      if (json.years.length > 0) {
        const seen = new Set<number>()
        const uniqueYears = json.years.filter((y: YearOption) => {
          if (seen.has(y.survey_year)) return false
          seen.add(y.survey_year)
          return true
        })
        setYears(uniqueYears)
        if (_year === null && json.meta) setSurveyYear(json.meta.survey_year)
      }
    } catch {
      setError('データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(sex, surveyYear) }, [sex, surveyYear, fetchData])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir: SortDir = sortDir === 'desc' ? 'asc' : 'desc'
      setSortDir(newDir)
      pushUrl(sex, surveyYear, key, newDir)
    } else {
      setSortKey(key)
      setSortDir('desc')
      pushUrl(sex, surveyYear, key, 'desc')
    }
  }

  const filteredData = data
    .filter(r => search === '' || r.prefecture.includes(search))
    .sort((a, b) => {
      const av = a[sortKey as keyof PrefectureRow] as number | null
      const bv = b[sortKey as keyof PrefectureRow] as number | null
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
    page:       { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', sans-serif" },
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

  const sexLabel     = sex !== '計' ? ({ '男': '男性', '女': '女性' }[sex] ?? null) : null
  const yearStr      = surveyYear ? `${surveyYear}年` : (meta?.survey_year ? `${meta.survey_year}年` : '')
  const sortLabel    = SORT_KEY_LABEL[sortKey]
  const dynamicHeading = sexLabel
    ? `${sexLabel}の都道府県別平均${sortLabel}ランキング${yearStr}`
    : `都道府県別平均${sortLabel}ランキング${yearStr}`

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{dynamicHeading}</h1>
          <p style={S.subtitle}>
            {yearStr}調査の賃金構造基本統計調査に基づく都道府県別平均{sortLabel}ランキングデータです。
          </p>
        </div>
      </div>

      <div style={S.container}>
        {/* KPIカード */}
        {meta && !loading && (
          <div style={S.kpiGrid}>
            {[
              { icon: <Award size={15} color="#1a73e8" />, label: '最高年収', value: fmtWan(meta.max_income), sub: 'トップ都道府県' },
              { icon: <BarChart2 size={15} color="#0F9D58" />, label: '全国平均年収', value: fmtWan(meta.avg_income), sub: `${meta.prefecture_count}都道府県の平均` },
              { icon: <MapPin size={15} color="#F4B400" />, label: '集計都道府県数', value: `${meta.prefecture_count}都道府県`, sub: `${meta.survey_year}年調査` },
              { icon: <Users size={15} color="#DB4437" />, label: '労働者数', value: meta.total_workers ? `${(meta.total_workers / 10000).toFixed(0)}万人` : '−', sub: '対象労働者の合計' },
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
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>調査年</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {years.map(y => (
                <button
                  key={y.survey_year}
                  style={surveyYear === y.survey_year ? S.chipActive : S.chip}
                  onClick={() => { setSurveyYear(y.survey_year); pushUrl(sex, y.survey_year, sortKey, sortDir) }}
                >
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
                <button
                  key={o.value}
                  style={sex === o.value
                    ? { ...S.chipActive,
                        border: o.value === '男' ? '1.5px solid #1a73e8' : o.value === '女' ? '1.5px solid #DB4437' : '1.5px solid #1a73e8',
                        color:  o.value === '男' ? '#1a73e8' : o.value === '女' ? '#DB4437' : '#1a73e8',
                        background: o.value === '男' ? '#EBF3FE' : o.value === '女' ? '#FCECEA' : '#EBF3FE',
                      }
                    : S.chip}
                  onClick={() => { setSex(o.value); pushUrl(o.value, surveyYear, sortKey, sortDir) }}
                >
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
              <span>{sortLabel}ランキング</span>
              {!loading && (
                <span style={S.badge}>{filteredData.length} 都道府県</span>
              )}
            </div>
            <div style={S.searchWrap}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="都道府県名で絞り込み..."
                style={S.searchInput}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                >
                  <X size={13} color="#94A3B8" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>データを読み込み中...</div>
          ) : error ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#EF4444', fontSize: 14 }}>{error}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 40 }}>#</th>
                    <th style={{ ...S.th, minWidth: 100 }}>都道府県</th>
                    <Th label="推定年収" k="annual_income" />
                    <Th label="月給" k="monthly_wage" />
                    <Th label="年間賞与" k="annual_bonus" />
                    <Th label="時給換算" k="hourly_wage" />
                    <Th label="残業時間" k="overtime_hours" />
                    <Th label="労働者数" k="workers" />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const sortVal = row[sortKey] as number | null
                    const barPct  = topSortValue && sortVal != null ? Math.round((sortVal / topSortValue) * 100) : 0
                    return (
                      <tr key={row.prefecture} style={{ transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <td style={{ ...S.td, textAlign: 'center', width: 40 }}>
                          <RankBadge rank={idx + 1} />
                        </td>
                        <td style={S.td}>
                          <Link
                            href={`/salary/prefecture/${encodeURIComponent(row.prefecture)}`}
                            style={{ color: '#1a73e8', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <MapPin size={12} color="#94A3B8" />
                            {row.prefecture}
                          </Link>
                        </td>
                        <td style={S.td}>
                          <div style={{ color: '#1a73e8', fontWeight: 600 }}>{fmtWan(row.annual_income)}</div>
                          {sortKey === 'annual_income' && (
                            <div style={S.barWrap}>
                              <div style={{ width: `${barPct}%`, height: '100%', background: '#1a73e8', borderRadius: 4 }} />
                            </div>
                          )}
                        </td>
                        <td style={S.td}>{fmtWan(row.monthly_wage)}</td>
                        <td style={S.td}>{fmtWan(row.annual_bonus)}</td>
                        <td style={S.td}>{row.hourly_wage != null ? `${row.hourly_wage.toLocaleString()}円` : '−'}</td>
                        <td style={S.td}>{fmtNum(row.overtime_hours, 'h')}</td>
                        <td style={S.td}>
                          {row.workers != null
                            ? row.workers >= 10000
                              ? `${(row.workers / 10000).toFixed(1)}万人`
                              : `${row.workers.toLocaleString()}人`
                            : '−'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={S.footer}>
            <span style={S.footerText}>出典: 賃金構造基本統計調査（e-Stat）{meta?.survey_year}年</span>
            <span style={S.footerText}>{filteredData.length} 件表示</span>
          </div>
        </div>
      </div>
    </div>
  )
}
