'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Building2, MapPin, GraduationCap, TrendingUp, Menu, X, Database } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'トップ', icon: BarChart3 },
  { href: '/salary/industry', label: '産業別', icon: Building2 },
  { href: '/salary/occupation', label: '職種別', icon: TrendingUp },
  { href: '/salary/prefecture', label: '都道府県別', icon: MapPin },
  { href: '/salary/education', label: '学歴別', icon: GraduationCap },
  { href: '/salary/age', label: '年齢別', icon: BarChart3 },
]

export function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
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
            {navItems.map(({ href, label, icon: Icon }) => {
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
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
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
