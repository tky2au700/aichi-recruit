'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, ChevronUp, ChevronDown, ArrowUpDown, Info } from 'lucide-react'
import { RankingBarRace } from '@/components/ranking-bar-race'

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------
interface RankingRow {
  occupation_name: string
  occupation_slug: string | null
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
}

interface Meta {
  survey_year: number
  dataset_id: number
  type: string
  sex: string
  enterprise_size: string
  sort_col: string
  avg_income: number | null
  max_income: number | null
  max_bonus: number | null
  max_hourly: number | null
  occupation_count: number
}

interface YearOption { survey_year: number; dataset_id: number }

interface ApiResponse {
  success: boolean
  data: RankingRow[]
  years: YearOption[]
  meta: Meta | null
  message?: string
}

export type RankingType = 'female' | 'male' | 'bonus' | 'hourly-wage' | 'high-income-low-overtime' | 'high-income-large-workforce'

interface RankingPageConfig {
  type: RankingType
  title: string
  description: string
  sortKey: keyof RankingRow
  sortLabel: string
  primaryColor: string
  primaryBg: string
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
// API側で万円変換済みのため、そのまま表示
function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v).toLocaleString()}万円`
}
function fmtFixed(v: number | null, d = 1, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toFixed(d)}${suffix}`
}

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours' | 'hourly_wage' | 'workers' | '__composite'
type SortDir = 'asc' | 'desc'

function RankBadge({ rank }: { rank: number }) {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700 }
  if (rank === 1) return <span style={{ ...base, background: '#FEF3C7', color: '#D97706' }}>1</span>
  if (rank === 2) return <span style={{ ...base, background: '#F1F5F9', color: '#64748B' }}>2</span>
  if (rank === 3) return <span style={{ ...base, background: '#FEF9C3', color: '#A16207' }}>3</span>
  return <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------
