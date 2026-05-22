'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, Clock, Users, Award,
  BarChart2, ArrowLeft, TrendingDown, Building2,
  Info,
} from 'lucide-react'

// ---------- 型定義 ----------
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

// ---------- ユーティリティ ----------
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
function growthRate(latest: number | null, oldest: number | null): string {
  if (!latest || !oldest || oldest === 0) return '−'
  const rate = ((latest - oldest) / oldest) * 100
  const sign = rate >= 0 ? '+' : ''
  return `${sign}${rate.toFixed(1)}%`
}

const ENTERPRISE_ORDER = ['企業規模計', '1000人以上', '100～999人', '10～99人']
const SEX_ORDER        = ['計', '男', '女']
const SEX_LABEL: Record<string, string> = { '計': '男女計', '男': '男性', '女': '女性' }
const SEX_COLOR: Record<string, string> = { '計': '#1a73e8', '男': '#0ea5e9', '女': '#e8336d' }

// ---------- サブコンポーネント ----------
function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: string
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
      padding: '20px 22px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#0F172A', marginTop: 10, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 700, color: '#0F172A',
        borderLeft: '3px solid #1a73e8', paddingLeft: 10, margin: 0,
      }}>
        {children}
      </h2>
    </div>
  )
}

// ---------- メインコンポーネント ----------
export function OccupationDetailClient({ slug }: { slug: string }) {
  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [sexTab, setSexTab]   = useState('計')

  useEffect(() => {
    fetch(`/api/salary/occupation/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.success) { setError(json.message ?? 'データが見つかりません'); return }
        setData(json)
      })
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [slug])

  // --- ローディング ---
  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#1a73e8', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: '#94A3B8', fontSize: 14 }}>データを読み込んでいます...</p>
      </div>
    )
  }

  // --- エラー ---
  if (error || !data) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          <Info size={40} color="#94A3B8" style={{ margin: '0 auto' }} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          {error ?? 'データが見つかりません'}
        </p>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>
          DB マイグレーション未実行の場合、管理画面から setup-schema を実行してください。
        </p>
        <Link
          href="/salary/ranking/occupation"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a73e8', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        >
          <ArrowLeft size={15} />
          職種ランキングに戻る
        </Link>
      </div>
    )
  }

  // --- データ整形 ---
  const rep = data.latest_data.find(r => r.sex === '計' && r.enterprise_size === '企業規模計')
  const maxIncome = Math.max(...data.time_series.map(t => t.annual_income ?? 0), 1)
  const sizeRows  = ENTERPRISE_ORDER
    .map(size => data.latest_data.find(r => r.sex === sexTab && r.enterprise_size === size))
    .filter(Boolean) as DetailRow[]

  // 年収変化（最古→最新）
  const oldest = data.time_series[0]
  const latest = data.time_series[data.time_series.length - 1]
  const growthStr = growthRate(latest?.annual_income, oldest?.annual_income)
  const growthPositive = growthStr !== '−' && !growthStr.startsWith('-')

  return (
    <main style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {/* ---- ヒーローバナー ---- */}
      <div style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #ffffff 70%)', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>

          {/* パンくずリスト */}
          <nav aria-label="パンくずリスト" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '20px 0 0', fontSize: 12, color: '#64748B', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#1a73e8', textDecoration: 'none' }}>AIリクルート</Link>
            <ChevronRight size={12} />
            <Link href="/salary/ranking/occupation" style={{ color: '#1a73e8', textDecoration: 'none' }}>職種別年収ランキング</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#94A3B8' }}>{data.occupation_name}</span>
          </nav>

          {/* タイトル・メタ */}
          <div style={{ padding: '24px 0 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, background: '#E8F0FE', color: '#1a73e8', padding: '3px 10px', borderRadius: 20, border: '1px solid #C5D8FC' }}>
                {data.latest_year}年調査
              </span>
              {growthStr !== '−' && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: growthPositive ? '#ECFDF5' : '#FEF2F2',
                  color: growthPositive ? '#16a34a' : '#dc2626',
                  padding: '3px 10px', borderRadius: 20,
                  border: `1px solid ${growthPositive ? '#BBF7D0' : '#FECACA'}`,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {growthPositive
                    ? <TrendingUp size={11} />
                    : <TrendingDown size={11} />}
                  {data.time_series[0]?.survey_year}年比 {growthStr}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.25 }}>
              {data.occupation_name}の平均年収
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              {data.survey_group_name} / {data.latest_year}年調査
              {rep?.annual_income != null && (
                <> — 推定年収 <strong style={{ color: '#1a73e8', fontSize: 15 }}>{fmtWan(rep.annual_income)}</strong>（男女計・企業規模計）</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ---- コンテンツ本体 ---- */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* KPI グリッド */}
        {rep && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 36 }}>
            <KpiCard
              icon={<Award size={13} color="#1a73e8" />}
              label="推定年収"
              value={fmtWan(rep.annual_income)}
              sub="男女計・企業規模計"
              accent="#1a73e8"
            />
            <KpiCard
              icon={<BarChart2 size={13} color="#0F9D58" />}
              label="月給（所定内）"
              value={fmtWan(rep.scheduled_wage)}
              sub="所定内給与額"
            />
            <KpiCard
              icon={<TrendingUp size={13} color="#F4B400" />}
              label="年間賞与"
              value={fmtWan(rep.annual_bonus)}
              sub="賞与・特別給与額"
            />
            <KpiCard
              icon={<Clock size={13} color="#0ea5e9" />}
              label="時給換算"
              value={rep.hourly_wage != null ? `${Math.round(rep.hourly_wage).toLocaleString()}円` : fmtFixed(rep.monthly_wage != null ? rep.monthly_wage / 160 : null, 0, '円')}
              sub="月給 ÷ 160時間"
            />
            <KpiCard
              icon={<Users size={13} color="#7c3aed" />}
              label="平均年齢"
              value={fmtFixed(rep.age, 1, '歳')}
              sub={`勤続 ${fmtFixed(rep.tenure_years, 1, '年')}`}
            />
            <KpiCard
              icon={<Clock size={13} color={rep.overtime_hours != null && rep.overtime_hours > 20 ? '#dc2626' : '#94A3B8'} />}
              label="月残業時間"
              value={fmtFixed(rep.overtime_hours, 1, 'h')}
              sub={rep.overtime_hours != null && rep.overtime_hours > 20 ? '残業多め' : '標準的'}
              accent={rep.overtime_hours != null && rep.overtime_hours > 20 ? '#dc2626' : undefined}
            />
          </div>
        )}

        {/* 年収推移 */}
        {data.time_series.length > 1 && (
          <section style={{ marginBottom: 36 }}>
            <SectionTitle>年収推移（男女計・企業規模計）</SectionTitle>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {data.time_series.map((t, i) => {
                const pct = t.annual_income ? (t.annual_income / maxIncome) * 100 : 0
                const isLatest = i === data.time_series.length - 1
                return (
                  <div key={t.survey_year} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < data.time_series.length - 1 ? 10 : 0 }}>
                    <span style={{ fontSize: 12, color: isLatest ? '#0F172A' : '#64748B', fontWeight: isLatest ? 700 : 400, minWidth: 40 }}>
                      {t.survey_year}年
                    </span>
                    <div style={{ flex: 1, height: 20, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: isLatest ? '#1a73e8' : '#93C5FD',
                        borderRadius: 6,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: isLatest ? 700 : 400, color: isLatest ? '#0F172A' : '#64748B', minWidth: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtWan(t.annual_income)}
                    </span>
                  </div>
                )
              })}
              {growthStr !== '−' && (
                <div style={{
                  marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F5F9',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748B',
                }}>
                  <span>{data.time_series[0]?.survey_year}年→{latest?.survey_year}年の変化:</span>
                  <strong style={{ color: growthPositive ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {growthPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {growthStr}
                  </strong>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 企業規模別データ */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>企業規模別データ</SectionTitle>

          {/* 性別タブ */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {SEX_ORDER.map(s => (
              <button
                key={s}
                onClick={() => setSexTab(s)}
                style={{
                  padding: '6px 18px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  border: sexTab === s ? `1.5px solid ${SEX_COLOR[s]}` : '1.5px solid #E2E8F0',
                  background: sexTab === s ? `${SEX_COLOR[s]}14` : '#fff',
                  color: sexTab === s ? SEX_COLOR[s] : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {SEX_LABEL[s]}
              </button>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['企業規模', '推定年収', '月給（所定内）', '年間賞与', '時給換算', '平均年齢', '勤続年数', '月残業', '労働者数'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizeRows.map((r, i) => {
                    const isTotal = r.enterprise_size === '企業規模計'
                    const hourly = r.hourly_wage ?? (r.monthly_wage != null ? Math.round(r.monthly_wage / 160) : null)
                    return (
                      <tr key={r.enterprise_size} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: i < sizeRows.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: isTotal ? 700 : 500, color: '#0F172A', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={13} color={isTotal ? '#1a73e8' : '#94A3B8'} />
                          {r.enterprise_size}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 700, color: '#1a73e8', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtWan(r.annual_income)}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.scheduled_wage)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtWan(r.annual_bonus)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                          {hourly != null ? `${hourly.toLocaleString()}円/h` : '−'}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtFixed(r.age, 1, '歳')}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtFixed(r.tenure_years, 1, '年')}</td>
                        <td style={{
                          padding: '11px 14px', fontSize: 13, whiteSpace: 'nowrap',
                          color: r.overtime_hours != null && r.overtime_hours > 20 ? '#dc2626' : '#374151',
                          fontWeight: r.overtime_hours != null && r.overtime_hours > 20 ? 700 : 400,
                        }}>
                          {fmtFixed(r.overtime_hours, 1, 'h')}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(r.workers, '(十人)')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 関連リンク */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>関連ランキングを見る</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { href: '/salary/ranking/occupation',            label: '職種別年収ランキング',  icon: <TrendingUp size={14} color="#1a73e8" /> },
              { href: '/salary/ranking/bonus',                 label: 'ボーナスランキング',      icon: <Award size={14} color="#f59e0b" /> },
              { href: '/salary/ranking/hourly-wage',           label: '時給換算ランキング',      icon: <Clock size={14} color="#0ea5e9" /> },
              { href: '/salary/ranking/high-income-low-overtime', label: '残業少ない高年収',    icon: <BarChart2 size={14} color="#7c3aed" /> },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: '#fff',
                  border: '1px solid #E2E8F0', borderRadius: 10,
                  textDecoration: 'none', fontSize: 13, color: '#374151',
                  fontWeight: 500, transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#93C5FD')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
              >
                {icon}
                {label}
                <ChevronRight size={13} color="#94A3B8" style={{ marginLeft: 'auto' }} />
              </Link>
            ))}
          </div>
        </section>

        {/* 戻るリンク */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8 }}>
          <Link
            href="/salary/ranking/occupation"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1a73e8', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
          >
            <ArrowLeft size={15} />
            職種ランキング一覧に戻る
          </Link>
        </div>

        {/* 出典 */}
        <p style={{ marginTop: 32, fontSize: 11, color: '#94A3B8', lineHeight: 1.8, borderTop: '1px solid #F1F5F9', paddingTop: 20 }}>
          出典: {data.survey_group_name}（厚生労働省 e-Stat）{data.latest_year}年調査。
          年収は「所定内給与額×12ヶ月＋年間賞与・特別給与額」をもとに推計した値です。
          表示データは統計上の平均値であり、個別の企業・職場の賃金を保証するものではありません。
        </p>
      </div>
    </main>
  )
}
