'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, MapPin, X, ChevronDown } from 'lucide-react'
import { Header } from '@/components/header'
import { JobCard } from '@/components/job-card'
import { mockJobs } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const jobTypes = ['すべて', '正社員', '契約社員', '業務委託', 'アルバイト']
const salaryRanges = ['指定なし', '400万円以上', '600万円以上', '800万円以上', '1,000万円以上']
const locationOptions = ['すべて', '東京', '大阪', '名古屋', '福岡', 'リモート']
const sortOptions = [
  { value: 'relevance', label: '関連度順' },
  { value: 'newest', label: '新着順' },
  { value: 'salary', label: '年収順' },
]

export default function JobsPage() {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('すべて')
  const [selectedLocation, setSelectedLocation] = useState('すべて')
  const [selectedSalary, setSelectedSalary] = useState('指定なし')
  const [sortBy, setSortBy] = useState('relevance')
  const [showFilters, setShowFilters] = useState(false)

  const activeFilters = [
    selectedType !== 'すべて' && selectedType,
    selectedLocation !== 'すべて' && selectedLocation,
    selectedSalary !== '指定なし' && selectedSalary,
  ].filter(Boolean) as string[]

  const filteredJobs = useMemo(() => {
    return mockJobs.filter((job) => {
      const matchesSearch =
        !search ||
        job.title.includes(search) ||
        job.company.includes(search) ||
        job.tags.some((t) => t.includes(search))
      const matchesType = selectedType === 'すべて' || job.type === selectedType
      const matchesLocation = selectedLocation === 'すべて' || job.location.includes(selectedLocation)
      return matchesSearch && matchesType && matchesLocation
    })
  }, [search, selectedType, selectedLocation])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ページヘッダー */}
      <div className="bg-primary py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-white mb-4">求人検索</h1>
          <div className="flex gap-2">
            <div className="flex-1 bg-card rounded-xl flex items-center gap-3 px-4 py-3 shadow-sm">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="職種・キーワード・企業名"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="bg-card border-border text-foreground hover:bg-secondary gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">絞り込み</span>
              {activeFilters.length > 0 && (
                <span className="w-5 h-5 bg-[oklch(0.72_0.18_55)] text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {activeFilters.length}
                </span>
              )}
            </Button>
          </div>

          {/* 絞り込みパネル */}
          {showFilters && (
            <div className="mt-3 bg-card rounded-xl p-4 shadow-sm grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">雇用形態</p>
                <div className="flex flex-wrap gap-1.5">
                  {jobTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        selectedType === type
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:border-primary/50'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">勤務地</p>
                <div className="flex flex-wrap gap-1.5">
                  {locationOptions.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setSelectedLocation(loc)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        selectedLocation === loc
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:border-primary/50'
                      )}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">想定年収</p>
                <div className="flex flex-wrap gap-1.5">
                  {salaryRanges.map((range) => (
                    <button
                      key={range}
                      onClick={() => setSelectedSalary(range)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        selectedSalary === range
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:border-primary/50'
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 検索結果ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-foreground font-medium">
              <span className="text-xl font-bold text-primary">{filteredJobs.length.toLocaleString()}</span>
              <span className="text-muted-foreground text-sm ml-1">件の求人が見つかりました</span>
            </p>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">絞り込み:</span>
                {activeFilters.map((f) => (
                  <Badge key={f} variant="secondary" className="text-xs gap-1.5">
                    {f}
                    <button
                      onClick={() => {
                        if (jobTypes.includes(f)) setSelectedType('すべて')
                        if (locationOptions.includes(f)) setSelectedLocation('すべて')
                        if (salaryRanges.includes(f)) setSelectedSalary('指定なし')
                      }}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <button
                  onClick={() => { setSelectedType('すべて'); setSelectedLocation('すべて'); setSelectedSalary('指定なし') }}
                  className="text-xs text-primary hover:underline"
                >
                  クリア
                </button>
              </div>
            )}
          </div>

          {/* ソート */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none text-sm bg-card border border-border rounded-lg pl-3 pr-8 py-2 text-foreground cursor-pointer focus:outline-none focus:border-primary"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* 求人リスト */}
        {filteredJobs.length > 0 ? (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">条件に合う求人が見つかりませんでした</p>
            <p className="text-muted-foreground text-sm">検索条件を変更してお試しください</p>
            <Button
              onClick={() => { setSearch(''); setSelectedType('すべて'); setSelectedLocation('すべて'); setSelectedSalary('指定なし') }}
              variant="outline"
              className="mt-4"
            >
              条件をリセット
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
