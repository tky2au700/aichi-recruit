'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Building2, Users, Award, BarChart2, Search, X, ChevronUp, ChevronDown, ArrowUpDown, Info } from 'lucide-react'

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
// 定数・変換マップ（職種別と統一）
// ---------------------------------------------------------------------------
const PARAM_TO_SEX:  Record<string, string> = { male: '男', female: '女' }
const SEX_TO_PARAM:  Record<string, string> = { '男': 'male', '女': 'female' }
const PARAM_TO_SIZE: Record<string, string> = { large: '1000人以上', medium: '100〜999人', small: '10〜99人' }
const SIZE_TO_PARAM: Record<string, string> = { '1000人以上': 'large', '100〜999人': 'medium', '10〜99人': 'small' }
const PARAM_TO_EDU:  Record<string, string> = {
  total: '学歴計', junior: '中学', high: '高校',
  vocational: '専門学校', college: '高専・短大', university: '大学', grad: '大学院',
}
const EDU_TO_PARAM:  Record<string, string> = {
  '学歴計': 'total', '中学': 'junior', '高校': 'high',
  '専門学校': 'vocational', '高専・短大': 'college', '大学': 'university', '大学院': 'grad',
}

const SEX_OPTIONS = [
  { param: '',       db: '計',  label: '男女計' },
  { param: 'male',   db: '男',  label: '男性' },
  { param: 'female', db: '女',  label: '女性' },
]
const SIZE_OPTIONS = [
  { param: '',       db: '企業規模計', label: '企業規模計' },
  { param: 'large',  db: '1000人以上', label: '1000人以上' },
  { param: 'medium', db: '100〜999人', label: '100〜999人' },
  { param: 'small',  db: '10〜99人',   label: '10〜99人' },
]
const EDU_OPTIONS = [
  { param: '',           db: '学歴計',    label: '学歴計' },
  { param: 'junior',     db: '中学',      label: '中学' },
  { param: 'high',       db: '高校',      label: '高校' },
  { param: 'vocational', db: '専門学校',  label: '専門学校' },
  { param: 'college',    db: '高専・短大', label: '高専・短大' },
  { param: 'university', db: '大学',      label: '大学' },
  { param: 'grad',       db: '大学院',    label: '大学院' },
]

type SortKey = 'avg_annual_income' | 'avg_monthly_wage' | 'avg_bonus' | 'avg_age' | 'avg_tenure' | 'avg_ot_hours'
type SortDir = 'asc' | 'desc'

const SORT_KEY_LABEL: Record<SortKey, string> = {
  avg_annual_income: '年収',
  avg_monthly_wage:  '月給',
  avg_bonus:         '賞与',
  avg_age:           '平均年齢',
  avg_tenure:        '勤続年数',
  avg_ot_hours:      '残業時間',
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
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700 } as const
  if (rank === 1) return <span style={{ ...base, background: '#FEF3C7', color: '#D97706' }}>1</span>
  if (rank === 2) return <span style={{ ...base, background: '#F1F5F9', color: '#64748B' }}>2</span>
  if (rank === 3) return <span style={{ ...base, background: '#FEF9C3', color: '#A16207' }}>3</span>
  return <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
}

