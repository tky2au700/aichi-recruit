'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, Clock, Users, Award,
  BarChart2, MapPin, ArrowLeft,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ---------- 型定義 ----------
interface DetailRow {
  sex: string
  age: number | null
  tenure_years: number | null
  scheduled_hours: number | null
  overtime_hours: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
  survey_year: number
}

interface TimePoint {
  survey_year: number
  sex: string
  annual_income: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  hourly_wage: number | null
  scheduled_hours: number | null
  overtime_hours: number | null
  workers: number | null
  age: number | null
  tenure_years: number | null
}

interface RankEntry { rank: number; total: number }

interface ApiResponse {
  success: boolean
  prefecture_name: string
  survey_group_name: string
  survey_table_name: string | null
  latest_year: number
  all_years: number[]
  latest_data: DetailRow[]
  time_series: TimePoint[]
  time_series_all: TimePoint[]
  national_data: DetailRow[] | null
  ranks: Record<string, RankEntry>
  message?: string
}

// ---------- ユーティリティ ----------
// DB値は千円単位 → ÷10 で万円換算
function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v / 10).toLocaleString()}万円`
}
function fmtFixed(v: number | null, d = 1, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toFixed(d)}${suffix}`
}
function growthRate(latest: number | null, oldest: number | null): string {
  if (!latest || !oldest || oldest === 0) return '−'
  const rate = ((latest - oldest) / oldest) * 100
  const sign = rate >= 0 ? '+' : ''
  return `${sign}${rate.toFixed(1)}%`
}

const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#0ea5e9', '女': '#e8336d' }

