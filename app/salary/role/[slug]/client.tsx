'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Users, Award, Building2, ChevronRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar,
} from 'recharts'

const ACCENT = '#1a73e8'
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#1d4ed8', '女': '#e8336d' }
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }

interface DataRow {
  tenure_category?: string
  age_group?: string
  enterprise_size?: string
  sex: string
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
}

interface ApiData {
  success: boolean
  role_name: string
  survey_year: number
  dataset_id: number
  years: Array<{ survey_year: number; dataset_id: number }>
  tenure_rows: DataRow[]
  age_rows: DataRow[]
  size_rows: DataRow[]
  time_series: Array<{ survey_year: number; sex: string; scheduled_wage: number | null; annual_bonus: number | null; annual_income: number | null }>
}

function fmtWan(v: number | null | undefined) {
  if (v == null) return '−'
  return `${v.toLocaleString()}万円`
}
function fmtNum(v: number | null | undefined, unit = '') {
  if (v == null) return '−'
  return `${v.toLocaleString()}${unit}`
}

function KpiCard({ label, value, sub, accent = '#1a73e8' }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, margin: 0 }}>{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', paddingBottom: 8, borderBottom: '2px solid #E2E8F0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      {children}
    </h2>
  )
}

export function RoleDetailClient({ slug }: { slug: string }) {
  const roleName = decodeURIComponent(slug)
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [surveyYear, setSurveyYear] = useState<number | null>(null)
  const [sexTab, setSexTab] = useState<'計' | '男' | '女'>('計')

  useEffect(() => {
    const params = new URLSearchParams({ role_name: roleName, ...(surveyYear ? { survey_year: String(surveyYear) } : {}) })
    setLoading(true)
    fetch(`/api/salary/role?${params}`)
      .then(r => r.json())
      .then((res: ApiData) => { setData(res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [roleName, surveyYear])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>読み込み中...</div>
  if (!data?.success) return <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>データが見つかりません</div>

  // 代表値: 10人以上・勤続年数計・学歴計・各性別
  const repRows = (sex: string) => data.tenure_rows.filter(r => r.sex === sex && r.tenure_category === '勤続年数計')
  const rep = repRows('計')[0] ?? repRows('男')[0]

  // 勤続年数別チャートデータ (男女計)
  const tenureChart = data.tenure_rows
    .filter(r => r.tenure_category !== '勤続年数計' && r.sex === sexTab)
    .map(r => ({ name: r.tenure_category, 年収: r.annual_income, 月給: r.scheduled_wage, 賞与: r.annual_bonus }))

  // 年齢別チャートデータ
  const ageChart = data.age_rows
    .filter(r => r.age_group !== '学歴計' && r.sex === sexTab)
    .map(r => ({ name: r.age_group, 年収: r.annual_income, 月給: r.scheduled_wage }))

  // 推移チャート
  const tsYears = [...new Set(data.time_series.map(t => t.survey_year))].sort()
  const tsChart = tsYears.map(yr => {
    const entry: Record<string, any> = { year: yr }
    data.time_series.filter(t => t.survey_year === yr).forEach(t => {
      entry[SEX_LABEL[t.sex] ?? t.sex] = t.annual_income
    })
    return entry
  })

  // 企業規模別テーブル
  const sizeRows = data.size_rows.filter(r => r.sex === sexTab)

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 16px' }}>
      {/* パンくず */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: '#94A3B8' }}>
        <Link href="/salary/ranking/role" style={{ color: ACCENT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={14} />役職別ランキング
        </Link>
        <span>/</span>
        <span style={{ color: '#374151', fontWeight: 600 }}>{roleName}</span>
      </div>

      {/* タイトル */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0 }}>{roleName}</h1>
          <span style={{ fontSize: 13, background: '#e8f0fe', color: ACCENT, borderRadius: 8, padding: '3px 10px', fontWeight: 600 }}>の年収・給与データ</span>
        </div>
        <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
          {data.survey_year}年調査・賃金構造基本統計調査（厚生労働省）
        </p>
        {/* 年度タブ */}
        {data.years.length > 1 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {data.years.map(y => (
              <button key={y.survey_year} onClick={() => setSurveyYear(y.survey_year)}
                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: (surveyYear ?? data.survey_year) === y.survey_year ? `1.5px solid ${ACCENT}` : '1.5px solid #E2E8F0', background: (surveyYear ?? data.survey_year) === y.survey_year ? '#e8f0fe' : '#fff', color: (surveyYear ?? data.survey_year) === y.survey_year ? ACCENT : '#64748B', cursor: 'pointer' }}>
                {y.survey_year}年
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPIカード */}
      {rep && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
          <KpiCard label="推定年収" value={fmtWan(rep.annual_income)} sub="男女計・10人以上" accent={ACCENT} />
          <KpiCard label="月給（所定内）" value={fmtWan(rep.scheduled_wage)} sub="所定内給与額" />
          <KpiCard label="年間賞与" value={fmtWan(rep.annual_bonus)} sub="賞与・特別給与額" accent="#f59e0b" />
          <KpiCard label="労働者数" value={rep.workers != null ? fmtNum(rep.workers, '人') : '−'} sub="調査対象" accent="#7c3aed" />
        </div>
      )}

      {/* 性別タブ（共通） */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['計', '男', '女'] as const).map(s => (
          <button key={s} onClick={() => setSexTab(s)}
            style={{ padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: sexTab === s ? `1.5px solid ${SEX_COLOR[s]}` : '1.5px solid #E2E8F0', background: sexTab === s ? `${SEX_COLOR[s]}14` : '#fff', color: sexTab === s ? SEX_COLOR[s] : '#475569', cursor: 'pointer' }}>
            {SEX_LABEL[s]}
          </button>
        ))}
      </div>

      {/* 勤続年数別グラフ */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle><TrendingUp size={16} color={ACCENT} />勤続年数別の年収・月給</SectionTitle>
        {tenureChart.length > 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tenureChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tickFormatter={v => `${v}万`} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip formatter={(v: any) => [`${v?.toLocaleString()}万円`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="年収" fill={ACCENT} radius={[4, 4, 0, 0]} />
                <Bar dataKey="月給" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                <Bar dataKey="賞与" fill="#FDE68A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ color: '#94A3B8', fontSize: 13 }}>データがありません</p>
        )}
      </section>

      {/* 年齢別グラフ */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle><Users size={16} color="#7c3aed" />年齢別の年収推移</SectionTitle>
        {ageChart.length > 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ageChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tickFormatter={v => `${v}万`} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip formatter={(v: any) => [`${v?.toLocaleString()}万円`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="年収" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="月給" stroke="#93C5FD" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ color: '#94A3B8', fontSize: 13 }}>データがありません</p>
        )}
      </section>

      {/* 企業規模別テーブル */}
      <section style={{ marginBottom: 36 }}>
        <SectionTitle><Building2 size={16} color="#0891b2" />企業規模別データ</SectionTitle>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['企業規模', '推定年収', '月給（所定内）', '年間賞与', '労働者数'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizeRows.map((r, i) => (
                  <tr key={r.enterprise_size} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: i < sizeRows.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={13} color="#94A3B8" />{r.enterprise_size}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtWan(r.annual_income)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.scheduled_wage)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.annual_bonus)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' }}>{r.workers != null ? `${r.workers.toLocaleString()}人` : '−'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 年収推移グラフ */}
      {tsChart.length > 1 && (
        <section style={{ marginBottom: 36 }}>
          <SectionTitle><TrendingUp size={16} color="#0F9D58" />年収の推移（複数年）</SectionTitle>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={tsChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tickFormatter={v => `${v}万`} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip formatter={(v: any) => [`${v?.toLocaleString()}万円`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="男女計" stroke={ACCENT}     strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="男性"   stroke="#1d4ed8"    strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                <Line dataKey="女性"   stroke="#e8336d"    strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 関連リンク */}
      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>関連ランキング</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {[
            { href: '/salary/ranking/role',      label: '役職別ランキング一覧',  icon: <Award size={14} color={ACCENT} /> },
            { href: '/salary/ranking/occupation', label: '職種別年収ランキング',  icon: <TrendingUp size={14} color="#0F9D58" /> },
            { href: '/salary/ranking/industry',   label: '産業別年収ランキング',  icon: <Users size={14} color="#7c3aed" /> },
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

      {/* 出典 */}
      <p style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.8, borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
        出典: 賃金構造基本統計調査（厚生労働省 e-Stat）{data.survey_year}年調査。
        年収は「所定内給与額×12ヶ月＋年間賞与・特別給与額」をもとに推計した値です。
      </p>
    </main>
  )
}
