'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'

const popularKeywords = ['エンジニア', 'マーケター', 'データサイエンティスト', 'デザイナー', 'コンサルタント', 'PM']
const popularLocations = ['東京', '大阪', '名古屋', '福岡', 'リモート']

export function HeroSearch() {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (keyword) params.set('q', keyword)
    if (location) params.set('location', location)
    router.push(`/jobs?${params.toString()}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <section className="relative overflow-hidden bg-primary pt-20 pb-28">
      {/* 背景パターン */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.99 0 0) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-background"
        style={{ clipPath: 'ellipse(60% 100% at 50% 100%)' }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-white/20">
          <span className="w-2 h-2 bg-[oklch(0.72_0.18_55)] rounded-full" />
          最新求人 128,450件掲載中
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight text-balance mb-4">
          理想のキャリアを、<br />
          <span className="text-[oklch(0.85_0.15_55)]">ここから始めよう。</span>
        </h1>
        <p className="text-white/70 text-lg mb-10 text-pretty">
          日本最大級の転職データベースで、あなたにぴったりの求人を見つけてください。
        </p>

        {/* 検索バー */}
        <div className="bg-card rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors">
            <Briefcase className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="職種・キーワードで探す"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="w-px bg-border hidden sm:block self-stretch" />

          <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors">
            <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="勤務地"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <Button
            onClick={handleSearch}
            className="bg-[oklch(0.72_0.18_55)] hover:bg-[oklch(0.65_0.18_55)] text-white font-bold px-8 py-3 rounded-xl text-base shrink-0"
          >
            <Search className="w-4 h-4 mr-2" />
            検索
          </Button>
        </div>

        {/* 人気キーワード */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-white/50 text-xs">人気:</span>
          {popularKeywords.map((kw) => (
            <button
              key={kw}
              onClick={() => { setKeyword(kw); router.push(`/jobs?q=${kw}`) }}
              className="text-white/80 text-xs px-3 py-1 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
            >
              {kw}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
