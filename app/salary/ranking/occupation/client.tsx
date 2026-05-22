'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Users, Award, BarChart2, Search, X, ChevronUp, ChevronDown, Minus } from 'lucide-react'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface OccupationRow {
  occupation_name: string
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
const SEX_OPTIONS    = [{ value: '計', label: '男女計' }, { value: '男', label: '男性' }, { value: '女', label: '女性' }]
const SIZE_OPTIONS   = [
  { value: '企業規模計', label: '規模計' },
  { value: '1000人以上', label: '1000人以上' },
  { value: '100～999人', label: '100〜999人' },
  { value: '10～99人',   label: '10〜99人' },
]

type SortKey = 'rank' | 'annual_income' | 'monthly_wage' | 'annual_bonus' | 'age' | 'tenure_years' | 'overtime_hours'
type SortDir = 'asc' | 'desc'

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

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------
export function OccupationRankingClient() {
  const [data, setData]       = useState<OccupationRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [years, setYears]     = useState<YearOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // フィルター
  const [sex, setSex]               = useState('計')
  const [size, setSize]             = useState('企業規模計')
  const [surveyYear, setSurveyYear] = useState<number | null>(null)

  // テーブル制御
  const [search, setSearch]     = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('annual_income')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')

  const fetchData = useCallback(async (
    _sex: string, _size: string, _year: number | null
  ) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sex: _sex, enterprise_size: _size })
      if (_year) params.set('survey_year', String(_year))
      const res  = await fetch(`/api/salary/ranking/occupation?${params}`)
      const json: ApiResponse = await res.json()
      console.log('[v0] ranking API response:', { success: json.success, dataLen: json.data?.length, years: json.years?.length, meta: json.meta, message: json.message })
      if (!json.success) { setError(json.message ?? 'エラー'); return }
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

  // ソート
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // 絞り込み＋ソート
  const filteredData = data
    .filter(r => search === '' || r.occupation_name.includes(search))
    .sort((a, b) => {
      if (sortKey === 'rank') return 0
      const av = a[sortKey as keyof OccupationRow] as number | null
      const bv = b[sortKey as keyof OccupationRow] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const topIncome = filteredData[0]?.annual_income ?? null

  // ---------------------------------------------------------------------------
  // ソートアイコン
  // ---------------------------------------------------------------------------
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Minus className="w-3 h-3 text-muted-foreground/40 shrink-0" />
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-primary shrink-0" />
      : <ChevronUp   className="w-3 h-3 text-primary shrink-0" />
  }

  function SortTh({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) {
    return (
      <th
        onClick={() => handleSort(k)}
        className={`px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${className}`}
      >
        <span className="flex items-center gap-1">{label}<SortIcon k={k} /></span>
      </th>
    )
  }

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-balance">職種別平均年収ランキング</h1>
        {meta && (
          <p className="mt-1 text-sm text-muted-foreground">
            {meta.survey_group_name}
            {meta.survey_table_name && <span className="ml-1">／{meta.survey_table_name}</span>}
          </p>
        )}
      </div>

      {/* フィルターバー */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-card border border-border rounded-xl">
        {/* 年度 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">調査年</span>
          <div className="flex gap-1 flex-wrap">
            {years.map(y => (
              <button
                key={y.survey_year}
                onClick={() => setSurveyYear(y.survey_year)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  surveyYear === y.survey_year
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {y.survey_year}年
              </button>
            ))}
          </div>
        </div>
        <div className="w-px h-4 bg-border hidden sm:block" />
        {/* 性別 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">性別</span>
          <div className="flex gap-1">
            {SEX_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setSex(o.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  sex === o.value
                    ? o.value === '男' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : o.value === '女' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                    : 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-px h-4 bg-border hidden sm:block" />
        {/* 企業規模 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">企業規模</span>
          <div className="flex gap-1 flex-wrap">
            {SIZE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setSize(o.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  size === o.value
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIカード */}
      {meta && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: <Award className="w-4 h-4" />, label: '最高年収', value: fmtWan(meta.max_income), sub: 'トップ職種' },
            { icon: <BarChart2 className="w-4 h-4" />, label: '平均年収', value: fmtWan(meta.avg_income), sub: '全職種平均' },
            { icon: <TrendingUp className="w-4 h-4" />, label: '職種数', value: `${meta.occupation_count}職種`, sub: `${meta.survey_year}年調査` },
            { icon: <Users className="w-4 h-4" />, label: '労働者数計', value: meta.total_workers ? `${(meta.total_workers / 10000).toFixed(0)}万人` : '−', sub: '対象労働者' },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                {icon}
                <span className="text-[11px]">{label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* テーブル */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* テーブルヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">年収ランキング</h2>
            {!loading && (
              <span className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                {filteredData.length.toLocaleString()}職種
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="職種名で絞り込み..."
              className="bg-background border border-border rounded-md pl-7 pr-7 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary w-48"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse p-4 space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-9 bg-muted/20 rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-muted-foreground text-sm">{error}</div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {data.length === 0 ? 'データがありません。管理画面からCSVをインポートしてください。' : '該当する職種がありません。'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground w-12">#</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground min-w-[160px]">職種名</th>
                  <SortTh label="推定年収" k="annual_income" />
                  <SortTh label="月給" k="monthly_wage" />
                  <SortTh label="賞与" k="annual_bonus" />
                  <SortTh label="平均年齢" k="age" />
                  <SortTh label="勤続年数" k="tenure_years" />
                  <SortTh label="残業時間" k="overtime_hours" />
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => {
                  const isTop3 = idx < 3
                  const incomeRatio = topIncome && row.annual_income
                    ? (row.annual_income / topIncome) * 100
                    : 0
                  return (
                    <tr key={`${row.occupation_name}-${idx}`} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                      {/* 順位 */}
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-bold ${
                          idx === 0 ? 'text-yellow-400'
                          : idx === 1 ? 'text-slate-300'
                          : idx === 2 ? 'text-amber-600'
                          : 'text-muted-foreground/50'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      {/* 職種名 */}
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium ${isTop3 ? 'text-foreground' : 'text-foreground/80'}`}>
                          {row.occupation_name}
                        </span>
                      </td>
                      {/* 年収 + バー */}
                      <td className="px-3 py-2.5 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold tabular-nums ${
                            idx === 0 ? 'text-accent'
                            : row.annual_income && meta?.avg_income && row.annual_income > meta.avg_income
                              ? 'text-primary'
                              : 'text-foreground'
                          }`}>
                            {fmtWan(row.annual_income)}
                          </span>
                        </div>
                        <div className="mt-1 h-1 bg-muted/20 rounded-full overflow-hidden w-24">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all"
                            style={{ width: `${incomeRatio}%` }}
                          />
                        </div>
                      </td>
                      {/* 月給 */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtWan(row.monthly_wage)}
                      </td>
                      {/* 賞与 */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtWan(row.annual_bonus)}
                      </td>
                      {/* 年齢 */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtNum(row.age, '歳')}
                      </td>
                      {/* 勤続 */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtNum(row.tenure_years, '年')}
                      </td>
                      {/* 残業 */}
                      <td className="px-3 py-2.5 text-xs tabular-nums whitespace-nowrap">
                        <span className={
                          row.overtime_hours != null && row.overtime_hours > 20
                            ? 'text-destructive/80'
                            : 'text-muted-foreground'
                        }>
                          {fmtNum(row.overtime_hours, 'h')}
                        </span>
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
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              出典: {meta.survey_group_name}（{meta.survey_year}年）
            </p>
            <p className="text-[11px] text-muted-foreground">
              推定年収 = 月給 × 12 + 年間賞与
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
