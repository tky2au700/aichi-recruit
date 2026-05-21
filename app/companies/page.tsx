'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Building2, Star, MapPin, Users, Briefcase, ChevronRight } from 'lucide-react'
import { Header } from '@/components/header'
import { mockCompanies } from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const industries = ['すべて', 'ITサービス', 'AI・機械学習', 'フィンテック', 'デザイン・クリエイティブ', 'ヘルスケア', 'EC・小売']

export default function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('すべて')

  const filteredCompanies = useMemo(() => {
    return mockCompanies.filter((c) => {
      const matchesSearch = !search || c.name.includes(search) || c.industry.includes(search) || c.location.includes(search)
      const matchesIndustry = selectedIndustry === 'すべて' || c.industry === selectedIndustry
      return matchesSearch && matchesIndustry
    })
  }, [search, selectedIndustry])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ページヘッダー */}
      <div className="bg-primary py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-white mb-2">企業検索</h1>
          <p className="text-white/70 text-sm mb-6">12,000社以上の企業情報・口コミ評価を掲載</p>
          <div className="max-w-xl bg-card rounded-xl flex items-center gap-3 px-4 py-3 shadow-sm">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="企業名・業種・エリアで検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 業種フィルター */}
        <div className="flex flex-wrap gap-2 mb-6">
          {industries.map((ind) => (
            <button
              key={ind}
              onClick={() => setSelectedIndustry(ind)}
              className={cn(
                'text-sm px-4 py-2 rounded-full border transition-colors',
                selectedIndustry === ind
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-foreground hover:border-primary/50'
              )}
            >
              {ind}
            </button>
          ))}
        </div>

        {/* 件数 */}
        <p className="text-sm text-muted-foreground mb-5">
          <span className="text-lg font-bold text-primary">{filteredCompanies.length}</span> 社が見つかりました
        </p>

        {/* 企業グリッド */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCompanies.map((company) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <article className="group bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 p-5 h-full flex flex-col">
                {/* ロゴ */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors">
                    <Building2 className="w-7 h-7 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {company.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{company.industry}</p>
                  </div>
                </div>

                {/* 評価 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          'w-3.5 h-3.5',
                          star <= Math.floor(company.rating)
                            ? 'text-[oklch(0.72_0.18_55)] fill-current'
                            : 'text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{company.rating}</span>
                  <span className="text-xs text-muted-foreground">({company.reviewCount})</span>
                </div>

                {/* 情報 */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {company.location}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    {company.employeeCount}
                  </div>
                </div>

                {/* 説明 */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1 mb-4">
                  {company.description}
                </p>

                {/* タグ */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {company.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0">{tag}</Badge>
                  ))}
                </div>

                {/* 求人数 */}
                <div className="pt-3.5 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Briefcase className="w-3.5 h-3.5" />
                    {company.openJobs}件の求人
                  </div>
                  <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                    詳細を見る <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* もっと見る */}
        <div className="mt-10 text-center">
          <Button variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground px-10">
            もっと企業を見る
          </Button>
        </div>
      </main>
    </div>
  )
}
