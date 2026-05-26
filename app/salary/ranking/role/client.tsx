'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TrendingUp, Users, Award, ChevronRight, ArrowUpDown } from 'lucide-react'

interface RoleRow {
  role_name: string
  sex: string
  enterprise_size: string
  tenure_category: string
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
}

interface ApiResponse {
  success: boolean
  data: RoleRow[]
  years: Array<{ survey_year: number; dataset_id: number }>
  enterprise_sizes: string[]
  tenure_categories: string[]
  meta: {
    survey_year: number
    sex: string
    enterprise_size: string
    tenure_category: string
  } | null
}

const ROLE_ORDER = ['部長級', '課長級', '係長級', '職長・班長級', '非役職']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#1a73e8', '女': '#e8336d' }
const ACCENT = '#1a73e8'

function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${v.toLocaleString()}万円`
}

export function RoleRankingClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sex, setSex] = useState<'計' | '男' | '女'>('計')
  const [size, setSize] = useState('10人以上')
  const [tenure, setTenure] = useState('勤続年数計')
  const [surveyYear, setSurveyYear] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<'annual_income' | 'scheduled_wage' | 'annual_bonus'>('annual_income')

  useEffect(() => {
    const params = new URLSearchParams({
      sex,
      enterprise_size: size,
      tenure_category: tenure,
      ...(surveyYear ? { survey_year: String(surveyYear) } : {}),
    })
    setLoading(true)
    fetch(`/api/salary/ranking/role?${params}`)
      .then(r => r.json())
      .then((res: ApiResponse) => { setData(res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sex, size, tenure, surveyYear])

  const rows = data?.data ?? []
  const sorted = [...rows].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))
  const maxIncome = sorted[0]?.annual_income ?? 1

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <TrendingUp size={20} color={ACCENT} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            役職別年収ランキング
          </h1>
        </div>
        <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
          部長級・課長級など役職ごとの年収・給与を比較。勤続年数・企業規模で絞り込めます。
        </p>
        {data?.meta && (
          <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>
            {data.meta.survey_year}年調査・出典: 賃金構造基本統計調査（厚生労働省）
          </p>
        )}
      </div>

      {/* フィルター */}
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {/* 年度 */}
        {data?.years && data.years.length > 1 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>調査年</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {data.years.map(y => (
                <button key={y.survey_year} onClick={() => setSurveyYear(y.survey_year)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: (surveyYear ?? data.meta?.survey_year) === y.survey_year ? `1.5px solid ${ACCENT}` : '1.5px solid #E2E8F0', background: (surveyYear ?? data.meta?.survey_year) === y.survey_year ? '#e8f0fe' : '#fff', color: (surveyYear ?? data.meta?.survey_year) === y.survey_year ? ACCENT : '#475569', cursor: 'pointer' }}>
                  {y.survey_year}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 性別 */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>性別</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['計', '男', '女'] as const).map(s => (
              <button key={s} onClick={() => setSex(s)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: sex === s ? `1.5px solid ${SEX_COLOR[s]}` : '1.5px solid #E2E8F0', background: sex === s ? `${SEX_COLOR[s]}14` : '#fff', color: sex === s ? SEX_COLOR[s] : '#475569', cursor: 'pointer' }}>
                {SEX_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* 企業規模 */}
        {data?.enterprise_sizes && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>企業規模</p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {data.enterprise_sizes.map(s => (
                <button key={s} onClick={() => setSize(s)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: size === s ? `1.5px solid ${ACCENT}` : '1.5px solid #E2E8F0', background: size === s ? '#e8f0fe' : '#fff', color: size === s ? ACCENT : '#475569', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 勤続年数 */}
        {data?.tenure_categories && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>勤続年数</p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {data.tenure_categories.map(t => (
                <button key={t} onClick={() => setTenure(t)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: tenure === t ? `1.5px solid ${ACCENT}` : '1.5px solid #E2E8F0', background: tenure === t ? '#e8f0fe' : '#fff', color: tenure === t ? ACCENT : '#475569', cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ソートタブ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([
          { key: 'annual_income',  label: '年収順' },
          { key: 'scheduled_wage', label: '月給順' },
          { key: 'annual_bonus',   label: '賞与順' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setSortKey(key)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: sortKey === key ? `1.5px solid ${ACCENT}` : '1.5px solid #E2E8F0', background: sortKey === key ? '#e8f0fe' : '#fff', color: sortKey === key ? ACCENT : '#64748B', cursor: 'pointer' }}>
            <ArrowUpDown size={12} />{label}
          </button>
        ))}
      </div>

      {/* ランキングテーブル */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 32 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>読み込み中...</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>該当データがありません</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['順位', '役職', '推定年収', '月給（所定内）', '年間賞与', '労働者数'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const ratio = row.annual_income != null ? (row.annual_income / maxIncome) * 100 : 0
                  const rank = i + 1
                  const rankColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#94A3B8' : rank === 3 ? '#b45309' : '#CBD5E1'
                  return (
                    <tr key={row.role_name} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: i < sorted.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '12px 14px', width: 44 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: `${rankColor}20`, fontSize: 12, fontWeight: 700, color: rankColor }}>
                          {rank}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <Link href={`/salary/role/${encodeURIComponent(row.role_name)}`}
                          style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                          onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
                          onMouseLeave={e => (e.currentTarget.style.color = '#0F172A')}>
                          {row.role_name}
                          <ChevronRight size={13} color="#CBD5E1" />
                        </Link>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtWan(row.annual_income)}
                        </div>
                        <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: '#F1F5F9', width: 100 }}>
                          <div style={{ width: `${ratio}%`, height: '100%', background: ACCENT, borderRadius: 2 }} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(row.scheduled_wage)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(row.annual_bonus)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                        {row.workers != null ? `${row.workers.toLocaleString()}人` : '−'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{sorted.length}件表示</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>出典: 賃金構造基本統計調査（厚生労働省）</span>
        </div>
      </div>

      {/* 関連リンク */}
      <section>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>関連ランキング</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {[
            { href: '/salary/ranking/occupation', label: '職種別年収ランキング', icon: <TrendingUp size={14} color={ACCENT} /> },
            { href: '/salary/ranking/industry',   label: '産業別年収ランキング', icon: <Award size={14} color="#0F9D58" /> },
            { href: '/salary/prefecture',         label: '都道府県別年収',       icon: <Users size={14} color="#7c3aed" /> },
          ].map(({ href, label, icon }) => (
            <Link key={href} href={href}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, textDecoration: 'none', fontSize: 13, color: '#374151', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#93C5FD')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
              {icon}{label}<ChevronRight size={13} color="#94A3B8" style={{ marginLeft: 'auto' }} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
