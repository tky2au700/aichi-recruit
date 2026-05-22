'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Building2, MapPin, GraduationCap, TrendingUp, Menu, X, Database, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const mainNavItems = [
  { href: '/', label: 'トップ', icon: BarChart3 },
  { href: '/salary/industry', label: '産業別', icon: Building2 },
  { href: '/salary/prefecture', label: '都道府県別', icon: MapPin },
  { href: '/salary/education', label: '学歴別', icon: GraduationCap },
  { href: '/salary/age', label: '年齢別', icon: BarChart3 },
]

const rankingItems = [
  { href: '/salary/ranking/occupation',            label: '職種別年収ランキング' },
  { href: '/salary/ranking/male',                  label: '男性年収ランキング' },
  { href: '/salary/ranking/female',                label: '女性年収ランキング' },
  { href: '/salary/ranking/bonus',                 label: 'ボーナスランキング' },
  { href: '/salary/ranking/hourly-wage',           label: '時給換算ランキング' },
  { href: '/salary/ranking/growth',                label: '年収増加率ランキング' },
  { href: '/salary/ranking/high-income-low-overtime', label: '残業少ない高年収' },
]

export function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)

  const isRankingActive = pathname.startsWith('/salary/ranking')

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Database className="w-5 h-5 text-primary" />
            <span className="text-base font-bold text-foreground tracking-tight">
              AI<span className="text-primary">リクルート</span>
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-1">
              年収DB
            </span>
          </Link>

          {/* デスクトップナビ */}
          <nav className="hidden md:flex items-center gap-1">
            {/* ランキング ドロップダウン */}
            <div
              className="relative"
              onMouseEnter={() => setRankingOpen(true)}
              onMouseLeave={() => setRankingOpen(false)}
            >
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isRankingActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                ランキング
                <ChevronDown className="w-3 h-3" />
              </button>
              {rankingOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-border rounded-xl shadow-lg py-1.5 z-50">
                  {rankingItems.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        pathname === href
                          ? 'text-primary font-medium bg-primary/5'
                          : 'text-foreground hover:bg-muted hover:text-primary'
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {mainNavItems.slice(1).map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* データソース */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <span>出典: e-Stat 賃金構造基本統計調査</span>
          </div>

          {/* モバイルメニューボタン */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="メニュー"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* モバイルメニュー */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border py-2 pb-3">
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ランキング</p>
            {rankingItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  pathname === href ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="my-1 border-t border-border" />
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">カテゴリ</p>
            {mainNavItems.slice(1).map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </header>
  )
}