export function RankingPageClient({ config }: { config: RankingPageConfig }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  // URLパラメータから初期値を復元
  const initYear    = searchParams.get('year') ? Number(searchParams.get('year')) : null
  const initSort    = (searchParams.get('sort') ?? (config.type === 'high-income-large-workforce' ? '__composite' : config.sortKey)) as SortKey
  const initDir     = (searchParams.get('dir') === 'asc' ? 'asc' : 'desc') as SortDir

  const [data, setData]         = useState<RankingRow[]>([])
  const [meta, setMeta]         = useState<Meta | null>(null)
  const [years, setYears]       = useState<YearOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [surveyYear, setSurveyYear] = useState<number | null>(initYear)
  const [search, setSearch]     = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>(initSort)
  const [sortDir, setSortDir]   = useState<SortDir>(initDir)

  // URL同期
  const pushUrl = useCallback((year: number | null, key: SortKey, dir: SortDir) => {
    const p = new URLSearchParams()
    if (year) p.set('year', String(year))
    if (key !== config.sortKey as string && key !== '__composite') p.set('sort', key)
    if (dir === 'asc') p.set('dir', 'asc')
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, config.sortKey])

  const fetchData = useCallback(async (_year: number | null) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ type: config.type })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking?${params}`)
      const json: ApiResponse = await res.json()
      if (!json.success) { setError(json.message ?? 'エラー'); return }
      setData(json.data)
      setMeta(json.meta)
      if (json.years.length > 0) {
        // survey_year の重複を排除（同一年が複数グループから来た場合の保険）
        const seen = new Set<number>()
        const uniqueYears = json.years.filter((y: YearOption) => {
          if (seen.has(y.survey_year)) return false
          seen.add(y.survey_year)
          return true
        })
        setYears(uniqueYears)
        if (_year === null && json.meta) setSurveyYear(json.meta.survey_year)
      }
    } catch { setError('データ取得に失敗しました') }
    finally  { setLoading(false) }
  }, [config.type])

  useEffect(() => { fetchData(surveyYear) }, [surveyYear, fetchData])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir: SortDir = sortDir === 'desc' ? 'asc' : 'desc'
      setSortDir(newDir)
      pushUrl(surveyYear, key, newDir)
    } else {
      setSortKey(key)
      setSortDir('desc')
      pushUrl(surveyYear, key, 'desc')
    }
  }

  // ソート用: 生の複合スコア（workers千人 × annual_income万円）
  const compositeScore = (r: RankingRow) =>
    (r.workers != null && r.annual_income != null) ? r.workers * r.annual_income : null

  // 表示用: 全データのmaxで正規化し平方根カーブで0〜100に圧縮
  const maxCompositeRaw = useMemo(() => {
    let max = 0
    for (const r of data) { const s = compositeScore(r); if (s != null && s > max) max = s }
    return max
  }, [data])
  const normalizedScore = (r: RankingRow): number | null => {
    const raw = compositeScore(r)
    if (raw == null || maxCompositeRaw === 0) return null
    return Math.round(Math.sqrt(raw / maxCompositeRaw) * 100)
  }

  const filtered = data
    .filter(r => search === '' || r.occupation_name.includes(search))
    .sort((a, b) => {
      const av = sortKey === '__composite' ? compositeScore(a) : a[sortKey] as number | null
      const bv = sortKey === '__composite' ? compositeScore(b) : b[sortKey] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const topVal = sortKey === '__composite'
    ? compositeScore(filtered[0] ?? {} as RankingRow)
    : (filtered[0]?.[config.sortKey] as number | null) ?? null

  // ---- スタイル ----
  const pc = config.primaryColor
  const pb = config.primaryBg

  const S = {
    page:       { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', sans-serif" },
    container:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px 56px' },
    hero:       { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '32px 0 24px' },
    heroInner:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px' },
    h1:         { fontSize: 26, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' },
    subtitle:   { fontSize: 13, color: '#64748B', marginTop: 6, lineHeight: 1.6 },
    kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, margin: '24px 0' },
    kpiCard:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    kpiLabel:   { fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em' },
    kpiValue:   { fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 6, fontVariantNumeric: 'tabular-nums' as const },
    filterBar:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 18px', marginBottom: 18, display: 'flex', flexWrap: 'wrap' as const, gap: 12, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    filterLabel:{ fontSize: 12, color: '#64748B', fontWeight: 500 },
    chipActive: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${pc}`, background: pb, color: pc },
    chip:       { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569' },
    tableCard:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    tableHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #F1F5F9' },
    tableTitle: { fontSize: 14, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 },
    badge:      { fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
    searchWrap: { position: 'relative' as const },
    searchInput:{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 32px', fontSize: 13, color: '#1E293B', outline: 'none', width: 200 },
    table:      { width: '100%', borderCollapse: 'collapse' as const },
    th:         { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' as const, whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const },
    td:         { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const },
    barWrap:    { width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
    footer:     { padding: '10px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    footerText: { fontSize: 11, color: '#94A3B8' },
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    const isActive = sortKey === k
    return (
      <th style={{ ...S.th, color: isActive ? pc : '#64748B' }} onClick={() => handleSort(k)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          {isActive
            ? sortDir === 'desc' ? <ChevronDown size={13} style={{ color: pc }} /> : <ChevronUp size={13} style={{ color: pc }} />
            : <ArrowUpDown size={12} style={{ color: '#CBD5E1', opacity: 0.7 }} />}
        </span>
      </th>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{config.title}</h1>
          {meta ? (
            <p style={S.subtitle}>{config.description}　調査年: {meta.survey_year}年</p>
          ) : (
            <p style={S.subtitle}>{config.description}</p>
          )}
          {/* バーチャートレース */}
          {!loading && filtered.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <RankingBarRace
                data={filtered.slice(0, 10).map(r => ({
                  name:  r.occupation_name,
                  value: (r[config.sortKey] as number | null) ?? 0,
                  color: pc,
                }))}
                title={config.title}
                surveyYear={meta?.survey_year ?? surveyYear}
                unit="万円"
                primaryColor={pc}
              />
            </div>
          )}
        </div>
      </div>

      <div style={S.container}>
        {/* KPI */}
        {meta && !loading && (
          <div style={S.kpiGrid}>
            {[
              { label: `${config.sortLabel} 1位`, value: config.sortKey === 'annual_bonus' ? fmtWan(meta.max_bonus) : config.sortKey === 'hourly_wage' ? `${meta.max_hourly?.toLocaleString() ?? '−'}円/h` : fmtWan(meta.max_income) },
              { label: '全職種平均年収', value: fmtWan(meta.avg_income) },
              { label: '集計職種数', value: `${meta.occupation_count}職種` },
              { label: '表示件数', value: `${filtered.length}件` },
            ].map(({ label, value }) => (
              <div key={label} style={S.kpiCard}>
                <div style={S.kpiLabel}>{label}</div>
                <div style={S.kpiValue}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* フィルターバー */}
        <div style={S.filterBar}>
          <span style={S.filterLabel}>調査年</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {years.map(y => (
              <button key={y.survey_year} style={surveyYear === y.survey_year ? S.chipActive : S.chip} onClick={() => { setSurveyYear(y.survey_year); pushUrl(y.survey_year, sortKey, sortDir) }}>
                {y.survey_year}年
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 24, background: '#E2E8F0', margin: '0 4px' }} />
          <div style={{ position: 'relative' as const, marginLeft: 'auto' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="職種名で絞り込み..." style={S.searchInput} />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* テーブル */}
        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <div style={S.tableTitle}>
              {config.title}
              {!loading && <span style={S.badge}>{filtered.length}職種</span>}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 32 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 44, background: i % 2 === 0 ? '#F8FAFC' : '#fff', borderRadius: 4, marginBottom: 4 }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#EF4444', fontSize: 14 }}>
              <Info size={20} style={{ marginBottom: 8, opacity: 0.6 }} /><p>{error}</p>
            </div>
          ) : filtered.length === 0 ? (
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
                    <Th label="推定年収"   k="annual_income" />
                    {config.type === 'high-income-large-workforce' && <Th label="複合スコア" k="__composite" />}
                    <Th label="労働者数"   k="workers" />
                    <Th label="年間賞与"   k="annual_bonus" />
                    <Th label="時給換算"   k="hourly_wage" />
                    <Th label="平均年齢"   k="age" />
                    <Th label="勤続年数"   k="tenure_years" />
                    <Th label="残業時間/月" k="overtime_hours" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => {
                    const isTop     = idx === 0
                    const rowScore  = compositeScore(row)
                    const sortVal   = sortKey === '__composite' ? rowScore : row[sortKey] as number | null
                    const ratio     = topVal && sortVal ? (sortVal / topVal) * 100 : 0
                    return (
                      <tr key={`${row.occupation_name}-${idx}`}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                        onMouseEnter={e => (e.currentTarget.style.background = pb)}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC')}
                      >
                        <td style={{ ...S.td, width: 48 }}><RankBadge rank={idx + 1} /></td>
                        <td style={{ ...S.td }}>
                          <Link
                            href={`/salary/occupation/${row.occupation_slug ?? encodeURIComponent(row.occupation_name)}`}
                            className="occupation-link"
                          >
                            {row.occupation_name}
                          </Link>
                        </td>
                        <td style={{ ...S.td, minWidth: 130 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: isTop ? '#D97706' : '#1a73e8', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtWan(row.annual_income)}
                          </span>
                          <div style={S.barWrap}>
                            <div style={{ width: `${config.sortKey === 'annual_income' ? ratio : (row.annual_income && meta?.max_income ? (row.annual_income / meta.max_income) * 100 : 0)}%`, height: '100%', background: '#1a73e8', borderRadius: 4 }} />
                          </div>
                        </td>
                        {config.type === 'high-income-large-workforce' && (() => {
                          const isSort = sortKey === '__composite'
                          const norm   = normalizedScore(row)
                          // バー幅はそのまま0〜100スコアを使用（100が満点）
                          const barW   = isSort && norm != null ? norm : 0
                          const displayScore = norm != null ? `${norm}` : '−'
                          return (
                            <td style={{ ...S.td, color: isSort ? (isTop ? '#D97706' : '#1a73e8') : '#475569', fontWeight: isSort && isTop ? 700 : isSort ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
                              {displayScore}
                              {isSort && (
                                <div style={S.barWrap}><div style={{ width: `${barW}%`, height: '100%', background: isTop ? '#F4B400' : '#1a73e8', borderRadius: 4, transition: 'width .3s' }} /></div>
                              )}
                            </td>
                          )
                        })()}
                        <td style={{ ...S.td, color: config.sortKey === 'workers' && isTop ? '#D97706' : '#475569', fontWeight: config.sortKey === 'workers' && isTop ? 700 : 400 }}>
                          {row.workers != null ? `${row.workers.toLocaleString()}千人` : '−'}
                          {config.sortKey === 'workers' && (
                            <div style={S.barWrap}><div style={{ width: `${ratio}%`, height: '100%', background: pc, borderRadius: 4 }} /></div>
                          )}
                        </td>
                        <td style={{ ...S.td, color: config.sortKey === 'annual_bonus' && isTop ? '#D97706' : '#475569', fontWeight: config.sortKey === 'annual_bonus' && isTop ? 700 : 400 }}>
                          {fmtWan(row.annual_bonus)}
                          {config.sortKey === 'annual_bonus' && (
                            <div style={S.barWrap}><div style={{ width: `${ratio}%`, height: '100%', background: pc, borderRadius: 4 }} /></div>
                          )}
                        </td>
                        <td style={{ ...S.td, color: config.sortKey === 'hourly_wage' && isTop ? '#D97706' : '#475569', fontWeight: config.sortKey === 'hourly_wage' && isTop ? 700 : 400 }}>
                          {row.hourly_wage != null ? `${Number(row.hourly_wage).toLocaleString()}円/h` : '−'}
                          {config.sortKey === 'hourly_wage' && (
                            <div style={S.barWrap}><div style={{ width: `${ratio}%`, height: '100%', background: pc, borderRadius: 4 }} /></div>
                          )}
                        </td>
                        <td style={S.td}>{fmtFixed(row.age, 1, '歳')}</td>
                        <td style={S.td}>{fmtFixed(row.tenure_years, 1, '年')}</td>
                        <td style={{ ...S.td, color: row.overtime_hours != null && row.overtime_hours > 20 ? '#EF4444' : '#475569', fontWeight: row.overtime_hours != null && row.overtime_hours > 20 ? 600 : 400 }}>
                          {fmtFixed(row.overtime_hours, 1, 'h')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={S.footer}>
            <span style={S.footerText}>{filtered.length.toLocaleString()}件表示</span>
            <span style={S.footerText}>出典: 賃金構造基本統計調査（厚生労働省）</span>
          </div>
        </div>
      </div>
    </div>
  )
}
