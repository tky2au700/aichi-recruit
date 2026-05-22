'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TrendingUp, Info } from 'lucide-react'

interface GrowthRow {
  occupation_name: string
  occupation_slug: string | null
  annual_income: number
  base_income: number
  growth_rate: number
  growth_amount: number
  hourly_wage: number | null
  workers: number | null
}

interface ApiResponse {
  success: boolean
  data: GrowthRow[]
  latest_year: number
  base_year: number
  actual_years: number
  available_years: number[]
  message?: string
}

// API側で万円変換済みのため、そのまま表示
function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v).toLocaleString()}万円`
}

function RankBadge({ rank }: { rank: number }) {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700 }
  if (rank === 1) return <span style={{ ...base, background: '#FEF3C7', color: '#D97706' }}>1</span>
  if (rank === 2) return <span style={{ ...base, background: '#F1F5F9', color: '#64748B' }}>2</span>
  if (rank === 3) return <span style={{ ...base, background: '#FEF9C3', color: '#A16207' }}>3</span>
  return <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
}

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
  tableCard: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  tableHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #F1F5F9' },
  table:     { width: '100%', borderCollapse: 'collapse' as const },
  th:        { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
  td:        { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', color: '#374151', whiteSpace: 'nowrap' as const },
  barWrap:   { width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
}

export function GrowthRankingClient() {
  const [data, setData]     = useState<GrowthRow[]>([])
  const [info, setInfo]     = useState<Pick<ApiResponse, 'latest_year' | 'base_year' | 'actual_years'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/salary/ranking/growth?years=5')
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'エラー'); return }
        setData(json.data)
        if (json.latest_year) setInfo({ latest_year: json.latest_year, base_year: json.base_year, actual_years: json.actual_years })
        if (json.message) setError(json.message)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const maxRate = data[0]?.growth_rate ?? 1

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.h1}>年収増加率ランキング</h1>
          <p style={S.subtitle}>
            {info
              ? `${info.base_year}年→${info.latest_year}年（${info.actual_years}年間）の年収増加率が高い職種ランキングです。`
              : '複数年のデータをもとに年収の伸び率が高い職種を表示します。'}
          </p>
        </div>
      </div>

      <div style={S.container}>
        {info && !loading && data.length > 0 && (
          <div style={S.kpiGrid}>
            {[
              { label: '最大増加率', value: `+${data[0].growth_rate.toFixed(1)}%` },
              { label: '最大増加額', value: fmtWan(data[0].growth_amount) },
              { label: '比較年数', value: `${info.actual_years}年間` },
              { label: '対象職種数', value: `${data.length}職種` },
            ].map(({ label, value }) => (
              <div key={label} style={S.kpiCard}>
                <div style={S.kpiLabel}>{label}</div>
                <div style={S.kpiValue}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="#0F9D58" />
              年収増加率ランキング
              {!loading && <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>{data.length}職種</span>}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 32 }}>
              {[...Array(8)].map((_, i) => <div key={i} style={{ height: 44, background: i % 2 === 0 ? '#F8FAFC' : '#fff', borderRadius: 4, marginBottom: 4 }} />)}
            </div>
          ) : error ? (
            <div style={{ padding: 48, textAlign: 'center', color: data.length === 0 ? '#64748B' : '#EF4444', fontSize: 14 }}>
              <Info size={20} style={{ marginBottom: 8, opacity: 0.6 }} /><p>{error}</p>
            </div>
          ) : data.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              比較できるデータが不足しています。複数年分のCSVをインポートしてください。
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['#', '職種名', `増加率（${info?.actual_years ?? '?'}年間）`, '増加額', `${info?.latest_year ?? '最新'}年 年収`, `${info?.base_year ?? '基準'}年 年収`].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={row.occupation_name} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#E6F4EA')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC')}
                    >
                      <td style={{ ...S.td, width: 48 }}><RankBadge rank={idx + 1} /></td>
                      <td style={{ ...S.td, fontWeight: idx < 3 ? 600 : 400, color: '#0F172A' }}>
                        {row.occupation_slug ? (
                          <Link href={`/salary/occupation/${row.occupation_slug}`} style={{ color: '#0F9D58', textDecoration: 'none', fontWeight: idx < 3 ? 600 : 500 }}>
                            {row.occupation_name}
                          </Link>
                        ) : row.occupation_name}
                      </td>
                      <td style={{ ...S.td, minWidth: 140 }}>
                        <span style={{ fontWeight: 700, color: row.growth_rate >= 0 ? '#0F9D58' : '#EF4444', fontVariantNumeric: 'tabular-nums' }}>
                          {row.growth_rate >= 0 ? '+' : ''}{row.growth_rate.toFixed(1)}%
                        </span>
                        <div style={S.barWrap}>
                          <div style={{ width: `${Math.max(0, (row.growth_rate / maxRate) * 100)}%`, height: '100%', background: '#0F9D58', borderRadius: 4 }} />
                        </div>
                      </td>
                      <td style={{ ...S.td, color: row.growth_amount >= 0 ? '#0F9D58' : '#EF4444', fontWeight: 600 }}>
                        {row.growth_amount >= 0 ? '+' : ''}{fmtWan(row.growth_amount)}
                      </td>
                      <td style={{ ...S.td, color: '#1a73e8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtWan(row.annual_income)}</td>
                      <td style={{ ...S.td, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmtWan(row.base_income)}</td>
                    </tr>
                  ))}
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