// ---------- KpiCard ----------
function KpiCard({
  icon, label, value, sub, accent, rank, rankLabel,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: string
  rank?: RankEntry
  rankLabel?: string
}) {
  const rankColor = !rank ? '#64748B'
    : rank.rank <= 3  ? '#b45309'
    : rank.rank <= 10 ? '#1a73e8'
    : '#64748B'
  const rankBg = !rank ? '#F1F5F9'
    : rank.rank <= 3  ? '#FEF3C7'
    : rank.rank <= 10 ? '#EFF6FF'
    : '#F1F5F9'
  const rankBorder = !rank ? '#E2E8F0'
    : rank.rank <= 3  ? '#FDE68A'
    : rank.rank <= 10 ? '#DBEAFE'
    : '#E2E8F0'

  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </div>
        {rank && (
          <span style={{
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            color: rankColor, background: rankBg, border: `1px solid ${rankBorder}`,
            borderRadius: 10, padding: '2px 7px', whiteSpace: 'nowrap',
          }}>
            {rankLabel ?? '年収順'} {rank.rank}位 / {rank.total}都道府県
          </span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#0F172A', marginTop: 8, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// ---------- メイン ----------
interface Props {
  prefectureName: string
}

export function PrefectureDetailClient({ prefectureName }: Props) {
  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [selSex, setSelSex]   = useState('計')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/salary/prefecture/${encodeURIComponent(prefectureName)}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'エラーが発生しました'); return }
        setData(json)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [prefectureName])

  if (loading) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
      データを読み込み中...
    </div>
  )
  if (error || !data) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#EF4444', fontSize: 14 }}>
      {error ?? 'データが見つかりません'}
    </div>
  )

  // 表示対象の行
  const rep = data.latest_data.find(r => r.sex === selSex) ?? data.latest_data.find(r => r.sex === '計') ?? data.latest_data[0]

  // 全国比較（同性別）
  const national = data.national_data?.find(r => r.sex === selSex) ?? data.national_data?.[0] ?? null

  // 成長率（男女計・最新 vs 最古）
  const timeSeries = data.time_series
  const oldest = timeSeries[0]?.annual_income ?? null
  const latest = timeSeries[timeSeries.length - 1]?.annual_income ?? null
  const growth = growthRate(latest, oldest)
  const growthPositive = latest != null && oldest != null && latest > oldest

  // 時系列グラフデータ（男女計）
  const chartData = data.time_series.map(t => ({
    year: `${t.survey_year}年`,
    年収: t.annual_income != null ? Math.round(t.annual_income / 10) : null,
    月給: t.monthly_wage  != null ? Math.round(t.monthly_wage  / 10) : null,
  }))

  // 全国比較バー用
  const prefIncome  = rep?.annual_income  ?? null
  const natIncome   = national?.annual_income ?? null
  const maxForBar   = Math.max(prefIncome ?? 0, natIncome ?? 0) || 1

  // セクションスタイル
  const S = {
    page:      { background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Noto Sans JP', sans-serif" },
    hero:      { background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '28px 0 20px' },
    heroInner: { maxWidth: 960, margin: '0 auto', padding: '0 24px' },
    breadcrumb:{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94A3B8', marginBottom: 16 },
    h1:        { fontSize: 28, fontWeight: 700, color: '#1E293B', margin: 0, letterSpacing: '-0.3px' },
    subtitle:  { fontSize: 13, color: '#64748B', marginTop: 8 },
    container: { maxWidth: 960, margin: '0 auto', padding: '24px 24px 48px' },
    kpiGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 },
    section:   { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
    tabWrap:   { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' as const },
    tabActive: { padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #1a73e8', background: '#EBF3FE', color: '#1a73e8' },
    tab:       { padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569' },
  }

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          {/* パンくずリスト */}
          <nav style={S.breadcrumb} aria-label="パンくずリスト">
            <Link href="/" style={{ color: '#94A3B8', textDecoration: 'none' }}>AIリクルート</Link>
            <ChevronRight size={12} />
            <Link href="/salary/prefecture" style={{ color: '#94A3B8', textDecoration: 'none' }}>都道府県別年収ランキング</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#475569' }}>{data.prefecture_name}</span>
          </nav>

          {/* バッジ行 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, padding: '3px 10px', background: '#EBF3FE', color: '#1a73e8', borderRadius: 20, fontWeight: 600 }}>
              {data.latest_year}年調査
            </span>
            {growth !== '−' && (
              <span style={{ fontSize: 12, padding: '3px 10px', background: growthPositive ? '#ECFDF5' : '#FEF2F2', color: growthPositive ? '#059669' : '#DC2626', borderRadius: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <TrendingUp size={11} />
                {timeSeries[0]?.survey_year}年比 {growth}
              </span>
            )}
          </div>

          <h1 style={S.h1}>{data.prefecture_name}の平均年収</h1>
          <p style={S.subtitle}>
            {data.survey_group_name} / {data.latest_year}年調査
            {rep?.annual_income != null && (
              <> — 推定年収 <strong style={{ color: '#1a73e8' }}>{Math.round(rep.annual_income / 10).toLocaleString()}万円</strong>（男女計）</>
            )}
          </p>
        </div>
      </div>

      <div style={S.container}>
        {/* 性別タブ */}
        <div style={S.tabWrap}>
          {['計', '男', '女'].map(s => (
            <button key={s} style={selSex === s ? S.tabActive : S.tab} onClick={() => setSelSex(s)}>
              {SEX_LABEL[s]}
            </button>
          ))}
        </div>

        {/* KPIグリッド */}
        {rep && (
          <div style={S.kpiGrid}>
            <KpiCard
              icon={<Award size={13} color="#1a73e8" />}
              label="推定年収"
              value={fmtWan(rep.annual_income)}
              sub="男女計"
              accent="#1a73e8"
              rank={data.ranks?.annual_income}
              rankLabel="年収高い順"
            />
            <KpiCard
              icon={<BarChart2 size={13} color="#0F9D58" />}
              label="月給（所定内）"
              value={fmtWan(rep.monthly_wage)}
              sub="所定内給与額"
              rank={data.ranks?.monthly_wage}
              rankLabel="月給高い順"
            />
            <KpiCard
              icon={<TrendingUp size={13} color="#F4B400" />}
              label="年間賞与"
              value={fmtWan(rep.annual_bonus)}
              sub="賞与・特別給与額"
              rank={data.ranks?.annual_bonus}
              rankLabel="賞与高い順"
            />
            <KpiCard
              icon={<Clock size={13} color={rep.overtime_hours != null && rep.overtime_hours > 20 ? '#dc2626' : '#94A3B8'} />}
              label="月残業時間"
              value={fmtFixed(rep.overtime_hours, 1, 'h')}
              sub={rep.overtime_hours != null && rep.overtime_hours > 20 ? '残業多め' : '標準的'}
              accent={rep.overtime_hours != null && rep.overtime_hours > 20 ? '#dc2626' : undefined}
              rank={data.ranks?.overtime_hours}
              rankLabel="残業少ない順"
            />
            <KpiCard
              icon={<Clock size={13} color="#0f766e" />}
              label="月実労働時間"
              value={fmtFixed(rep.scheduled_hours, 1, 'h')}
              sub="所定内労働時間"
            />
            <KpiCard
              icon={<Users size={13} color="#64748B" />}
              label="労働者数"
              value={rep.workers != null
                ? rep.workers >= 10000
                  ? `${(rep.workers / 10000).toFixed(1)}万人`
                  : `${rep.workers.toLocaleString()}人`
                : '−'}
              sub="調査対象労働者数"
            />
          </div>
        )}

        {/* 推移グラフ */}
        {chartData.length > 1 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>
              <TrendingUp size={16} color="#1a73e8" />
              推移グラフ（男女計）
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="万円" width={52} />
                <Tooltip
                  formatter={(v: any, name: string) => [`${v}万円`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="年収" stroke="#1a73e8" strokeWidth={2.5} dot={{ r: 4, fill: '#1a73e8' }} activeDot={{ r: 6 }} connectNulls />
                <Line type="monotone" dataKey="月給" stroke="#0F9D58" strokeWidth={2} dot={{ r: 3, fill: '#0F9D58' }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 全国比較 */}
        {national && rep && (
          <div style={S.section}>
            <div style={S.sectionTitle}>
              <MapPin size={16} color="#F4B400" />
              全国との比較（{SEX_LABEL[selSex]}・{data.latest_year}年）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {[
                { label: '推定年収', pref: rep.annual_income, nat: national.annual_income, fmt: fmtWan },
                { label: '月給（所定内）', pref: rep.monthly_wage, nat: national.monthly_wage, fmt: fmtWan },
                { label: '年間賞与', pref: rep.annual_bonus, nat: national.annual_bonus, fmt: fmtWan },
                { label: '月残業時間', pref: rep.overtime_hours, nat: national.overtime_hours, fmt: (v: number | null) => fmtFixed(v, 1, 'h') },
              ].map(({ label, pref, nat, fmt }) => {
                const prefVal  = pref != null ? Number(pref) : null
                const natVal   = nat  != null ? Number(nat)  : null
                const maxVal   = Math.max(prefVal ?? 0, natVal ?? 0) || 1
                const prefPct  = prefVal != null ? (prefVal / maxVal) * 100 : 0
                const natPct   = natVal  != null ? (natVal  / maxVal) * 100 : 0
                const isHigher = label === '月残業時間'
                  ? (prefVal ?? 0) < (natVal ?? 0)
                  : (prefVal ?? 0) > (natVal ?? 0)
                return (
                  <div key={label}>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>{label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, color: isHigher ? '#1a73e8' : '#374151' }}>{data.prefecture_name}</span>
                          <span style={{ fontWeight: 600, color: isHigher ? '#1a73e8' : '#374151' }}>{fmt(pref)}</span>
                        </div>
                        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${prefPct}%`, height: '100%', background: isHigher ? '#1a73e8' : '#94A3B8', borderRadius: 4 }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#64748B' }}>全国平均</span>
                          <span style={{ color: '#64748B' }}>{fmt(nat)}</span>
                        </div>
                        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${natPct}%`, height: '100%', background: '#E2E8F0', borderRadius: 4 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 年度別データテーブル */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <BarChart2 size={16} color="#64748B" />
            年度別データ一覧
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['調査年', '性別', '推定年収', '月給', '年間賞与', '残業時間', '労働時間', '労働者数'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.time_series_all
                  .filter(r => r.sex === selSex)
                  .sort((a, b) => b.survey_year - a.survey_year)
                  .map((r, i) => (
                    <tr key={`${r.survey_year}-${r.sex}`} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{r.survey_year}年</td>
                      <td style={{ padding: '8px 12px', color: SEX_COLOR[r.sex] ?? '#374151', fontWeight: 500 }}>{SEX_LABEL[r.sex]}</td>
                      <td style={{ padding: '8px 12px', color: '#1a73e8', fontWeight: 600 }}>{fmtWan(r.annual_income)}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtWan(r.monthly_wage)}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtWan(r.annual_bonus)}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtFixed(r.overtime_hours, 1, 'h')}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtFixed(r.scheduled_hours, 1, 'h')}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {r.workers != null
                          ? r.workers >= 10000 ? `${(r.workers / 10000).toFixed(1)}万人` : `${r.workers.toLocaleString()}人`
                          : '−'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 戻るボタン */}
        <div style={{ marginTop: 8 }}>
          <Link
            href="/salary/prefecture"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} />
            都道府県別ランキングに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
