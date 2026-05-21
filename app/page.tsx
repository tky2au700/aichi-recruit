import Link from 'next/link'
import { ArrowRight, Building2, Star, TrendingUp, Users, Briefcase, ChevronRight } from 'lucide-react'
import { Header } from '@/components/header'
import { HeroSearch } from '@/components/hero-search'
import { JobCard } from '@/components/job-card'
import { mockJobs, mockCompanies } from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const categories = [
  { name: 'ITエンジニア', icon: '💻', count: 24800, href: '/jobs?category=it' },
  { name: 'マーケティング', icon: '📈', count: 8200, href: '/jobs?category=marketing' },
  { name: 'デザイナー', icon: '🎨', count: 5600, href: '/jobs?category=design' },
  { name: '営業', icon: '🤝', count: 19400, href: '/jobs?category=sales' },
  { name: '管理・経営', icon: '🏢', count: 7100, href: '/jobs?category=management' },
  { name: 'データ・AI', icon: '🔬', count: 4300, href: '/jobs?category=data' },
  { name: 'コンサルタント', icon: '📋', count: 3800, href: '/jobs?category=consulting' },
  { name: '人事・総務', icon: '👥', count: 6500, href: '/jobs?category=hr' },
]

const stats = [
  { value: '128,450+', label: '掲載求人数', icon: Briefcase },
  { value: '12,000+', label: '掲載企業数', icon: Building2 },
  { value: '580万+', label: '登録ユーザー数', icon: Users },
  { value: '月間38万件', label: '内定実績', icon: TrendingUp },
]

export default function HomePage() {
  const featuredJobs = mockJobs.filter((j) => j.isFeatured || j.isNew).slice(0, 4)
  const featuredCompanies = mockCompanies.slice(0, 4)

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ヒーロー＋検索 */}
      <HeroSearch />

      {/* 統計バー */}
      <section className="bg-card border-b border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* カテゴリ */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">職種から探す</h2>
          <Link href="/jobs" className="text-sm text-primary hover:underline flex items-center gap-1">
            すべて見る <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="group flex flex-col items-center text-center p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all"
            >
              <span className="text-2xl mb-2" role="img" aria-label={cat.name}>{cat.icon}</span>
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors leading-tight">{cat.name}</span>
              <span className="text-[10px] text-muted-foreground mt-1">{cat.count.toLocaleString()}件</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 注目求人 */}
      <section className="py-14 bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">注目の求人</h2>
              <p className="text-sm text-muted-foreground mt-0.5">注目度・新着順に厳選</p>
            </div>
            <Button variant="outline" size="sm" asChild className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
              <Link href="/jobs" className="flex items-center gap-1.5">
                求人一覧 <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {featuredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      </section>

      {/* 注目企業 */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">注目の企業</h2>
            <p className="text-sm text-muted-foreground mt-0.5">社員口コミ評価が高い企業</p>
          </div>
          <Button variant="outline" size="sm" asChild className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/companies" className="flex items-center gap-1.5">
              企業一覧 <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredCompanies.map((company) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <article className="group bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all p-5 h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/5 transition-colors">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-snug mb-1">{company.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{company.industry} ・ {company.location}</p>

                <div className="flex items-center gap-1 mb-3">
                  <Star className="w-3.5 h-3.5 text-[oklch(0.72_0.18_55)] fill-current" />
                  <span className="text-sm font-semibold text-foreground">{company.rating}</span>
                  <span className="text-xs text-muted-foreground">({company.reviewCount}件)</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-4 flex-1">
                  {company.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] font-normal px-2 py-0">{tag}</Badge>
                  ))}
                </div>

                <div className="pt-3 border-t border-border">
                  <span className="text-xs text-primary font-medium">{company.openJobs}件の求人を見る →</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* CTAバナー */}
      <section className="py-16 bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-3 text-balance">
            今すぐ無料登録して<br />転職活動をスタート
          </h2>
          <p className="text-white/70 mb-8 text-pretty">
            プロフィールを登録するだけで、企業からスカウトが届きます。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-[oklch(0.72_0.18_55)] hover:bg-[oklch(0.65_0.18_55)] text-white font-bold px-8">
              無料で登録する
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              求人を探す
            </Button>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-foreground text-background/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                  <Briefcase className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-base font-bold text-background">AIリクルート</span>
              </div>
              <p className="text-xs leading-relaxed">日本最大級の転職データベース。あなたの理想のキャリアを実現します。</p>
            </div>
            {[
              { title: '求人を探す', links: ['ITエンジニア', 'マーケティング', 'デザイナー', 'データ・AI'] },
              { title: '企業を探す', links: ['IT・インターネット', 'フィンテック', 'スタートアップ', '大手企業'] },
              { title: 'サービス', links: ['利用規約', 'プライバシーポリシー', 'ヘルプセンター', '採用担当者の方へ'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-background/90 text-sm mb-3">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <Link href="#" className="text-xs hover:text-background transition-colors">{link}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-background/10 pt-6 text-center text-xs">
            &copy; 2026 AIリクルート, Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
