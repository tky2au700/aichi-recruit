import Link from 'next/link'
import { ArrowRight, Building2, TrendingUp, MapPin, GraduationCap, BarChart3, Database, ExternalLink } from 'lucide-react'
import { Nav } from '@/components/nav'

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
    href: '/salary/ranking/occupation',
    label: '職種別年収',
    description: '医師・エンジニア・営業など職種ごとの年収データ',
    icon: TrendingUp,
    color: 'text-accent',
    bg: 'bg-accent/10',
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
    <div className="min-h-screen bg-background">
      <Nav />

      {/* ヒーロー */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
          <div className="flex flex-col items-start gap-5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
              <Database className="w-3 h-3" />
              <span>e-Stat 賃金構造基本統計調査データベース</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight text-balance">
              日本の年収データを、
              <br />
              <span className="text-primary">統計から読み解く</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              厚生労働省が実施する賃金構造基本統計調査をもとに、産業別・職種別・都道府県別・学歴別・年齢別の年収ランキングと推移グラフを提供します。
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/salary/industry"
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                年収ランキングを見る
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://www.e-stat.go.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                データ出典: e-Stat
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* カテゴリカード */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-lg font-bold text-foreground mb-6">カテゴリから探す</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(({ href, label, description, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 p-5 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-muted/30 transition-all"
            >
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                  {label}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors mt-auto">
                <span>詳しく見る</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* データ説明 */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-bold text-foreground mb-4">データについて</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground mb-1">データソース</p>
              <p className="leading-relaxed">厚生労働省「賃金構造基本統計調査」をe-Stat APIを通じて取得・表示しています。</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">年収の計算方法</p>
              <p className="leading-relaxed">所定内給与額 × 12ヶ月 + 年間賞与その他特別給与額の合計を年収として表示しています。</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">注意事項</p>
              <p className="leading-relaxed">表示データは統計上の平均値です。個別の企業・職場の賃金とは異なる場合があります。</p>
            </div>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>&copy; 2026 AIリクルート | 出典: 厚生労働省 賃金構造基本統計調査（e-Stat）</p>
      </footer>
    </div>
  )
}
