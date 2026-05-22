'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, TrendingUp, Clock, Users, Award, BarChart2, ArrowLeft } from 'lucide-react'

interface DetailRow {
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
  survey_year: number
}

interface TimePoint {
  survey_year: number
  annual_income: number | null
  monthly_wage: number | null
  hourly_wage: number | null
}

interface ApiResponse {
  success: boolean
  occupation_name: string
  occupation_slug: string
  survey_group_name: string
  survey_table_name: string | null
  latest_year: number
  all_years: number[]
  latest_data: DetailRow[]
  time_series: TimePoint[]
  message?: string
}

function fmt(v: number | null, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toLocaleString()}${suffix}`
}
function fmtWan(v: number | null) {
  if (v == null) return '−'
  return `${Math.round(v).toLocaleString()}万円`
}
function fmtFixed(v: number | null, d = 1, suffix = '') {
  if (v == null) return '−'
  return `${Number(v).toFixed(d)}${suffix}`
}

const ENTERPRISE_ORDER = ['企業規模計', '1000人以上', '100～999人', '10～99人']
const SEX_ORDER        = ['計', '男', '女']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }

const S = {
  container:  { maxWidth: 960, margin: '0 auto', padding: '0 24px 64px' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 6, padding: '20px 0 0', fontSize: 12, color: '#64748B' },
  hero:       { padding: '28px 0 24px' },
  h1:         { fontSize: 28, fontWeight: 700, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.4px', lineHeight: 1.3 },
  meta:       { fontSize: 13, color: '#64748B' },
  kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '24px 0' },
  kpiCard:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  kpiLabel:   { fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 },
  kpiValue:   { fontSize: 22, fontWeight: 700, color: '#0F172A', marginTop: 8, fontVariantNumeric: 'tabular-nums' as const },
  kpiSub:     { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  section:    { marginTop: 32 },
  sectionH2:  { fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #1a73e8', display: 'inline-block' },
  card:       { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  table:      { width: '100%', borderCollapse: 'collapse' as const },
  th:         { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
  td:         { padding: '10px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' as const },
  sexTabBar:  { display: 'flex', gap: 4, marginBottom: 16 },
  sexTabActive: { padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: '1.5px solid #1a73e8', background: '#EBF3FE', color: '#1a73e8', cursor: 'pointer' },
  sexTab:     { padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', cursor: 'pointer' },
  timeBarWrap:{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 12 },
  timeYear:   { fontSize: 12, color: '#64748B', minWidth: 36 },
  timeBarOuter:{ flex: 1, height: 18, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' as const },
  timeLabel:  { fontSize: 12, color: '#374151', minWidth: 72, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
}

export function OccupationDetailClient({ slug }: { slug: string }) {
  const [data, setData]     = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [sexTab, setSexTab] = useState('計')

  useEffect(() => {
    fetch(`/api/salary/occupation/${slug}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'データが見つかりません'); return }
        setData(json)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#94A3B8' }}>読み込み中...</div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div style={S.container}>
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#EF4444' }}>{error ?? 'データが見つかりません'}</div>
      </div>
    )
  }

  // 男女計・企業規模計の代表値
  const rep = data.latest_data.find(r => r.sex === '計' && r.enterprise_size === '企業規模計')

  // 最大年収（時系列バー描画用）
  const maxIncome = Math.max(...data.time_series.map(t => t.annual_income ?? 0), 1)

  // 企業規模テーブル（選択中の性別）
  const sizeRows = ENTERPRISE_ORDER
    .map(size => data.latest_data.find(r => r.sex === sexTab && r.enterprise_size === size))
    .filter(Boolean) as DetailRow[]

  return (
    <div style={S.container}>
      {/* パンくずリスト */}
      <nav aria-label="パンくずリスト" style={S.breadcrumb}>
        <Link href="/" style={{ color: '#1a73e8', textDecoration: 'none' }}>ホーム</Link>
        <ChevronRight size={13} />
        <Link href="/salary/ranking/occupation" style={{ color: '#1a73e8', textDecoration: 'none' }}>職種ランキング</Link>
        <ChevronRight size={13} />
        <span>{data.occupation_name}</span>
      </nav>

      {/* ヒーロー */}
      <header style={S.hero}>
        <h1 style={S.h1}>{data.occupation_name}の平均年収</h1>
        <p style={S.meta}>
          {data.survey_group_name} / {data.latest_year}年調査データ
          {data.survey_table_name && <span style={{ color: '#94A3B8' }}>　{data.survey_table_name}</span>}
        </p>
      </header>

      {/* KPI */}
      {rep && (
        <div style={S.kpiGrid}>
          {[
            { icon: <Award size={14} color="#1a73e8" />, label: '推定年収', value: fmtWan(rep.annual_income), sub: '男女計・全規模' },
            { icon: <BarChart2 size={14} color="#0F9D58" />, label: '月給（所定内）', value: fmtWan(rep.scheduled_wage), sub: '所定内給与額' },
            { icon: <TrendingUp size={14} color="#F4B400" />, label: '年間賞与', value: fmtWan(rep.annual_bonus), sub: '賞与・特別給与額' },
            { icon: <Clock size={14} color="#DB4437" />, label: '時給換算', value: rep.hourly_wage != null ? `${Math.round(rep.hourly_wage).toLocaleString()}円/h` : '−', sub: '月給÷160h' },
            { icon: <Users size={14} color="#8B5CF6" />, label: '平均年齢', value: fmtFixed(rep.age, 1, '歳'), sub: `勤続 ${fmtFixed(rep.tenure_years, 1, '年')}` },
            { icon: <Clock size={14} color="#F97316" />, label: '残業時間', value: fmtFixed(rep.overtime_hours, 1, 'h/月'), sub: '所定外実労働' },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} style={S.kpiCard}>
              <div style={S.kpiLabel}>{icon}{label}</div>
              <div style={S.kpiValue}>{value}</div>
              <div style={S.kpiSub}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* 年収推移 */}
      {data.time_series.length > 1 && (
        <section style={S.section}>
          <h2 style={S.sectionH2}>年収推移（男女計・企業規模計）</h2>
          <div style={S.card}>
            <div style={{ padding: '20px 24px' }}>
              {data.time_series.map(t => (
                <div key={t.survey_year} style={S.timeBarWrap}>
                  <span style={S.timeYear}>{t.survey_year}年</span>
                  <div style={S.timeBarOuter}>
                    <div style={{
                      width: `${t.annual_income ? (t.annual_income / maxIncome) * 100 : 0}%`,
                      height: '100%',
                      background: '#1a73e8',
                      borderRadius: 4,
                      transition: 'width .4s',
                    }} />
                  </div>
                  <span style={S.timeLabel}>{fmtWan(t.annual_income)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 企業規模別 */}
      <section style={S.section}>
        <h2 style={S.sectionH2}>企業規模別データ</h2>
        <div style={S.sexTabBar}>
          {SEX_ORDER.map(s => (
            <button
              key={s}
              onClick={() => setSexTab(s)}
              style={sexTab === s ? S.sexTabActive : S.sexTab}
            >
              {SEX_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['企業規模', '推定年収', '月給（所定内）', '年間賞与', '時給', '平均年齢', '勤続年数', '残業時間/月', '労働者数(十人)'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizeRows.map((r, i) => (
                  <tr key={r.enterprise_size} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ ...S.td, fontWeight: r.enterprise_size === '企業規模計' ? 600 : 400, color: '#0F172A' }}>{r.enterprise_size}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: '#1a73e8', fontVariantNumeric: 'tabular-nums' }}>{fmtWan(r.annual_income)}</td>
                    <td style={S.td}>{fmtWan(r.scheduled_wage)}</td>
                    <td style={S.td}>{fmtWan(r.annual_bonus)}</td>
                    <td style={S.td}>{r.hourly_wage != null ? `${Math.round(r.hourly_wage).toLocaleString()}円/h` : '−'}</td>
                    <td style={S.td}>{fmtFixed(r.age, 1, '歳')}</td>
                    <td style={S.td}>{fmtFixed(r.tenure_years, 1, '年')}</td>
                    <td style={{
                      ...S.td,
                      color: r.overtime_hours != null && r.overtime_hours > 20 ? '#EF4444' : '#374151',
                      fontWeight: r.overtime_hours != null && r.overtime_hours > 20 ? 600 : 400,
                    }}>{fmtFixed(r.overtime_hours, 1, 'h')}</td>
                    <td style={S.td}>{fmt(r.workers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ランキングへ戻る */}
      <div style={{ marginTop: 40 }}>
        <Link
          href="/salary/ranking/occupation"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1a73e8', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
        >
          <ArrowLeft size={15} />
          職種ランキング一覧に戻る
        </Link>
      </div>

      {/* 出典 */}
      <p style={{ marginTop: 32, fontSize: 12, color: '#94A3B8', lineHeight: 1.7 }}>
        出典: {data.survey_group_name}（厚生労働省）{data.latest_year}年調査。
        年収は「所定内給与額×12ヶ月＋年間賞与・特別給与額」をもとに推計した値です。
      </p>
    </div>
  )
}