// 産業名からアルファベット記号を除いてすっきり表示
function industryLabel(name: string) {
  return name.replace(/^[A-ZＡ-Ｚ]\s*/, '').replace(/^\(民[＋+]公\)\s*[A-ZＡ-Ｚ]?\s*/, '(民+公) ')
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------
export function IndustryRankingClient() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [data, setData]       = useState<IndustryRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [years, setYears]     = useState<YearOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')

  // URL パラメータ（英数字）→ DB値（日本語）に変換
  const sexParam   = searchParams.get('sex')       ?? ''
  const sizeParam  = searchParams.get('size')      ?? ''
  const eduParam   = searchParams.get('education') ?? ''
  const yearParam  = searchParams.get('year')
  const sortParam  = (searchParams.get('sort') as SortKey | null) ?? 'avg_annual_income'
  const dirParam   = (searchParams.get('dir')  as SortDir | null) ?? 'desc'

  const dbSex      = PARAM_TO_SEX[sexParam]  ?? '計'
  const dbSize     = PARAM_TO_SIZE[sizeParam] ?? '企業規模計'
  const dbEdu      = PARAM_TO_EDU[eduParam]  ?? '学歴計'
  const surveyYear = yearParam ? parseInt(yearParam, 10) : null
  const sortKey    = sortParam
  const sortDir    = dirParam

  // URL を push（職種別と同じ pushUrl パターン）
  const pushUrl = useCallback((
    newSex: string, newSize: string, newEdu: string,
    newYear: number | null,
    newSort: SortKey = 'avg_annual_income', newDir: SortDir = 'desc'
  ) => {
    const p = new URLSearchParams()
    const sP  = SEX_TO_PARAM[newSex];  if (sP)  p.set('sex',  sP)
    const szP = SIZE_TO_PARAM[newSize]; if (szP) p.set('size', szP)
    const eP  = EDU_TO_PARAM[newEdu];  if (eP && eP !== 'total') p.set('education', eP)
    if (newYear !== null)                         p.set('year', String(newYear))
    if (newSort !== 'avg_annual_income')           p.set('sort', newSort)
    if (newSort !== 'avg_annual_income' && newDir !== 'desc') p.set('dir', newDir)
    const q = p.toString()
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [router, pathname])

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
      if (json.years.length > 0) setYears(json.years)
    } catch { setError('データ取得に失敗しました') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(dbSex, dbSize, dbEdu, surveyYear) }, [dbSex, dbSize, dbEdu, surveyYear, fetchData])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir: SortDir = sortDir === 'desc' ? 'asc' : 'desc'
      pushUrl(dbSex, dbSize, dbEdu, surveyYear, key, newDir)
    } else {
      pushUrl(dbSex, dbSize, dbEdu, surveyYear, key, 'desc')
    }
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

  const topSortValue = filteredData[0]?.[sortKey] as number | null ?? null

  // ---------------------------------------------------------------------------
  // ダイナミックタイトル（職種別と同じパターン）
  // ---------------------------------------------------------------------------
  const sexLabelMap:  Record<string, string> = { '男': '男性', '女': '女性' }
  const sizeLabelMap: Record<string, string> = {
    '1000人以上': '大企業', '100〜999人': '中規模企業', '10〜99人': '小規模企業',
  }
  const currentSexLabel  = dbSex  !== '計'        ? (sexLabelMap[dbSex]   ?? null) : null
  const currentSizeLabel = dbSize !== '企業規模計' ? (sizeLabelMap[dbSize] ?? null) : null
  const currentYearStr   = surveyYear ? `${surveyYear}年` : (meta?.survey_year ? `${meta.survey_year}年` : '')
  const currentSortLabel = SORT_KEY_LABEL[sortKey]

  const baseTitle = `産業別平均${currentSortLabel}ランキング${currentYearStr}`
  let dynamicHeading: string
  if (currentSizeLabel) {
    dynamicHeading = `${currentSizeLabel}の${baseTitle}${currentSexLabel ? `・${currentSexLabel}` : ''}`
  } else if (currentSexLabel) {
    dynamicHeading = `${currentSexLabel}の${baseTitle}`
  } else {
    dynamicHeading = baseTitle
  }

  // ---------------------------------------------------------------------------
  // スタイル定数
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
    filterBar:   { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    filterGroup: { display: 'flex', alignItems: 'center', gap: 8 },
    filterLabel: { fontSize: 12, color: '#64748B', fontWeight: 500, whiteSpace: 'nowrap' as const },
    chipActive:  { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #1a73e8', background: '#EBF3FE', color: '#1a73e8', transition: 'all .15s' },
    chip:        { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', transition: 'all .15s' },
    divider:     { width: 1, height: 28, background: '#E2E8F0' },
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

  // ソートヘッダー
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
  // レンダリング
  // ---------------------------------------------------------------------------
  return (
    <div style={S.page}>
      {/* ヒーロー帯 */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{dynamicHeading}</h1>
          {meta ? (
            <p style={S.subtitle}>
              {meta.survey_group_name}
              {meta.survey_table_name && <span style={{ color: '#94A3B8' }}>　{meta.survey_table_name}</span>}
              <span style={{ marginLeft: 12, color: '#94A3B8' }}>{meta.survey_year}年調査</span>
            </p>
          ) : (
            <p style={S.subtitle}>賃金構造基本統計調査に基づく産業別年収データ</p>
          )}
        </div>
      </div>

      <div style={S.container}>
        {/* KPIカード */}
        {meta && !loading && (
          <div style={S.kpiGrid}>
            {[
              { icon: <Award    size={15} color="#1a73e8" />, label: '最高年収',      value: fmtWan(meta.max_income),     sub: 'トップ産業' },
              { icon: <BarChart2 size={15} color="#0F9D58" />, label: '全産業平均年収', value: fmtWan(meta.avg_income),     sub: `${meta.industry_count}産業の平均` },
              { icon: <Building2 size={15} color="#F4B400" />, label: '集計産業数',    value: `${meta.industry_count}産業`, sub: `${meta.survey_year}年調査` },
              { icon: <Users    size={15} color="#DB4437" />, label: '労働者数',      value: meta.total_workers ? `${(meta.total_workers / 10000).toFixed(0)}万人` : '−', sub: '対象労働者の合計' },
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
                <button key={y.survey_year}
                  style={surveyYear === y.survey_year || (surveyYear === null && meta?.survey_year === y.survey_year) ? S.chipActive : S.chip}
                  onClick={() => pushUrl(dbSex, dbSize, dbEdu, y.survey_year, sortKey, sortDir)}>
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
                <button key={o.param}
                  style={dbSex === o.db
                    ? { ...S.chipActive,
                        border:     o.db === '男' ? '1.5px solid #1a73e8' : o.db === '女' ? '1.5px solid #DB4437' : '1.5px solid #1a73e8',
                        color:      o.db === '男' ? '#1a73e8' : o.db === '女' ? '#DB4437' : '#1a73e8',
                        background: o.db === '男' ? '#EBF3FE' : o.db === '女' ? '#FCECEA' : '#EBF3FE',
                      }
                    : S.chip}
                  onClick={() => pushUrl(o.db, dbSize, dbEdu, surveyYear, sortKey, sortDir)}>
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
              {SIZE_OPTIONS.map(o => (
                <button key={o.param}
                  style={dbSize === o.db ? S.chipActive : S.chip}
                  onClick={() => pushUrl(dbSex, o.db, dbEdu, surveyYear, sortKey, sortDir)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={S.divider} />
          {/* 学歴 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>学歴</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EDU_OPTIONS.map(o => (
                <button key={o.param}
                  style={dbEdu === o.db ? S.chipActive : S.chip}
                  onClick={() => pushUrl(dbSex, dbSize, o.db, surveyYear, sortKey, sortDir)}>
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
              <span>{currentSortLabel}ランキング</span>
              {!loading && <span style={S.badge}>{filteredData.length.toLocaleString()} 産業</span>}
            </div>
            <div style={S.searchWrap}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="産業名で絞り込み..."
                style={S.searchInput}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* テーブル本体 */}
          {loading ? (
            <div style={{ padding: 32 }}>
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
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
              {data.length === 0 ? 'データがありません。管理画面からCSVをインポートしてください。' : '該当する産業はありません。'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 48, cursor: 'default' }}>#</th>
                    <th style={{ ...S.th, minWidth: 200, cursor: 'default' }}>産業名</th>
                    <Th label="推定年収"  k="avg_annual_income" />
                    <Th label="月給"      k="avg_monthly_wage" />
                    <Th label="年間賞与"  k="avg_bonus" />
                    <Th label="残業時間"  k="avg_ot_hours" />
                    <Th label="平均年齢"  k="avg_age" />
                    <Th label="勤続年数"  k="avg_tenure" />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const sortVal   = row[sortKey] as number | null
                    const sortRatio = topSortValue && sortVal ? (sortVal / topSortValue) * 100 : 0
                    const avgIncome = meta?.avg_income ?? null
                    const isAboveAvg = sortVal != null && avgIncome != null && sortVal > avgIncome

                    return (
                      <tr
                        key={row.industry_name}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EBF3FE')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC')}
                      >
                        {/* 順位 */}
                        <td style={{ ...S.td, width: 48 }}>
                          <RankBadge rank={idx + 1} />
                        </td>

                        {/* 産業名 */}
                        <td style={{ ...S.td }}>
                          <Link
                            href={`/salary/industry/${encodeURIComponent(row.industry_name)}`}
                            className="occupation-link"
                          >
                            {industryLabel(row.industry_name)}
                          </Link>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                            {row.industry_name !== industryLabel(row.industry_name) ? row.industry_name : ''}
                          </div>
                        </td>

                        {/* 推定年収 */}
                        {(() => {
                          const isSort = sortKey === 'avg_annual_income'
                          return (
                            <td style={{ ...S.td, minWidth: 140 }}>
                              <span style={{
                                fontWeight: 700, fontSize: 13,
                                color: isSort ? (idx === 0 ? '#D97706' : isAboveAvg ? '#1a73e8' : '#374151') : '#475569',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {fmtWan(row.avg_annual_income)}
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
                          const isSort = sortKey === 'avg_monthly_wage'
                          return (
                            <td style={{ ...S.td, minWidth: 110 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 400, fontSize: 13,
                                color: isSort ? (idx === 0 ? '#D97706' : isAboveAvg ? '#1a73e8' : '#374151') : '#475569',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {fmtWan(row.avg_monthly_wage)}
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
                          const isSort = sortKey === 'avg_bonus'
                          return (
                            <td style={{ ...S.td, minWidth: 110 }}>
                              <span style={{
                                fontWeight: isSort ? 700 : 400, fontSize: 13,
                                color: isSort ? (idx === 0 ? '#D97706' : '#1a73e8') : '#475569',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {fmtWan(row.avg_bonus)}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#1a73e8', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}

                        {/* 残業時間 */}
                        {(() => {
                          const isSort = sortKey === 'avg_ot_hours'
                          const isHigh = row.avg_ot_hours != null && row.avg_ot_hours > 20
                          return (
                            <td style={{ ...S.td }}>
                              <span style={{
                                fontWeight: isSort ? 700 : (isHigh ? 600 : 400),
                                color: isSort ? (idx === 0 ? '#D97706' : '#DB4437') : (isHigh ? '#DB4437' : '#475569'),
                              }}>
                                {fmtNum(row.avg_ot_hours, 'h')}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#FCA5A5', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}

                        {/* 平均年齢 */}
                        {(() => {
                          const isSort = sortKey === 'avg_age'
                          return (
                            <td style={{ ...S.td }}>
                              <span style={{ fontWeight: isSort ? 700 : 400, color: isSort ? (idx === 0 ? '#D97706' : '#1a73e8') : '#475569' }}>
                                {fmtNum(row.avg_age, '歳')}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#94A3B8', borderRadius: 4, transition: 'width .3s' }} />
                                </div>
                              )}
                            </td>
                          )
                        })()}

                        {/* 勤続年数 */}
                        {(() => {
                          const isSort = sortKey === 'avg_tenure'
                          return (
                            <td style={{ ...S.td }}>
                              <span style={{ fontWeight: isSort ? 700 : 400, color: isSort ? (idx === 0 ? '#D97706' : '#1a73e8') : '#475569' }}>
                                {fmtNum(row.avg_tenure, '年')}
                              </span>
                              {isSort && (
                                <div style={S.barWrap}>
                                  <div style={{ width: `${sortRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#94A3B8', borderRadius: 4, transition: 'width .3s' }} />
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

          {/* フッター */}
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
