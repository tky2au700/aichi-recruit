'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, Users, Award, BarChart2, Search, X, ChevronUp, ChevronDown, ArrowUpDown, Info } from 'lucide-react'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface OccupationRow {
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
  avg_income: number | null
  max_income: number | null
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
  data: OccupationRow[]
  years: YearOption[]
  meta: Meta | null
  message?: string
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const SEX_OPTIONS  = [
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

// URLパラメーター ↔ DB値 マッピング
const SEX_TO_PARAM:  Record<string, string> = { '男': 'male', '女': 'female' }
const PARAM_TO_SEX:  Record<string, string> = { male: '男', female: '女' }
const SIZE_TO_PARAM: Record<string, string> = {
  '1000人以上': 'large', '100～999人': 'medium', '10～99人': 'small',
}
const PARAM_TO_SIZE: Record<string, string> = {
  large: '1000人以上', medium: '100～999人', small: '10～99人',
}

type SortKey = 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
// API側で万円変換済みのため、そのまま表示
function fmtWan(val: number | null) {
  if (val == null) return '−'
  return `${Math.round(val).toLocaleString()}万円`
}
function fmtNum(val: number | null, suffix = '') {
  if (val == null) return '−'
  return `${Number(val).toFixed(1)}${suffix}`
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
// メインコンポーネント
// ---------------------------------------------------------------------------
interface Props {
  initialSex?:      string | undefined
  initialSize?:     string | undefined
  initialYear?:     number | null
  pageHeading?:     string
  pageDescription?: string
}

export function OccupationRankingClient({ initialSex, initialSize, initialYear, pageHeading, pageDescription }: Props = {}) {
  const router   = useRouter()
  const pathname = usePathname()

  const [data, setData]       = useState<OccupationRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [years, setYears]     = useState<YearOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // propsのURLパラメーター → DB値に変換して初期値にセット
  const [sex, setSex]               = useState(initialSex ? (PARAM_TO_SEX[initialSex] ?? '計') : '計')
  const [size, setSize]             = useState(initialSize ? (PARAM_TO_SIZE[initialSize] ?? '企業規模計') : '企業規模計')
  const [surveyYear, setSurveyYear] = useState<number | null>(initialYear ?? null)

  // タブ変更時にURLを更新する共通関数（引数を全て受け取るのでstateへの依存なし）
  const pushUrl = useCallback((newSex: string, newSize: string, newYear: number | null) => {
    const params = new URLSearchParams()
    const sexParam  = SEX_TO_PARAM[newSex]
    const sizeParam = SIZE_TO_PARAM[newSize]
    if (sexParam)          params.set('sex',  sexParam)
    if (sizeParam)         params.set('size', sizeParam)
    if (newYear !== null)  params.set('year', String(newYear))
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, pathname])

  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('annual_income')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchData = useCallback(async (_sex: string, _size: string, _year: number | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sex: _sex, enterprise_size: _size })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking/occupation?${params}`)
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
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filteredData = data
    .filter(r => search === '' || r.occupation_name.includes(search))
    .sort((a, b) => {
      const av = a[sortKey as keyof OccupationRow] as number | null
      const bv = b[sortKey as keyof OccupationRow] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const topIncome = filteredData[0]?.annual_income ?? null

  // ---------------------------------------------------------------------------
  // スタイル定数
  // ---------------------------------------------------------------------------
  const S = {
    page:       { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', 'Google Sans', sans-serif" },
    container:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px 48px' },
    // ヘッダー帯
    hero:       { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '32px 0 24px' },
    heroInner:  { maxWidth: 1100, margin: '0 auto', padding: '0 24px' },
    h1:         { fontSize: 26, fontWeight: 700, color: '#1E293B', margin: 0, letterSpacing: '-0.3px' },
    subtitle:   { fontSize: 13, color: '#64748B', marginTop: 6 },
    // KPIカード
    kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, margin: '24px 0' },
    kpiCard:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    kpiLabel:   { fontSize: 12, color: '#64748B', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
    kpiValue:   { fontSize: 22, fontWeight: 700, color: '#1E293B', marginTop: 8 },
    kpiSub:     { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    // フィルターバー
    filterBar:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    filterGroup:{ display: 'flex', alignItems: 'center', gap: 8 },
    filterLabel:{ fontSize: 12, color: '#64748B', fontWeight: 500, whiteSpace: 'nowrap' as const },
    chipActive: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #1a73e8', background: '#EBF3FE', color: '#1a73e8', transition: 'all .15s' },
    chip:       { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', transition: 'all .15s' },
    divider:    { width: 1, height: 28, background: '#E2E8F0' },
    // テーブルカード
    tableCard:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    tableHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' },
    tableTitle: { fontSize: 14, fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 },
    badge:      { fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
    searchWrap: { position: 'relative' as const },
    searchInput:{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 32px 7px 32px', fontSize: 13, color: '#1E293B', outline: 'none', width: 200 },
    // テーブル
    table:      { width: '100%', borderCollapse: 'collapse' as const },
    th:         { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', textAlign: 'left' as const, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const },
    td:         { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const },
    // インカムバー
    barWrap:    { width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
    // フッター
    footer:     { padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    footerText: { fontSize: 11, color: '#94A3B8' },
  }

  // ---------------------------------------------------------------------------
  // ソートヘッダー
  // ---------------------------------------------------------------------------
  function Th({ label, k }: { label: string; k: SortKey }) {
    const isActive = sortKey === k
    return (
      <th
        style={{ ...S.th, color: isActive ? '#1a73e8' : '#64748B' }}
        onClick={() => handleSort(k)}
      >
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
  // クライアント側でタブ切り替え後の見出しをリアルタイム導出
  const sexLabelMap:  Record<string, string> = { '男': '男性', '女': '女性' }
  const sizeLabelMap: Record<string, string> = {
    '1000人以上': '大企業', '100～999人': '中規模企業', '10～99人': '小規模企業',
  }
  const currentSexLabel  = sex  !== '計'        ? (sexLabelMap[sex]   ?? null) : null
  const currentSizeLabel = size !== '企業規模計' ? (sizeLabelMap[size] ?? null) : null
  const currentYearStr   = surveyYear ? `${surveyYear}年` : (meta?.survey_year ? `${meta.survey_year}年` : '')

  let dynamicHeading: string
  if (currentSizeLabel) {
    dynamicHeading = `${currentSizeLabel}の職種別平均年収ランキング${currentYearStr}${currentSexLabel ? `・${currentSexLabel}` : ''}`
  } else if (currentSexLabel) {
    dynamicHeading = `${currentSexLabel}の職種別平均年収ランキング${currentYearStr}`
  } else if (currentYearStr) {
    dynamicHeading = `職種別平均年収ランキング${currentYearStr}`
  } else {
    dynamicHeading = '職種別平均年収ランキング'
  }

  const filterDescParts = [
    currentSizeLabel ? `${currentSizeLabel}（${size === '1000人以上' ? '1000人以上' : size === '100～999人' ? '100〜999人' : '10〜99人'}）` : null,
    currentSexLabel,
  ].filter(Boolean)
  const dynamicDescription = (currentSexLabel || currentSizeLabel || surveyYear)
    ? `${currentYearStr}調査の賃金構造基本統計調査に基づく${filterDescParts.length > 0 ? filterDescParts.join('・') + 'の' : ''}職種別平均年収データです。`
    : null

  // SSRで渡されたpropsを初期値とし、クライアント側の変更で上書き
  const displayDescription = pageDescription ?? dynamicDescription

  return (
    <div style={S.page}>
      {/* ヘッダー帯 */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>{dynamicHeading}</h1>
          {displayDescription ? (
            <p style={S.subtitle}>{displayDescription}</p>
          ) : meta ? (
            <p style={S.subtitle}>
              {meta.survey_group_name}
              {meta.survey_table_name && <span style={{ color: '#94A3B8' }}>　{meta.survey_table_name}</span>}
              <span style={{ marginLeft: 12, color: '#94A3B8' }}>{meta.survey_year}年調査</span>
            </p>
          ) : (
            <p style={S.subtitle}>賃金構造基本統計調査に基づく職種別データ</p>
          )}
        </div>
      </div>

      <div style={S.container}>
        {/* KPIカード */}
        {meta && !loading && (
          <div style={S.kpiGrid}>
            {[
              { icon: <Award size={15} color="#1a73e8" />, label: '最高年収', value: fmtWan(meta.max_income), sub: 'トップ職種' },
              { icon: <BarChart2 size={15} color="#0F9D58" />, label: '全職種平均年収', value: fmtWan(meta.avg_income), sub: `${meta.occupation_count}職種の平均` },
              { icon: <TrendingUp size={15} color="#F4B400" />, label: '集計職種数', value: `${meta.occupation_count}職種`, sub: `${meta.survey_year}年調査` },
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
          {/* 調査年 */}
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>調査年</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {years.map(y => (
                <button
                  key={y.survey_year}
                  style={surveyYear === y.survey_year ? S.chipActive : S.chip}
                  onClick={() => { setSurveyYear(y.survey_year); pushUrl(sex, size, y.survey_year) }}
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
                        border: o.value === '男' ? '1.5px solid #1a73e8' : o.value === '女' ? '1.5px solid #DB4437' : '1.5px solid #1a73e8',
                        color:  o.value === '男' ? '#1a73e8' : o.value === '女' ? '#DB4437' : '#1a73e8',
                        background: o.value === '男' ? '#EBF3FE' : o.value === '女' ? '#FCECEA' : '#EBF3FE',
                      }
                    : S.chip}
                  onClick={() => { setSex(o.value); pushUrl(o.value, size, surveyYear) }}
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
              {SIZE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  style={size === o.value ? S.chipActive : S.chip}
                  onClick={() => { setSize(o.value); pushUrl(sex, o.value, surveyYear) }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* テーブルカード */}
        <div style={S.tableCard}>
          {/* テーブルヘッダー */}
          <div style={S.tableHead}>
            <div style={S.tableTitle}>
              <span>年収ランキング</span>
              {!loading && (
                <span style={S.badge}>{filteredData.length.toLocaleString()} 職種</span>
              )}
            </div>
            <div style={S.searchWrap}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="職種名で絞り込み..."
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
                    <Th label="推定年収" k="annual_income" />
                    <Th label="月給" k="monthly_wage" />
                    <Th label="年間賞与" k="annual_bonus" />
                    <Th label="平均年齢" k="age" />
                    <Th label="勤続年数" k="tenure_years" />
                    <Th label="残業時間" k="overtime_hours" />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const incomeRatio = topIncome && row.annual_income ? (row.annual_income / topIncome) * 100 : 0
                    const isAboveAvg  = row.annual_income != null && meta?.avg_income != null && row.annual_income > meta.avg_income
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
                            className={`occupation-link${idx < 3 ? ' bold' : ''}`}
                          >
                            {row.occupation_name}
                          </Link>
                        </td>
                        {/* 年収 + バー */}
                        <td style={{ ...S.td, minWidth: 140 }}>
                          <span style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: idx === 0 ? '#D97706' : isAboveAvg ? '#1a73e8' : '#374151',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {fmtWan(row.annual_income)}
                          </span>
                          <div style={S.barWrap}>
                            <div style={{ width: `${incomeRatio}%`, height: '100%', background: idx === 0 ? '#F4B400' : '#1a73e8', borderRadius: 4, transition: 'width .3s' }} />
                          </div>
                        </td>
                        {/* 月給 */}
                        <td style={{ ...S.td, color: '#475569' }}>{fmtWan(row.monthly_wage)}</td>
                        {/* 賞与 */}
                        <td style={{ ...S.td, color: '#475569' }}>{fmtWan(row.annual_bonus)}</td>
                        {/* 年齢 */}
                        <td style={{ ...S.td, color: '#475569' }}>{fmtNum(row.age, '歳')}</td>
                        {/* 勤続 */}
                        <td style={{ ...S.td, color: '#475569' }}>{fmtNum(row.tenure_years, '年')}</td>
                        {/* 残業 */}
                        <td style={{
                          ...S.td,
                          color: row.overtime_hours != null && row.overtime_hours > 20 ? '#DB4437' : '#475569',
                          fontWeight: row.overtime_hours != null && row.overtime_hours > 20 ? 600 : 400,
                        }}>
                          {fmtNum(row.overtime_hours, 'h')}
                        </td>
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
