import Link from 'next/link'
import { ArrowRight, Building2, TrendingUp, MapPin, GraduationCap, BarChart3, Database, ExternalLink, Users, Clock, Award, LineChart } from 'lucide-react'
import { Nav } from '@/components/nav'

const rankingCategories = [
  {
    href: '/salary/ranking/occupation',
    label: '職種別年収ランキング',
    description: '医師・弁護士・エンジニアなど全職種の年収を一覧',
    icon: TrendingUp,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    href: '/salary/ranking/occupation?sex=male',
    label: '男性年収ランキング',
    description: '男性労働者の年収が高い職種ランキング',
    icon: Users,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    href: '/salary/ranking/occupation?sex=female',
    label: '女性年収ランキング',
    description: '女性労働者の年収が高い職種ランキング',
    icon: Users,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  {
    href: '/salary/ranking/occupation?sort=annual_bonus',
    label: 'ボーナスランキング',
    description: '年間賞与・特別給与額が多い職種ランキング',
    icon: Award,
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    href: '/salary/ranking/occupation?sort=hourly_wage',
    label: '時給換算ランキング',
    description: '月給÷160時間で算出した時給が高い職種',
    icon: Clock,
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    href: '/salary/ranking/growth',
    label: '年収増加率ランキング',
    description: '過去数年間で最も年収が伸びた職種',
    icon: LineChart,
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    href: '/salary/ranking/high-income-low-overtime',
    label: '残業少ない高年収',
    description: '月残業10時間以下で年収が高い職種一覧',
    icon: Clock,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
]

const categories = [
  {
    href: '/salary/industry',
    label: '産業別年収',
    description: 'IT・金融・製造など業界別の平均年収ランキングと推移',
    icon: Building2,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    href: '/salary/prefecture',
    label: '都道府県別年収',
    description: '地域ごとの賃金水準と初任給データ',
    icon: MapPin,
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    href: '/salary/education',
    label: '学歴別年収',
    description: '大学院・大学・高専・高校卒の賃金比較',
    icon: GraduationCap,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    href: '/salary/age',
    label: '年齢・経験年数別',
    description: '年齢階級・勤続年数による年収の変化',
    icon: BarChart3,
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: '#fff' }}>
      <Nav />

      {/* ヒーロー */}
      <section style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #ffffff 60%, #f8fffe 100%)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-24">
          <div className="flex flex-col items-start gap-6 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: '#e8f0fe', color: '#1a73e8', border: '1px solid #c5d8fc' }}>
              <Database className="w-3 h-3" />
              <span>e-Stat 賃金構造基本統計調査データベース</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-balance" style={{ color: '#1e293b' }}>
              日本の年収データを、
              <br />
              <span style={{ color: '#1a73e8' }}>統計から読み解く</span>
            </h1>
            <p className="text-base md:text-lg leading-relaxed" style={{ color: '#64748b' }}>
              厚生労働省が実施する賃金構造基本統計調査をもとに、産業別・職種別・都道府県別・学歴別・年齢別の年収ランキングと推移グラフを提供します。
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/salary/ranking/occupation"
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: '#1a73e8', color: '#fff' }}
              >
                職種別ランキングを見る
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://www.e-stat.go.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm transition-colors hover:underline"
                style={{ color: '#64748b' }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                データ出典: e-Stat
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 統計サマリー帯 */}
      <section style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm" style={{ color: '#64748b' }}>
            <span className="font-medium" style={{ color: '#1e293b' }}>データ概要:</span>
            <span>調査年: 2021〜2025年</span>
            <span>職種数: 約145種</span>
            <span>企業規模: 4区分（10〜999人+）</span>
            <span>出典: 厚生労働省 賃金構造基本統計調査</span>
          </div>
        </div>
      </section>

      {/* ランキングカード */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-6">
        <div className="flex items-baseline gap-3 mb-6">
          <h2 className="text-xl font-bold" style={{ color: '#1e293b' }}>年収ランキング</h2>
          <span className="text-sm" style={{ color: '#64748b' }}>DBデータから���種・属性別に集計</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rankingCategories.map(({ href, label, description, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 p-5 rounded-xl transition-all bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md"
            >
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm group-hover:text-blue-600 transition-colors" style={{ color: '#1e293b' }}>{label}</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#94a3b8' }}>{description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs mt-auto" style={{ color: '#94a3b8' }}>
                <span>詳しく見る</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* カテゴリカード */}
      <section className="mx-auto max-w-7xl px-4 pt-6 pb-12">
        <div className="flex items-baseline gap-3 mb-6">
          <h2 className="text-xl font-bold" style={{ color: '#1e293b' }}>カテゴリから探す</h2>
          <span className="text-sm" style={{ color: '#64748b' }}>産業・地域・学歴など別軸で比較</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map(({ href, label, description, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 p-5 rounded-xl transition-all bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md"
            >
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm group-hover:text-blue-600 transition-colors" style={{ color: '#1e293b' }}>{label}</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#94a3b8' }}>{description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs mt-auto" style={{ color: '#94a3b8' }}>
                <span>詳しく見る</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* データ説明 */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-xl p-6" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: '#1e293b' }}>データについて</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs" style={{ color: '#64748b' }}>
            <div>
              <p className="font-semibold mb-1" style={{ color: '#475569' }}>データソース</p>
              <p className="leading-relaxed">厚生労働省「賃金構造基本統計調査」をe-Stat APIを通じて取得・表示しています。</p>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: '#475569' }}>年収の計算方法</p>
              <p className="leading-relaxed">所定内給与額 × 12ヶ月 + 年間賞与その他特別給与額の合計を年収として表示しています。</p>
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: '#475569' }}>注意事項</p>
              <p className="leading-relaxed">表示データは統計上の平均値です。個別の企業・職場の賃金とは異なる場合があります。</p>
            </div>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 text-center text-xs" style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}>
        <p>&copy; 2026 AIリクルート | 出典: 厚生労働省 賃金構造基本統計調査（e-Stat）</p>
      </footer>
    </div>
  )
}
